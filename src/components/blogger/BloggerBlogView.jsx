import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, MessageCircle, Heart, Eye } from "lucide-react";
import { DashboardPageShell } from "../../pages/shared/DashboardPageShell";
import { BlogCommentManager } from "../shared/BlogCommentManager";
import { onDataUpdated } from "../../lib/socketClient";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchBloggerPosts } from "../../store/slices/bloggerPostsSlice";
import {
  fetchBloggerPostComments,
  deleteBloggerPostComment,
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

export function BloggerBlogView() {
  const dispatch = useAppDispatch();
  const { items: posts, loading: postsLoading } = useAppSelector(
    (state) => state.bloggerPosts,
  );
  const { commentsByPost, deletingCommentIds, mutationError } = useAppSelector(
    (state) => state.blogComments,
  );

  const [selectedPostId, setSelectedPostId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("published");

  useEffect(() => {
    dispatch(fetchBloggerPosts());
    const unsubscribe = onDataUpdated((event) => {
      if (event?.resource === "blogs" || event?.resource === "blog-interactions") {
        dispatch(fetchBloggerPosts());
      }
    });
    return () => unsubscribe();
  }, [dispatch]);

  useEffect(() => {
    if (selectedPostId && !commentsByPost[selectedPostId]) {
      dispatch(fetchBloggerPostComments({ postId: selectedPostId }));
    }
  }, [selectedPostId, commentsByPost, dispatch]);

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

  const selectedPost = selectedPostId ? posts.find((p) => p.id === selectedPostId) : null;
  const selectedComments = selectedPostId ? commentsByPost[selectedPostId] : null;

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Delete this comment and all replies?")) return;
    try {
      await dispatch(
        deleteBloggerPostComment({
          postId: selectedPostId,
          commentId,
        }),
      ).unwrap();
    } catch {
      // Error is shown in Redux state
    }
  };

  if (selectedPost) {
    return (
      <DashboardPageShell
        title={selectedPost.title}
        subtitle={selectedPost.excerpt}
        actions={
          <button
            type="button"
            onClick={() => setSelectedPostId(null)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Posts
          </button>
        }
      >
        <article className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          {selectedPost.imageUrl && (
            <img
              src={selectedPost.imageUrl}
              alt={selectedPost.title}
              className="w-full max-h-96 object-cover"
            />
          )}

          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                <Eye className="h-3 w-3" />
                {selectedPost.views} views
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                <Heart className="h-3 w-3" />
                {selectedPost.likesCount}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                <MessageCircle className="h-3 w-3" />
                {selectedPost.commentsCount}
              </span>
              <span
                className={`rounded-full px-2 py-1 text-xs ${
                  selectedPost.status === "published"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {selectedPost.status}
              </span>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Published: {formatDate(selectedPost.publishedAt || selectedPost.createdAt)}
            </p>

            <div className="prose max-w-none mb-8">
              <p className="whitespace-pre-wrap text-slate-800">{selectedPost.content}</p>
            </div>

            {selectedPost.tags.length > 0 && (
              <div className="mb-8 border-t border-slate-200 pt-4">
                <p className="mb-2 text-xs font-medium text-slate-600 uppercase">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {selectedPost.tags.map((tag) => (
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
            Comments ({selectedPost.commentsCount || 0})
          </h3>
          <BlogCommentManager
            comments={selectedComments?.comments || []}
            loading={selectedComments?.loading || false}
            error={selectedComments?.error || mutationError}
            onDelete={handleDeleteComment}
            isDeletingIds={deletingCommentIds}
            emptyMessage="No comments on this post yet."
          />
        </div>
      </DashboardPageShell>
    );
  }

  return (
    <DashboardPageShell title="My Blog" subtitle="View and manage your blog posts">
      {postsLoading && posts.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600">
          Loading posts...
        </div>
      ) : null}

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by title, excerpt, tags..."
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

      {filteredPosts.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600">
          No posts found.
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {filteredPosts.map((post) => (
          <article
            key={post.id}
            onClick={() => setSelectedPostId(post.id)}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white p-4 hover:shadow-lg transition-shadow"
          >
            {post.imageUrl && (
              <img
                src={post.imageUrl}
                alt={post.title}
                className="mb-4 h-40 w-full object-cover rounded"
              />
            )}
            <div className="mb-3 flex flex-wrap gap-1">
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
            </div>
            <h3 className="mb-2 line-clamp-2 font-semibold text-slate-900">{post.title}</h3>
            <p className="mb-3 line-clamp-3 text-sm text-slate-600">{post.excerpt}</p>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {post.views}
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {post.likesCount}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {post.commentsCount}
              </span>
            </div>
          </article>
        ))}
      </div>
    </DashboardPageShell>
  );
}
