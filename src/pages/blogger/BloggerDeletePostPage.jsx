import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { deleteBloggerPost, fetchBloggerPosts } from "../../store/slices/bloggerPostsSlice";
import { DashboardPageShell } from "../../pages/shared/DashboardPageShell";

export const BloggerDeletePostPage = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { items: posts, loading, deletingIds, mutationError, error } = useAppSelector(
    (state) => state.bloggerPosts,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (postId && !posts.some((post) => post.id === postId)) {
      dispatch(fetchBloggerPosts());
    }
  }, [dispatch, postId, posts]);

  const selectedPost = posts.find((post) => post.id === postId);
  const deleting = useMemo(
    () => Boolean(postId && deletingIds.includes(String(postId))) || isDeleting,
    [deletingIds, postId, isDeleting],
  );

  const handleDelete = async () => {
    if (!postId) return;
    setIsDeleting(true);

    try {
      await dispatch(deleteBloggerPost(postId)).unwrap();
      navigate("/blogger", { replace: true });
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardPageShell
      title="Delete Post"
      subtitle="Confirm removal of the selected blog post."
    >
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        {loading && !selectedPost ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600">
            Loading post details...
          </div>
        ) : selectedPost ? (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-slate-600">
                You are about to delete the post titled:
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">{selectedPost.title}</h2>
              <p className="text-sm text-slate-500">{selectedPost.excerpt}</p>
            </div>

            <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
              This action cannot be undone. The post will be removed from your blogger feed.
            </div>

            {mutationError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {mutationError}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-70"
              >
                {deleting ? "Deleting..." : "Delete Post"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/blogger", { replace: true })}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600">
            Post not found.
          </div>
        )}

        {error && !selectedPost ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>
    </DashboardPageShell>
  );
};
