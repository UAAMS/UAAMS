import { useEffect, useMemo, useState } from "react";
import { Edit, Eye, Plus, Trash2 } from "lucide-react";
import { readFileAsDataUrl } from "../../lib/fileDataUrl";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  createUniversityBlogPost,
  deleteUniversityBlogPost,
  fetchUniversityBlogPostsManagement,
  updateUniversityBlogPost,
} from "../../store/slices/universityBlogManagementSlice";

const initialFormState = {
  title: "",
  excerpt: "",
  content: "",
  category: "General",
  tags: "",
  imageUrl: "",
  status: "draft",
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

function UniversityBlog() {
  const dispatch = useAppDispatch();
  const {
    items: posts,
    loading: isLoading,
    error: loadError,
    saving: isSaving,
    mutationError,
    deletingIds,
  } = useAppSelector((state) => state.universityBlogManagement);
  const error = mutationError || loadError;

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [formData, setFormData] = useState(initialFormState);
  const [imageFileName, setImageFileName] = useState("");
  const [formError, setFormError] = useState("");

  const [previewPost, setPreviewPost] = useState(null);

  useEffect(() => {
    dispatch(fetchUniversityBlogPostsManagement());
  }, [dispatch]);

  const categories = useMemo(() => {
    const unique = new Set(posts.map((item) => item.category).filter(Boolean));
    return ["all", ...Array.from(unique)];
  }, [posts]);

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
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [posts, searchTerm, statusFilter, categoryFilter]);

  const stats = useMemo(
    () => ({
      total: posts.length,
      published: posts.filter((item) => item.status === "published").length,
      drafts: posts.filter((item) => item.status === "draft").length,
      views: posts.reduce((total, item) => total + item.views, 0),
    }),
    [posts]
  );

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

  const closeForm = () => {
    setShowForm(false);
    setEditingId("");
    setFormData(initialFormState);
    setImageFileName("");
    setFormError("");
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

  const isDeletingPost = (postId) => deletingIds.includes(String(postId));

  const handleSave = async (event) => {
    event.preventDefault();
    setFormError("");

    try {
      const payload = buildPayload();
      if (editingId) {
        await dispatch(updateUniversityBlogPost({ postId: editingId, payload })).unwrap();
      } else {
        await dispatch(createUniversityBlogPost(payload)).unwrap();
      }

      closeForm();
    } catch (saveError) {
      const message =
        typeof saveError === "string"
          ? saveError
          : saveError?.message || "Unable to save blog post.";
      setFormError(message);
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm("Delete this blog post?")) return;
    try {
      await dispatch(deleteUniversityBlogPost(postId)).unwrap();
    } catch {
      // Errors are surfaced from Redux state.
    }
  };

  if (previewPost) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-slate-900">Preview</h2>
          <button
            type="button"
            onClick={() => setPreviewPost(null)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Close Preview
          </button>
        </div>

        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {previewPost.imageUrl ? (
            <img src={previewPost.imageUrl} alt={previewPost.title} className="h-72 w-full object-cover" />
          ) : null}
          <div className="p-6">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                {previewPost.category || "General"}
              </span>
              {previewPost.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="mb-2 text-slate-900">{previewPost.title || "Untitled Post"}</h1>
            <p className="mb-4 text-sm text-slate-500">{previewPost.excerpt || "No excerpt"}</p>
            <div className="whitespace-pre-wrap text-sm text-slate-700">
              {previewPost.content || "No content"}
            </div>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-slate-900 mb-2">Blog Management</h1>
          <p className="text-slate-600">Create and manage blog posts for students.</p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create Blog Post
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <StatCard label="Total Posts" value={stats.total} />
        <StatCard label="Published" value={stats.published} />
        <StatCard label="Drafts" value={stats.drafts} />
        <StatCard label="Total Views" value={stats.views.toLocaleString()} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid md:grid-cols-3 gap-3">
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
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category === "all" ? "All Categories" : category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading blog posts...
        </div>
      ) : null}

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
                  </div>
                  <h3 className="text-slate-900 mb-2">{post.title}</h3>
                  <p className="text-sm text-slate-600 mb-2">{post.excerpt}</p>
                  <p className="text-xs text-slate-500 mb-2">
                    {formatDate(post.publishedAt || post.createdAt)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span key={`${post.id}-${tag}`} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewPost(post)}
                    className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditForm(post)}
                    className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(post.id)}
                    disabled={isDeletingPost(post.id)}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
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
            <h2 className="text-slate-900 mb-4">{editingId ? "Edit Blog Post" : "Create Blog Post"}</h2>

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

              <div className="flex justify-between border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewPost({
                      ...buildPayload(),
                      id: "preview",
                      tags: buildPayload().tags,
                    })
                  }
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Preview
                </button>

                <div className="flex gap-3">
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
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-600">{label}</div>
      <div className="text-2xl text-slate-900">{value}</div>
    </div>
  );
}

export { UniversityBlog };
