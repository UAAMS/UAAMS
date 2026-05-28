import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchBloggerPosts } from "../../store/slices/bloggerPostsSlice";
import { DashboardPageShell } from "../../pages/shared/DashboardPageShell";
import { BloggerPostForm } from "../../components/blogger/BloggerPostForm";

export const BloggerEditPostPage = () => {
  const { postId } = useParams();
  const dispatch = useAppDispatch();
  const { items: posts, loading, error } = useAppSelector((state) => state.bloggerPosts);

  useEffect(() => {
    if (postId && !posts.some((post) => post.id === postId)) {
      dispatch(fetchBloggerPosts());
    }
  }, [dispatch, postId, posts]);

  const selectedPost = posts.find((post) => post.id === postId);

  return (
    <DashboardPageShell
      title={selectedPost ? "Edit Post" : "Edit Post"}
      subtitle="Update an existing blog post on its own page."
    >
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        {loading && !selectedPost ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600">
            Loading post details...
          </div>
        ) : selectedPost ? (
          <BloggerPostForm mode="edit" post={selectedPost} />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600">
            Post not found.
          </div>
        )}
        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>
    </DashboardPageShell>
  );
};
