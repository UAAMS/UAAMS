import { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, MessageCircle, Plus, Reply } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardPageShell } from "../../pages/shared/DashboardPageShell";
import { MetricGrid } from "../../pages/shared/MetricGrid";
import { onDataUpdated } from "../../lib/socketClient";
import { readFileAsDataUrl } from "../../lib/fileDataUrl";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchBloggerDashboard } from "../../store/slices/dashboardsSlice";
import {
  createBloggerPost,
  deleteBloggerPost,
  fetchBloggerPosts,
  updateBloggerPost,
} from "../../store/slices/bloggerPostsSlice";

const initialFormState = {
  title: "",
  excerpt: "",
  content: "",
  category: "General",
  tags: "",
  imageUrl: "",
  status: "draft",
};

const defaultMetrics = {
  totalPosts: 0,
  publishedPosts: 0,
  draftPosts: 0,
  totalViews: 0,
  totalPostLikes: 0,
  totalComments: 0,
  totalReplies: 0,
};

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const monthLabel = (value) =>
  new Date(value).toLocaleString("en-US", { month: "short", year: "2-digit" });

function BloggerDashboard() {
  const dispatch = useAppDispatch();
  const {
    data: dashboardData,
    loading: dashboardLoading,
    error: dashboardError,
  } = useAppSelector((state) => state.dashboards.blogger);
  const {
    items: posts,
    loading: postsLoading,
    error: postsError,
    saving: isSaving,
    mutationError,
    deletingIds,
  } = useAppSelector((state) => state.bloggerPosts);

  const metrics = dashboardData?.metrics || defaultMetrics;
  const managedUniversity = dashboardData?.managedUniversity || null;
  const isLoading = (dashboardLoading || postsLoading) && !dashboardData && posts.length === 0;
  const error = mutationError || postsError || dashboardError;
  const [activeMetricLabel, setActiveMetricLabel] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [formData, setFormData] = useState(initialFormState);
  const [imageFileName, setImageFileName] = useState("");
  const [formError, setFormError] = useState("");

  const loadData = useCallback(
    async () => {
      await Promise.all([
        dispatch(fetchBloggerDashboard()).unwrap(),
        dispatch(fetchBloggerPosts()).unwrap(),
      ]);
    },
    [dispatch],
  );

  useEffect(() => {
    loadData().catch(() => {
      // Errors are surfaced from Redux state.
    });
    const unsubscribe = onDataUpdated((event) => {
      if (event?.resource === "blogs" || event?.resource === "blog-interactions") {
        loadData().catch(() => {
          // Errors are surfaced from Redux state.
        });
      }
    });
    return () => unsubscribe();
  }, [loadData]);

  const dashboardMetrics = useMemo(
    () => [
      { label: "Total Posts", value: String(metrics.totalPosts || 0), trend: "All drafts and published posts" },
      { label: "Published", value: String(metrics.publishedPosts || 0), trend: "Visible to students" },
      { label: "Drafts", value: String(metrics.draftPosts || 0), trend: "Pending final publish" },
      {
        label: "Total Views",
        value: Number(metrics.totalViews || 0).toLocaleString(),
        trend: managedUniversity?.name ? `For ${managedUniversity.name}` : "Across your content",
      },
      {
        label: "Post Likes",
        value: Number(metrics.totalPostLikes || 0).toLocaleString(),
        trend: "Student likes on your posts",
      },
      {
        label: "Comments",
        value: Number(metrics.totalComments || 0).toLocaleString(),
        trend: "Top-level discussion threads",
      },
      {
        label: "Replies",
        value: Number(metrics.totalReplies || 0).toLocaleString(),
        trend: "Replies inside discussions",
      },
    ],
    [managedUniversity?.name, metrics],
  );

  useEffect(() => {
    if (
      dashboardMetrics.length > 0 &&
      !dashboardMetrics.some((item) => item.label === activeMetricLabel)
    ) {
      setActiveMetricLabel(dashboardMetrics[0].label);
    }
  }, [dashboardMetrics, activeMetricLabel]);

  const filteredPosts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return posts.filter((item) => {
      const matchesSearch =
        !search ||
        item.title.toLowerCase().includes(search) ||
        item.excerpt.toLowerCase().includes(search) ||
        item.content.toLowerCase().includes(search) ||
        item.tags.some((tag) => String(tag).toLowerCase().includes(search));

      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [posts, searchTerm, statusFilter]);

  const statusChartData = useMemo(
    () => [
      { status: "Published", count: Number(metrics.publishedPosts || 0) },
      { status: "Draft", count: Number(metrics.draftPosts || 0) },
    ],
    [metrics.draftPosts, metrics.publishedPosts],
  );

  const monthlyPosts = useMemo(() => {
    const map = new Map();
    posts.forEach((post) => {
      const date = new Date(post.createdAt || Date.now());
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const current = map.get(key) || { month: monthLabel(date), posts: 0 };
      map.set(key, { ...current, posts: current.posts + 1 });
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([, item]) => item);
  }, [posts]);

  const selectedMetricChartData = useMemo(() => {
    switch (activeMetricLabel) {
      case "Total Posts":
        return [
          { state: "Published", value: Number(metrics.publishedPosts || 0) },
          { state: "Drafts", value: Number(metrics.draftPosts || 0) },
        ];
      case "Published":
        return [
          { state: "Published", value: Number(metrics.publishedPosts || 0) },
          { state: "Unpublished", value: Math.max(0, Number(metrics.totalPosts || 0) - Number(metrics.publishedPosts || 0)) },
        ];
      case "Drafts":
        return [
          { state: "Drafts", value: Number(metrics.draftPosts || 0) },
          { state: "Published", value: Number(metrics.publishedPosts || 0) },
        ];
      case "Total Views":
        return posts.slice(0, 8).map((item) => ({
          state: item.title.slice(0, 18) || "Post",
          value: Number(item.views || 0),
        }));
      case "Post Likes":
        return posts.slice(0, 8).map((item) => ({
          state: item.title.slice(0, 18) || "Post",
          value: Number(item.likesCount || 0),
        }));
      case "Comments":
        return posts.slice(0, 8).map((item) => ({
          state: item.title.slice(0, 18) || "Post",
          value: Number(item.commentsCount || 0),
        }));
      case "Replies":
        return posts.slice(0, 8).map((item) => ({
          state: item.title.slice(0, 18) || "Post",
          value: Number(item.repliesCount || 0),
        }));
      default:
        return [];
    }
  }, [activeMetricLabel, metrics, posts]);

  const isDeletingPost = useCallback(
    (postId) => deletingIds.includes(String(postId)),
    [deletingIds],
  );

  const closeForm = () => {
    setShowForm(false);
    setEditingId("");
    setFormData(initialFormState);
    setImageFileName("");
    setFormError("");
  };

  const openCreateForm = () => {
    setEditingId("");
    setFormData(initialFormState);
    setImageFileName("");
    setFormError("");
    setShowForm(true);
  };

  const openEditForm = (post) => {
    setEditingId(post.id);
    setFormData({
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      category: post.category,
      tags: post.tags.join(", "),
      imageUrl: post.imageUrl,
      status: post.status,
    });
    setImageFileName("");
    setFormError("");
    setShowForm(true);
  };

  const handleImageFileChange = async (file) => {
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setFormData((previous) => ({ ...previous, imageUrl: dataUrl }));
      setImageFileName(file.name);
    } catch {
      setFormError("Unable to read selected image file.");
    }
  };

  const buildPayload = () => ({
    title: formData.title,
    excerpt: formData.excerpt,
    content: formData.content,
    category: formData.category,
    tags: formData.tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    imageUrl: formData.imageUrl,
    status: formData.status,
  });

  const handleSave = async (event) => {
    event.preventDefault();
    setFormError("");
    try {
      const payload = buildPayload();
      if (editingId) {
        await dispatch(updateBloggerPost({ postId: editingId, payload })).unwrap();
      } else {
        await dispatch(createBloggerPost(payload)).unwrap();
      }
      await Promise.all([
        dispatch(fetchBloggerDashboard()).unwrap(),
        dispatch(fetchBloggerPosts()).unwrap(),
      ]);
      closeForm();
    } catch (saveError) {
      const message =
        typeof saveError === "string" ? saveError : saveError?.message || "Unable to save post.";
      setFormError(message);
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await dispatch(deleteBloggerPost(postId)).unwrap();
      await dispatch(fetchBloggerDashboard()).unwrap();
    } catch {
      // Errors are surfaced from Redux state.
    }
  };

  return (
    <DashboardPageShell
      title="Blogger Dashboard"
      subtitle={
        managedUniversity?.name
          ? `Writing for ${managedUniversity.name}`
          : "Manage your university blog posts and audience growth."
      }
      actions={
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create Post
        </button>
      }
    >
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading dashboard...
        </div>
      ) : (
        <MetricGrid
          metrics={dashboardMetrics}
          activeMetricLabel={activeMetricLabel}
          onMetricClick={(metric) => setActiveMetricLabel(metric.label)}
        />
      )}

      {!isLoading && selectedMetricChartData.length > 0 ? (
        <article className="uaams-chart-card rounded-xl p-5">
          <h3 className="font-display mb-2 text-slate-900">{activeMetricLabel} State Graph</h3>
          <p className="mb-4 text-xs text-slate-500">Click a metric card to switch this graph.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={selectedMetricChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="state" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <article className="uaams-chart-card rounded-xl p-5">
          <h3 className="font-display mb-4 text-slate-900">Post Status Split</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="status" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="uaams-chart-card rounded-xl p-5">
          <h3 className="font-display mb-4 text-slate-900">Publishing Timeline</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyPosts}>
                <defs>
                  <linearGradient id="blogPostsArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="posts"
                  stroke="#0ea5e9"
                  fill="url(#blogPostsArea)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-1">
        <article className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="font-display mb-3 text-slate-900">My Posts</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search title, excerpt, tags"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </article>
      </div>

      {!isLoading && filteredPosts.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No posts found.
        </div>
      ) : null}

      {!isLoading && filteredPosts.length > 0 ? (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <article key={post.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {post.category}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        post.status === "published"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {post.status}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {post.views} views
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      <Heart className="h-3 w-3" />
                      {post.likesCount}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      <MessageCircle className="h-3 w-3" />
                      {post.commentsCount}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      <Reply className="h-3 w-3" />
                      {post.repliesCount}
                    </span>
                  </div>
                  <h3 className="text-slate-900 mb-2">{post.title}</h3>
                  <p className="text-sm text-slate-600 mb-2">{post.excerpt}</p>
                  <p className="text-xs text-slate-500 mb-2">
                    Updated: {formatDate(post.updatedAt || post.createdAt)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span
                        key={`${post.id}-${tag}`}
                        className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditForm(post)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(post.id)}
                    disabled={isDeletingPost(post.id)}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    {isDeletingPost(post.id) ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {showForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="mb-4 text-slate-900">{editingId ? "Edit Post" : "Create Post"}</h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(event) =>
                    setFormData((previous) => ({ ...previous, title: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">Excerpt</label>
                <textarea
                  value={formData.excerpt}
                  onChange={(event) =>
                    setFormData((previous) => ({ ...previous, excerpt: event.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(event) =>
                    setFormData((previous) => ({ ...previous, content: event.target.value }))
                  }
                  rows={8}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(event) =>
                      setFormData((previous) => ({ ...previous, category: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(event) =>
                      setFormData((previous) => ({ ...previous, tags: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Image URL</label>
                  <input
                    type="text"
                    value={formData.imageUrl}
                    onChange={(event) =>
                      {
                        setFormData((previous) => ({ ...previous, imageUrl: event.target.value }));
                        setImageFileName("");
                      }
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com/image.jpg"
                  />
                  <p className="mt-1 text-xs text-slate-500">Use URL or upload image below.</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Upload Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleImageFileChange(event.target.files?.[0])}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {imageFileName ? (
                    <p className="mt-1 text-xs text-emerald-700">Selected: {imageFileName}</p>
                  ) : null}
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Status</label>
                  <select
                    value={formData.status}
                    onChange={(event) =>
                      setFormData((previous) => ({ ...previous, status: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>

              {formError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              ) : null}

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-70"
                >
                  {isSaving ? "Saving..." : "Save Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </DashboardPageShell>
  );
}

export { BloggerDashboard };
