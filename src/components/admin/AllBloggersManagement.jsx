import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { HighlightText } from "../shared/HighlightText";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  deleteAdminBlogger,
  fetchAdminBloggersManagement,
  toggleAdminBloggerStatus,
} from "../../store/slices/adminUsersManagementSlice";

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

function AllBloggersManagement() {
  const dispatch = useAppDispatch();
  const {
    items: bloggers,
    loading: isLoading,
    error: loadError,
    mutationError,
    mutatingKeys,
  } = useAppSelector((state) => state.adminUsersManagement.bloggers);
  const error = mutationError || loadError;

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pendingAction, setPendingAction] = useState(null);
  const activeId = mutatingKeys[0] || "";

  useEffect(() => {
    const timeout = setTimeout(() => {
      dispatch(fetchAdminBloggersManagement({ searchTerm, statusFilter }));
    }, 250);

    return () => clearTimeout(timeout);
  }, [dispatch, searchTerm, statusFilter]);

  const stats = useMemo(
    () => ({
      total: bloggers.length,
      active: bloggers.filter((item) => item.status === "active").length,
      inactive: bloggers.filter((item) => item.status === "inactive").length,
      posts: bloggers.reduce((sum, item) => sum + Number(item.postStats?.totalPosts || 0), 0),
      views: bloggers.reduce((sum, item) => sum + Number(item.postStats?.totalViews || 0), 0),
    }),
    [bloggers]
  );

  const handleToggleStatus = async (blogger = pendingAction?.item) => {
    if (!blogger) return;
    const nextStatus = blogger.status === "active" ? "inactive" : "active";
    try {
      await dispatch(
        toggleAdminBloggerStatus({ bloggerId: blogger.id, status: nextStatus }),
      ).unwrap();
      setPendingAction(null);
    } catch {
      // Errors are surfaced from Redux state.
    }
  };

  const handleDeleteBlogger = async (blogger = pendingAction?.item) => {
    if (!blogger) return;
    try {
      await dispatch(deleteAdminBlogger(blogger.id)).unwrap();
      setPendingAction(null);
    } catch {
      // Errors are surfaced from Redux state.
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="uaams-page-title">Bloggers Management</h1>
        <p className="uaams-page-description">Manage blogger accounts across all universities.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Active" value={stats.active} />
        <StatCard label="Inactive" value={stats.inactive} />
        <StatCard label="Total Posts" value={stats.posts} />
        <StatCard label="Total Views" value={stats.views.toLocaleString()} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid md:grid-cols-2 gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search name, email, username, university"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
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
          Loading bloggers...
        </div>
      ) : null}

      {!isLoading && bloggers.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No bloggers found.
        </div>
      ) : null}

      {!isLoading && bloggers.length > 0 ? (
        <div className="space-y-4">
          {bloggers.map((blogger) => (
            <article key={blogger.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-slate-900"><HighlightText text={blogger.name} query={searchTerm} /></h3>
                  <p className="text-sm text-slate-600"><HighlightText text={blogger.email} query={searchTerm} /></p>
                  <p className="text-xs text-slate-500 mt-1">
                    Username: <HighlightText text={blogger.username || "N/A"} query={searchTerm} /> | University: <HighlightText text={blogger.managedUniversity || "N/A"} query={searchTerm} />
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Added: {formatDate(blogger.createdAt)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge label="Posts" value={blogger.postStats?.totalPosts || 0} />
                    <Badge label="Published" value={blogger.postStats?.publishedPosts || 0} />
                    <Badge label="Drafts" value={blogger.postStats?.draftPosts || 0} />
                    <Badge
                      label="Views"
                      value={Number(blogger.postStats?.totalViews || 0).toLocaleString()}
                    />
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      blogger.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {blogger.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingAction({ type: "status", item: blogger })}
                    disabled={Boolean(activeId)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-70"
                  >
                    {blogger.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingAction({ type: "delete", item: blogger })}
                    disabled={Boolean(activeId)}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-70"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.type === "delete" ? "Delete blogger?" : "Change blogger status?"}
        description={
          pendingAction?.type === "delete"
            ? `This will remove ${pendingAction?.item?.name || "this blogger"} and their posts.`
            : `Set ${pendingAction?.item?.name || "this blogger"} to ${
                pendingAction?.item?.status === "active" ? "inactive" : "active"
              }.`
        }
        confirmLabel={pendingAction?.type === "delete" ? "Delete Blogger" : "Update Status"}
        tone={pendingAction?.type === "delete" ? "danger" : "success"}
        isLoading={Boolean(activeId)}
        onConfirm={() =>
          pendingAction?.type === "delete" ? handleDeleteBlogger() : handleToggleStatus()
        }
        onCancel={() => setPendingAction(null)}
      />
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

function Badge({ label, value }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
      {label}: {value}
    </span>
  );
}

export { AllBloggersManagement };
