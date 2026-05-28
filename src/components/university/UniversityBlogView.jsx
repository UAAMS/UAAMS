import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, MessageCircle, Heart, Eye } from "lucide-react";
import { DashboardPageShell } from "../../pages/shared/DashboardPageShell";
import { BlogCommentManager } from "../shared/BlogCommentManager";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { ImagePreviewModal } from "../shared/ImagePreviewModal";
import { onDataUpdated } from "../../lib/socketClient";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchUniversityBlogPostsManagement } from "../../store/slices/universityBlogManagementSlice";
import {
  fetchUniversityBlogComments,
  deleteUniversityBlogComment,
} from "../../store/slices/blogCommentsSlice";

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

export function UniversityBlogView() {
  const dispatch = useAppDispatch();
  const { items: blogs, loading: blogsLoading } = useAppSelector(
    (state) => state.universityBlogManagement,
  );
  const { commentsByPost, deletingCommentIds, mutationError } = useAppSelector(
    (state) => state.blogComments,
  );

  const [selectedBlogId, setSelectedBlogId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("published");
  const [pendingCommentId, setPendingCommentId] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");

  useEffect(() => {
    dispatch(fetchUniversityBlogPostsManagement());
    const unsubscribe = onDataUpdated((event) => {
      if (event?.resource === "blogs" || event?.resource === "blog-interactions") {
        dispatch(fetchUniversityBlogPostsManagement());
      }
    });
    return () => unsubscribe();
  }, [dispatch]);

  useEffect(() => {
    if (selectedBlogId && !commentsByPost[selectedBlogId]) {
      dispatch(fetchUniversityBlogComments({ blogId: selectedBlogId }));
    }
  }, [selectedBlogId, commentsByPost, dispatch]);

  const filteredBlogs = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return blogs.filter((item) => {
      const matchesSearch =
        !search ||
        item.title.toLowerCase().includes(search) ||
        item.excerpt.toLowerCase().includes(search) ||
        item.content.toLowerCase().includes(search) ||
        item.tags.some((tag) => String(tag).toLowerCase().includes(search));

      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [blogs, searchTerm, statusFilter]);

  const selectedBlog = selectedBlogId ? blogs.find((b) => b.id === selectedBlogId) : null;
  const selectedComments = selectedBlogId ? commentsByPost[selectedBlogId] : null;

  const handleDeleteComment = async () => {
    if (!pendingCommentId) return;
    try {
      await dispatch(
        deleteUniversityBlogComment({
          blogId: selectedBlogId,
          commentId: pendingCommentId,
        }),
      ).unwrap();
      setPendingCommentId("");
    } catch {
      // Error is shown in Redux state
    }
  };

  if (selectedBlog) {
    return (
      <DashboardPageShell
        title={selectedBlog.title}
        subtitle={selectedBlog.excerpt}
        actions={
          <button
            type="button"
            onClick={() => setSelectedBlogId(null)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Blog Posts
          </button>
        }
      >
        <article className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          {selectedBlog.imageUrl && (
            <button
              type="button"
              onClick={() => setImagePreviewUrl(selectedBlog.imageUrl)}
              className="block w-full"
              title="Open image preview"
            >
              <img
                src={selectedBlog.imageUrl}
                alt={selectedBlog.title}
                className="max-h-96 w-full object-cover"
              />
            </button>
          )}

          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                <Eye className="h-3 w-3" />
                {selectedBlog.views} views
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                <Heart className="h-3 w-3" />
                {selectedBlog.likesCount}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                <MessageCircle className="h-3 w-3" />
                {selectedBlog.commentsCount}
              </span>
              <span
                className={`rounded-full px-2 py-1 text-xs ${
                  selectedBlog.status === "published"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {selectedBlog.status}
              </span>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Published: {formatDate(selectedBlog.publishedAt || selectedBlog.createdAt)}
            </p>

            <div className="prose max-w-none mb-8">
              <p className="whitespace-pre-wrap text-slate-800">{selectedBlog.content}</p>
            </div>

            {selectedBlog.tags.length > 0 && (
              <div className="mb-8 border-t border-slate-200 pt-4">
                <p className="mb-2 text-xs font-medium text-slate-600 uppercase">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {selectedBlog.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>

        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="mb-6 text-lg font-semibold text-slate-900">
            Comments ({selectedBlog.commentsCount || 0})
          </h3>
          <BlogCommentManager
            comments={selectedComments?.comments || []}
            loading={selectedComments?.loading || false}
            error={selectedComments?.error || mutationError}
            onDelete={setPendingCommentId}
            isDeletingIds={deletingCommentIds}
            emptyMessage="No comments on this post yet."
          />
        </div>
        <ConfirmDialog
          open={Boolean(pendingCommentId)}
          title="Delete comment?"
          description="This will delete the selected comment and all replies."
          confirmLabel="Delete Comment"
          isLoading={deletingCommentIds.includes(String(pendingCommentId))}
          onConfirm={handleDeleteComment}
          onCancel={() => setPendingCommentId("")}
        />
        <ImagePreviewModal
          imageUrl={imagePreviewUrl}
          alt={selectedBlog.title}
          onClose={() => setImagePreviewUrl("")}
        />
      </DashboardPageShell>
    );
  }

  return (
    <DashboardPageShell title="Our Blog" subtitle="View and manage your university blog posts">
      {blogsLoading && blogs.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600">
          Loading blog posts...
        </div>
      ) : null}

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by title, short summary, tags..."
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

      {filteredBlogs.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600">
          No blog posts found.
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {filteredBlogs.map((blog) => (
          <article
            key={blog.id}
            onClick={() => setSelectedBlogId(blog.id)}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white p-4 hover:shadow-lg transition-shadow"
          >
            {blog.imageUrl && (
              <img
                src={blog.imageUrl}
                alt={blog.title}
                className="mb-4 h-40 w-full object-cover rounded"
              />
            )}
            <div className="mb-3 flex flex-wrap gap-1">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                {blog.category}
              </span>
              <span
                className={`rounded-full px-2 py-1 text-xs ${
                  blog.status === "published"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {blog.status}
              </span>
            </div>
            <h3 className="mb-2 line-clamp-2 font-semibold text-slate-900">{blog.title}</h3>
            <p className="mb-3 line-clamp-3 text-sm text-slate-600">{blog.excerpt}</p>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {blog.views}
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {blog.likesCount}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {blog.commentsCount}
              </span>
            </div>
          </article>
        ))}
      </div>
    </DashboardPageShell>
  );
}
