import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  School,
} from "lucide-react";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { api } from "../../lib/apiClient";
import { downloadPdfDocument, downloadPdfFromUrl } from "../../lib/pdfDownload";
import { onDataUpdated } from "../../lib/socketClient";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  deleteDraftApplication,
  fetchStudentApplications,
} from "../../store/slices/applicationsSlice";

const statusOptions = [
  { key: "all", label: "All" },
  { key: "not-submitted", label: "Not Submitted" },
  { key: "pending", label: "Pending" },
  { key: "under-review", label: "Under Review" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
  { key: "assigned", label: "Assigned" },
  { key: "finalized", label: "Finalized" },
];

export function MyApplications() {
  const dispatch = useAppDispatch();
  const { items: applications, loading: isLoading, error } = useAppSelector(
    (state) => state.applications.student,
  );
  const location = useLocation();
  const [selectedStatus, setSelectedStatus] = useState("all");

  useEffect(() => {
    dispatch(fetchStudentApplications());
    const unsubscribe = onDataUpdated((event) => {
      if (
        event?.resource === "applications" ||
        event?.resource === "merit-lists"
      ) {
        dispatch(fetchStudentApplications());
      }
    });
    return () => {
      unsubscribe();
    };
  }, [dispatch]);

  useEffect(() => {
    const applicationId = location?.state?.applicationId;
    if (!applicationId) return;
    // attempt to scroll to the application card after a short delay when data loaded
    const t = setTimeout(() => {
      const el = document.getElementById(`application-${applicationId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    return () => clearTimeout(t);
  }, [location?.state, applications]);

  const filteredApplications = useMemo(
    () =>
      applications.filter((app) => {
        if (selectedStatus === "all") return true;
        return app.status === selectedStatus;
      }),
    [applications, selectedStatus],
  );

  const statusCounts = useMemo(() => {
    const counts = {
      all: applications.length,
      "not-submitted": 0,
      pending: 0,
      "under-review": 0,
      accepted: 0,
      rejected: 0,
      assigned: 0,
      finalized: 0,
    };

    applications.forEach((application) => {
      if (counts[application.status] !== undefined) {
        counts[application.status] += 1;
      }
    });

    return counts;
  }, [applications]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="uaams-page-title">My Applications</h1>
        <p className="uaams-page-description">Track the status of your university applications</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((option) => (
            <FilterButton
              key={option.key}
              label={option.label}
              count={statusCounts[option.key] || 0}
              active={selectedStatus === option.key}
              onClick={() => setSelectedStatus(option.key)}
            />
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-600 text-sm">
          Loading your applications...
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {!isLoading && !error && filteredApplications.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-slate-900 mb-2">No Applications Found</h3>
          <p className="text-slate-600 text-sm">
            {selectedStatus === "all"
              ? "You have not submitted any applications yet. Browse recommendations to get started."
              : `No ${selectedStatus.replace("-", " ")} applications found.`}
          </p>
        </div>
      ) : null}

      {!isLoading && !error && filteredApplications.length > 0 ? (
        <div className="space-y-4">
          {filteredApplications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              onDeleteDraft={(applicationId) =>
                dispatch(deleteDraftApplication(applicationId)).unwrap()
              }
            />
          ))}
        </div>
      ) : null}


    </div>
  );
}

function FilterButton({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg transition-colors ${
        active
          ? "bg-emerald-600 text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {label} ({count})
    </button>
  );
}

function ApplicationCard({ application, onDeleteDraft }) {
  const navigate = useNavigate();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [draftError, setDraftError] = useState("");

  const getStatusIcon = () => {
    switch (application.status) {
      case "pending":
        return <Clock className="w-5 h-5 text-amber-500" />;
      case "under-review":
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      case "accepted":
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case "rejected":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "assigned":
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case "finalized":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return <Clock className="w-5 h-5 text-slate-500" />;
    }
  };

  const getStatusColor = () => {
    switch (application.status) {
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "under-review":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "accepted":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "rejected":
        return "bg-red-50 text-red-700 border-red-200";
      case "assigned":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "finalized":
        return "bg-green-50 text-green-700 border-green-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const isUnpaidDraft =
    application.status === "not-submitted" &&
    application.paymentStatus !== "paid" &&
    Boolean(application.universityId);

  const statusText = isUnpaidDraft
    ? "In Payment"
    : application.status
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const progressWidth =
    application.status === "not-submitted"
      ? "20%"
      : application.status === "pending"
      ? "40%"
      : application.status === "under-review"
      ? "60%"
      : application.status === "accepted" || application.status === "rejected"
      ? "80%"
      : application.status === "assigned"
      ? "90%"
      : application.status === "finalized"
      ? "100%"
      : "0%";
  const handleDeleteDraft = async () => {
    setDraftError("");
    setIsDeleting(true);
    try {
      await onDeleteDraft?.(application.id);
      setDeleteDialogOpen(false);
    } catch (error) {
      setDraftError(error?.message || "Unable to delete draft application.");
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadApplicationPdf = async () => {
    setDraftError("");
    setIsDownloading(true);
    try {
      const blob = await api.getBlob(`/applications/${application.id}/template-pdf`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${String(application.applicationCode || "application").toLowerCase()}-application.pdf`;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setDraftError(downloadError?.message || "Unable to download filled application PDF.");
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadLinkedOrFallbackPdf = async ({ url, fileName, fallbackTitle, fallbackLines }) => {
    setIsDownloading(true);
    try {
      if (url) {
        await downloadPdfFromUrl(url, fileName);
        return;
      }
      throw new Error("No URL available");
    } catch {
      downloadPdfDocument({
        title: fallbackTitle,
        fileName,
        lines: fallbackLines,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div id={`application-${application.id}`} className="bg-white rounded-lg border border-slate-200 p-4 transition-shadow hover:shadow-md sm:p-6">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4 flex-1">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
            {application.universityLogo ? (
              <img
                src={application.universityLogo}
                alt={`${application.university} logo`}
                className="h-full w-full object-cover"
              />
            ) : (
              <School className="h-6 w-6 text-slate-600" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-slate-900 mb-1">{application.university}</h3>
            <p className="text-slate-600 mb-2">{application.program}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>Applied: {application.appliedDate}</span>
              <span className="hidden sm:inline">|</span>
              <span>ID: {application.applicationCode}</span>
            </div>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="text-sm">{statusText}</span>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4 mt-4">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-slate-600">Application Progress</span>
          <span className="text-sm text-slate-500">Last updated: {application.lastUpdate}</span>
        </div>

        <div className="relative overflow-x-auto pb-1">
          <div className="flex min-w-[560px] items-center justify-between">
            <TimelineStep label="Payment" completed={application.paymentStatus === "paid"} />
            <TimelineStep label="Submitted" completed={application.status !== "not-submitted"} />
            <TimelineStep
              label="Under Review"
              completed={["under-review", "accepted", "rejected", "assigned", "finalized"].includes(application.status)}
            />
            <TimelineStep
              label="Decision"
              completed={["accepted", "rejected", "assigned", "finalized"].includes(application.status)}
            />
            <TimelineStep label="Finalized" completed={application.status === "finalized"} />
          </div>
          <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-200 -z-10">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: progressWidth }} />
          </div>
        </div>
      </div>

      {application.status === "finalized" && application.eligibleForAdmissionLetter === false ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Finalized without admission letter eligibility. Your university finalized the process after
          assessment, but you were not marked eligible for an admission letter.
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:flex-wrap">
        {isUnpaidDraft ? (
          <>
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/student/apply/${application.universityId}?program=${encodeURIComponent(
                    application.program,
                  )}&draft=${application.id}`,
                )
              }
              className="rounded-lg bg-sky-600 px-4 py-2 text-white transition-colors hover:bg-sky-700"
            >
              View / Edit Draft
            </button>
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isDeleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700 disabled:opacity-70"
            >
              {isDeleting ? "Deleting..." : "Delete Draft"}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/student/payment/${application.id}`)}
              className="rounded-lg bg-amber-500 px-4 py-2 text-white transition-colors hover:bg-amber-600"
            >
              Continue to Payment
            </button>
          </>
        ) : null}
        <button
          type="button"
          onClick={downloadApplicationPdf}
          disabled={isDownloading}
          className="flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-slate-700 transition-colors hover:bg-slate-200 sm:ml-auto"
        >
          <Download className="w-4 h-4" />
          {isDownloading ? "Downloading..." : "Download Application"}
        </button>
        {["accepted", "assigned", "finalized"].includes(application.status) && application.rollNumberSlip ? (
          <button
            type="button"
            onClick={() =>
              downloadLinkedOrFallbackPdf({
                url: application.rollNumberSlip,
                fileName:
                  application.rollNumberSlipName ||
                  `${application.applicationCode || "application"}-roll-number-slip.pdf`,
                fallbackTitle: "Roll Number Slip",
                fallbackLines: [
                  `Application Code: ${application.applicationCode}`,
                  `University: ${application.university}`,
                  `Program: ${application.program}`,
                  "Slip URL was unavailable. This summary is generated from current record.",
                ],
              })
            }
            disabled={isDownloading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-white transition-colors hover:bg-emerald-700"
          >
            Download Roll Number Slip
          </button>
        ) : null}
        {application.admissionLetter ? (
          <button
            type="button"
            onClick={() =>
              downloadLinkedOrFallbackPdf({
                url: application.admissionLetter,
                fileName:
                  application.admissionLetterName ||
                  `${application.applicationCode || "application"}-admission-letter.pdf`,
                fallbackTitle: "Admission Letter",
                fallbackLines: [
                  `Application Code: ${application.applicationCode}`,
                  `University: ${application.university}`,
                  `Program: ${application.program}`,
                  "Admission letter URL was unavailable. This summary is generated from current record.",
                ],
              })
            }
            disabled={isDownloading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-white transition-colors hover:bg-emerald-700"
          >
            Download Admission Letter
          </button>
        ) : null}
      </div>
      {draftError ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {draftError}
        </p>
      ) : null}
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title="Delete draft?"
        description="This unpaid application draft will be removed from your applications list."
        confirmLabel="Delete Draft"
        isLoading={isDeleting}
        onConfirm={handleDeleteDraft}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}

function TimelineStep({ label, completed }) {
  return (
    <div className="flex flex-col items-center relative z-10">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          completed
            ? "bg-emerald-500 text-white"
            : "bg-slate-200 text-slate-400"
        }`}
      >
        {completed ? <CheckCircle className="w-5 h-5" /> : null}
      </div>
      <span className={`text-xs mt-2 ${completed ? "text-slate-700" : "text-slate-500"}`}>{label}</span>
    </div>
  );
}
