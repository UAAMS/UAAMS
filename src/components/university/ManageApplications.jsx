import { useEffect, useMemo, useState } from "react";
import { Search, Download, Eye, CheckCircle, XCircle, Clock, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { HighlightText } from "../shared/HighlightText";
import { onDataUpdated } from "../../lib/socketClient";
import { api } from "../../lib/apiClient";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  clearApplicationsErrors,
  deleteUniversityApplication,
  fetchUniversityApplications,
  updateUniversityApplicationStatus,
} from "../../store/slices/applicationsSlice";

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const normalizeApplication = (item) => ({
  id: String(item?._id || item?.id || ""),
  code: item?.applicationCode || "N/A",
  studentName: item?.studentName || item?.student?.name || "Student",
  email: item?.email || item?.student?.email || "",
  program: item?.program || "Program",
  aggregate: Number(item?.aggregate || 0),
  matricMarks: Number(item?.matricMarks || 0),
  interMarks: Number(item?.interMarks || 0),
  testScore: Number(item?.testScore || 0),
  appliedDate: formatDate(item?.appliedAt || item?.createdAt),
  appliedAt: item?.appliedAt || item?.createdAt || "",
  status: item?.status || "pending",
  cnic: item?.cnic || "",
});

const nextStatusOptionsByCurrent = {
  "not-submitted": [],
  pending: ["under-review", "rejected"],
  "under-review": ["accepted", "rejected"],
  accepted: ["assigned"],
  assigned: ["finalized"],
  finalized: [],
  rejected: [],
};

