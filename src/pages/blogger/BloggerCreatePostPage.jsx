import { DashboardPageShell } from "../../pages/shared/DashboardPageShell";
import { BloggerPostForm } from "../../components/blogger/BloggerPostForm";

export const BloggerCreatePostPage = () => {
  return (
    <DashboardPageShell
      title="Create Post"
      subtitle="Use a dedicated page to craft and publish a new blog post."
    >
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <BloggerPostForm mode="create" />
      </div>
    </DashboardPageShell>
  );
};
