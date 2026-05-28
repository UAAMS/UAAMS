import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Plus, Reply } from "lucide-react";
import { DashboardPageShell } from "../../pages/shared/DashboardPageShell";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
import { ImagePreviewModal } from "../../components/shared/ImagePreviewModal";
import { onDataUpdated } from "../../lib/socketClient";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { deleteBloggerPost, fetchBloggerPosts } from "../../store/slices/bloggerPostsSlice";

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

export const BloggerMyPostsPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items: posts, loading: postsLoading, error: postsError, deletingIds } = useAppSelector(
    (state) => state.bloggerPosts,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pendingDeletePost, setPendingDeletePost] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  useEffect(() => {
    dispatch(fetchBloggerPosts()).unwrap().catch(() => {
      // Errors surfaced in Redux state.
    });
    const unsubscribe = onDataUpdated((event) => {
      if (event?.resource === "blogs" || event?.resource === "blog-interactions") {
        dispatch(fetchBloggerPosts()).unwrap().catch(() => {
          // Errors surfaced in Redux state.
        });
      }
    });
    return () => unsubscribe();
  }, [dispatch]);

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

  const isDeletingPost = useCallback(
    (postId) => deletingIds.includes(String(postId)),
    [deletingIds],
  );

  const handleDeletePost = async () => {
    if (!pendingDeletePost?.id) return;
    try {
      await dispatch(deleteBloggerPost(pendingDeletePost.id)).unwrap();
      setPendingDeletePost(null);
    } catch {
      // Errors are surfaced from Redux state.
    }
  };

  return (
    <DashboardPageShell
      title="My Posts"
      subtitle="Manage your posts, search by status, and create new content from one place."
      actions={
        <button
          type="button"
          onClick={() => navigate("/blogger/posts/create")}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create Post
        </button>
      }
    >
      {postsError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {postsError}
        </p>
      ) : null}

      {postsLoading && posts.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          Loading posts...
        </div>
      ) : null}

      <article className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-display mb-3 text-slate-900">My Posts</h3>
            <p className="text-sm text-slate-500">Search and manage all your blogger posts in one place.</p>
          </div>

          <div className="grid w-full gap-3 md:w-auto md:grid-cols-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search title, short summary, tags"
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
        </div>
      </article>

      {!postsLoading && filteredPosts.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No posts found.
        </div>
      ) : null}

      {!postsLoading && filteredPosts.length > 0 ? (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <article key={post.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  {post.imageUrl ? (
                    <button
                      type="button"
                      onClick={() => setImagePreviewUrl(post.imageUrl)}
                      className="block overflow-hidden rounded-lg border border-slate-200 sm:w-44"
                      title="Open image preview"
                    >
                      <img src={post.imageUrl} alt={post.title} className="h-44 w-full object-cover sm:h-32" />
                    </button>
                  ) : null}
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
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/blogger/posts/${post.id}/edit`)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeletePost(post)}
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
      <ConfirmDialog
        open={Boolean(pendingDeletePost)}
        title="Delete blog post?"
        description={`Delete "${pendingDeletePost?.title || "this post"}"? Likes, views, and comments attached to it will be removed.`}
        confirmLabel="Delete Post"
        isLoading={pendingDeletePost ? isDeletingPost(pendingDeletePost.id) : false}
        onConfirm={handleDeletePost}
        onCancel={() => setPendingDeletePost(null)}
      />
      <ImagePreviewModal
        imageUrl={imagePreviewUrl}
        alt="Blog post image preview"
        onClose={() => setImagePreviewUrl("")}
      />
    </DashboardPageShell>
  );
};