function ManageApplications() {
  const dispatch = useAppDispatch();
  const {
    items: universityApplications,
    loading: isLoading,
    error,
    deletingIds,
  } = useAppSelector((state) => state.applications.university);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedProgram, setSelectedProgram] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [sortBy, setSortBy] = useState("date-desc");
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [downloadError, setDownloadError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const isDeletingTarget = Boolean(deleteTarget?.id) && deletingIds.includes(deleteTarget.id);

  const applications = useMemo(
    () => (universityApplications || []).map(normalizeApplication),
    [universityApplications],
  );
  const isInitialLoading = isLoading && applications.length === 0;

  useEffect(() => {
    dispatch(clearApplicationsErrors());
    dispatch(fetchUniversityApplications());
    const unsubscribe = onDataUpdated((event) => {
      if (event?.resource === "applications") {
        dispatch(fetchUniversityApplications());
      }
    });
    return () => {
      unsubscribe();
      dispatch(clearApplicationsErrors());
    };
  }, [dispatch]);

  const downloadApplicationArchive = async (application) => {
    setDownloadError("");
    setDownloadingId(application.id);
    try {
      const blob = await api.getBlob(`/applications/${application.id}/archive`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${String(application.code || "application").toLowerCase()}-application-package.zip`;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadFailure) {
      setDownloadError(
        downloadFailure?.message ||
          "Unable to download application package. Make sure the application documents are available.",
      );
    } finally {
      setDownloadingId("");
    }
  };

  const filteredApplications = useMemo(() => {
    const filtered = applications.filter((app) => {
        const search = searchTerm.trim().toLowerCase();
        const matchesSearch =
          !search ||
          app.studentName.toLowerCase().includes(search) ||
          app.email.toLowerCase().includes(search) ||
          app.code.toLowerCase().includes(search);
        const matchesStatus = selectedStatus === "all" || app.status === selectedStatus;
        const matchesProgram = selectedProgram === "all" || app.program === selectedProgram;
        const matchesDate =
          !selectedDate ||
          (app.appliedAt && new Date(app.appliedAt).toISOString().slice(0, 10) === selectedDate);
        return matchesSearch && matchesStatus && matchesProgram && matchesDate;
      });

    return [...filtered].sort((first, second) => {
      if (sortBy === "name-asc") return first.studentName.localeCompare(second.studentName);
      if (sortBy === "name-desc") return second.studentName.localeCompare(first.studentName);

      const firstDate = new Date(first.appliedAt || 0).getTime();
      const secondDate = new Date(second.appliedAt || 0).getTime();
      return sortBy === "date-asc" ? firstDate - secondDate : secondDate - firstDate;
    });
  }, [applications, searchTerm, selectedStatus, selectedProgram, selectedDate, sortBy]);

  const programs = useMemo(
    () => Array.from(new Set(applications.map((app) => app.program))).sort((a, b) => a.localeCompare(b)),
    [applications],
  );

  const updateApplicationStatus = async (applicationId, status) => {
    dispatch(clearApplicationsErrors());
    const updatedApplication = await dispatch(
      updateUniversityApplicationStatus({ applicationId, status }),
    ).unwrap();
    const updated = normalizeApplication(updatedApplication || {});
    setSelectedApplication((previous) =>
      previous && previous.id === applicationId ? { ...previous, ...updated } : previous,
    );
  };

  const handleDeleteApplication = async () => {
    if (!deleteTarget?.id) return;
    try {
      await dispatch(deleteUniversityApplication(deleteTarget.id)).unwrap();
      if (selectedApplication?.id === deleteTarget.id) {
        setSelectedApplication(null);
      }
      setDeleteTarget(null);
    } catch {
      // Error is surfaced from Redux state.
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="uaams-page-title">Manage Applications</h1>
        <p className="uaams-page-description">Review and process student applications</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-6">
        <div className="grid gap-4 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="block text-slate-700 mb-2 text-sm">Search Applications</label>
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search name, email, code"
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-slate-700 mb-2 text-sm">Status</label>
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="not-submitted">Not Submitted</option>
              <option value="pending">Pending</option>
              <option value="under-review">Under Review</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="assigned">Assigned</option>
              <option value="finalized">Finalized</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-700 mb-2 text-sm">Program</label>
            <select
              value={selectedProgram}
              onChange={(event) => setSelectedProgram(event.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Programs</option>
              {programs.map((program) => (
                <option key={program} value={program}>
                  {program}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-700">Applied Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-700">Sort</label>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
            </select>
          </div>
        </div>
      </div>

      {isInitialLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading applications...
        </div>
      ) : null}

      {!isInitialLoading && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}
      {!isInitialLoading && !error && downloadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {downloadError}
        </div>
      ) : null}

      {!isInitialLoading && !error ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total" count={applications.length} color="bg-blue-50 text-blue-600" />
            <StatCard
              label="Pending"
              count={applications.filter((a) => a.status === "pending").length}
              color="bg-amber-50 text-amber-600"
            />
            <StatCard
              label="Accepted"
              count={applications.filter((a) => a.status === "accepted").length}
              color="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              label="Rejected"
              count={applications.filter((a) => a.status === "rejected").length}
              color="bg-red-50 text-red-600"
            />
          </div>

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-slate-700 text-sm">Application Code</th>
                    <th className="px-6 py-3 text-left text-slate-700 text-sm">Student Name</th>
                    <th className="px-6 py-3 text-left text-slate-700 text-sm">Program</th>
                    <th className="px-6 py-3 text-left text-slate-700 text-sm">Aggregate</th>
                    <th className="px-6 py-3 text-left text-slate-700 text-sm">Applied Date</th>
                    <th className="px-6 py-3 text-left text-slate-700 text-sm">Status</th>
                    <th className="px-6 py-3 text-left text-slate-700 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredApplications.map((application) => (
                    <tr key={application.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm text-slate-900">
                        <HighlightText text={application.code} query={searchTerm} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900">
                          <HighlightText text={application.studentName} query={searchTerm} />
                        </div>
                        <div className="text-xs text-slate-500">
                          <HighlightText text={application.email} query={searchTerm} />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">{application.program}</td>
                      <td className="px-6 py-4">
                        <span className="text-emerald-600">{application.aggregate}%</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{application.appliedDate}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={application.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedApplication(application)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => downloadApplicationArchive(application)}
                            disabled={downloadingId === application.id}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Download application package"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(application)}
                            disabled={deletingIds.includes(application.id)}
                            className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                            title="Delete application record"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredApplications.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-600">No applications matched current filters.</div>
            ) : null}
          </div>
        </>
      ) : null}

      {selectedApplication ? (
        <ApplicationDetailModal
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
          onStatusSave={async (nextStatus) => {
            await updateApplicationStatus(selectedApplication.id, nextStatus);
            setSelectedApplication((previous) =>
              previous ? { ...previous, status: nextStatus } : previous,
            );
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete application record?"
        description={`This will permanently delete ${
          deleteTarget?.code || "this application"
        } from applications, roll numbers, and admission letters.`}
        confirmLabel="Delete Record"
        tone="danger"
        isLoading={isDeletingTarget}
        onConfirm={handleDeleteApplication}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function StatCard({ label, count, color }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="text-slate-600 text-sm mb-1">{label}</div>
      <div className={`text-3xl ${color}`}>{count}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    "not-submitted": "bg-slate-100 text-slate-700 border-slate-200",
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    "under-review": "bg-blue-100 text-blue-700 border-blue-200",
    accepted: "bg-emerald-100 text-emerald-700 border-emerald-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
    assigned: "bg-indigo-100 text-indigo-700 border-indigo-200",
    finalized: "bg-green-100 text-green-700 border-green-200",
  };
  const icons = {
    "not-submitted": <Clock className="w-4 h-4" />,
    pending: <Clock className="w-4 h-4" />,
    "under-review": <Clock className="w-4 h-4" />,
    accepted: <CheckCircle className="w-4 h-4" />,
    rejected: <XCircle className="w-4 h-4" />,
    assigned: <CheckCircle className="w-4 h-4" />,
    finalized: <CheckCircle className="w-4 h-4" />,
  };
  const label = status
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-sm ${styles[status]}`}>
      {icons[status]}
      {label}
    </span>
  );
}

function ApplicationDetailModal({ application, onClose, onStatusSave }) {
  const [status, setStatus] = useState(application.status);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  const availableNextStatuses = nextStatusOptionsByCurrent[application.status] || [];
  const canUpdateStatus = availableNextStatuses.length > 0;

  const handleStatusChange = async () => {
    setError("");
    setConfirmOpen(false);
    setIsSaving(true);
    try {
      await onStatusSave(status);
      onClose();
    } catch (saveError) {
      setError(
        typeof saveError === "string"
          ? saveError
          : saveError?.message || "Unable to update status.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="uaams-modal-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-slate-900 mb-1">Application Details</h2>
              <p className="text-slate-600">{application.code}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-slate-900 mb-3">Student Information</h3>
            <div className="grid md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
              <DetailItem label="Full Name" value={application.studentName} />
              <DetailItem label="Email" value={application.email} />
              <DetailItem label="CNIC" value={application.cnic || "N/A"} />
              <DetailItem label="Applied Date" value={application.appliedDate} />
            </div>
          </div>

          <div>
            <h3 className="text-slate-900 mb-3">Academic Information</h3>
            <div className="grid md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
              <DetailItem label="Program" value={application.program} />
              <DetailItem label="Aggregate" value={`${application.aggregate}%`} />
              <DetailItem label="Matric Marks" value={`${application.matricMarks}/1100`} />
              <DetailItem label="Inter Marks" value={`${application.interMarks}/1100`} />
              <DetailItem label="Test Score" value={`${application.testScore}/100`} />
            </div>
          </div>

          <div>
            <h3 className="text-slate-900 mb-3">Application Status</h3>
            <div className="bg-slate-50 p-4 rounded-lg">
              {canUpdateStatus ? (
                <div className="mb-4">
                  <label className="block text-slate-700 mb-2 text-sm">Update Status</label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={application.status}>
                      {application.status
                        .split("-")
                        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(" ")} (Current)
                    </option>
                    {availableNextStatuses.map((nextStatus) => (
                      <option key={nextStatus} value={nextStatus}>
                        {nextStatus
                          .split("-")
                          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(" ")}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="mb-4 rounded-lg bg-white px-3 py-2 text-sm text-slate-600">
                  This application is {application.status.replace("-", " ")}. No further status
                  updates are available.
                </p>
              )}

              {error ? (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              ) : null}

              {canUpdateStatus ? (
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={isSaving || status === application.status}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? "Updating..." : "Update Status"}
                </button>
              </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={isConfirmOpen}
        title="Update status?"
        description={`Change ${application.code} from ${application.status.replace(
          "-",
          " ",
        )} to ${status.replace("-", " ")}.`}
        confirmLabel="Update Status"
        tone="success"
        isLoading={isSaving}
        onConfirm={handleStatusChange}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <div className="text-slate-600 text-sm mb-1">{label}</div>
      <div className="text-slate-900">{value}</div>
    </div>
  );
}

export { ManageApplications };
