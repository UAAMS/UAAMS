import { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  deleteAdminUniversity,
  fetchAdminUniversitiesManagement,
  reviewAdminUniversity,
  toggleAdminUniversityStatus,
} from "../../store/slices/adminUniversityManagementSlice";

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

function UniversityManagement() {
  const dispatch = useAppDispatch();
  const {
    items: universities,
    loading: isLoading,
    error: loadError,
    mutationError,
    mutatingKeys,
  } = useAppSelector((state) => state.adminUniversityManagement);
  const error = mutationError || loadError;

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const activeId = mutatingKeys[0] || "";

  useEffect(() => {
    const timeout = setTimeout(() => {
      dispatch(
        fetchAdminUniversitiesManagement({
          searchTerm,
          statusFilter,
        }),
      );
    }, 250);

    return () => clearTimeout(timeout);
  }, [dispatch, searchTerm, statusFilter]);

  const stats = useMemo(
    () => ({
      total: universities.length,
      pending: universities.filter((item) => item.approvalStatus === "pending").length,
      approved: universities.filter((item) => item.approvalStatus === "approved").length,
      rejected: universities.filter((item) => item.approvalStatus === "rejected").length,
    }),
    [universities]
  );

  const handleReview = async (universityId, approvalStatus) => {
    try {
      await dispatch(reviewAdminUniversity({ universityId, approvalStatus })).unwrap();
    } catch {
      // Errors are surfaced from Redux state.
    }
  };

  const handleToggleUserStatus = async (university) => {
    const nextStatus = university.status === "active" ? "inactive" : "active";
    try {
      await dispatch(
        toggleAdminUniversityStatus({
          universityId: university.id,
          status: nextStatus,
        }),
      ).unwrap();
    } catch {
      // Errors are surfaced from Redux state.
    }
  };

  const handleDeleteUniversity = async (university) => {
    const confirmed = window.confirm(
      `Delete university "${university.name}"?\nThis will remove related applications, bloggers, programs, and content.`,
    );
    if (!confirmed) return;

    try {
      await dispatch(deleteAdminUniversity(university.id)).unwrap();
    } catch {
      // Errors are surfaced from Redux state.
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-slate-900 mb-2">University Management</h1>
        <p className="text-slate-600">Review university approvals and platform status.</p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Pending" value={stats.pending} />
        <StatCard label="Approved" value={stats.approved} />
        <StatCard label="Rejected" value={stats.rejected} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid md:grid-cols-2 gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by name, email, location"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Approval States</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
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
          Loading universities...
        </div>
      ) : null}

      {!isLoading && universities.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No universities found.
        </div>
      ) : null}

      {!isLoading && universities.length > 0 ? (
        <div className="space-y-4">
          {universities.map((university) => (
            <article key={university.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-slate-900">{university.name}</h3>
                  <p className="text-sm text-slate-600">{university.email}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {university.location} | Representative: {university.representative}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Registered: {formatDate(university.createdAt)} | Applications:{" "}
                    {university.applicationStats?.total || 0} | Bloggers: {university.bloggerCount}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      university.approvalStatus === "approved"
                        ? "bg-emerald-100 text-emerald-700"
                        : university.approvalStatus === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {university.approvalStatus}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      university.status === "active"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {university.status}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
                {university.approvalStatus === "pending" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleReview(university.id, "approved")}
                      disabled={Boolean(activeId)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-70"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReview(university.id, "rejected")}
                      disabled={Boolean(activeId)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-70"
                    >
                      Reject
                    </button>
                  </>
                ) : null}

                <button
                  type="button"
                  onClick={() => handleToggleUserStatus(university)}
                  disabled={Boolean(activeId)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-70"
                >
                  {university.status === "active" ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteUniversity(university)}
                  disabled={Boolean(activeId)}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-70"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
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

export { UniversityManagement };
