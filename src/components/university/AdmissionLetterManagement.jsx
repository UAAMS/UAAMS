import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { getFileNameFromPath, readFileAsDataUrl } from "../../lib/fileDataUrl";
import { isPdfFile } from "../../lib/validation";
import { onDataUpdated } from "../../lib/socketClient";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  fetchUniversityAdmissionLetterRecords,
  upsertUniversityAdmissionLetterRecord,
} from "../../store/slices/universityApplicationRecordsSlice";

const initialFormState = {
  letterNumber: "",
  fileUrl: "",
  fileName: "",
  sentToStudent: false,
};

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

function AdmissionLetterManagement() {
  const dispatch = useAppDispatch();
  const {
    items: applications,
    loading: isLoading,
    error,
    savingId,
  } = useAppSelector((state) => state.universityApplicationRecords.admissionLetters);

  const [searchTerm, setSearchTerm] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [formData, setFormData] = useState(initialFormState);
  const [formError, setFormError] = useState("");
  const isSaving = Boolean(selectedApplicationId) && savingId === selectedApplicationId;

  useEffect(() => {
    dispatch(fetchUniversityAdmissionLetterRecords());
    const unsubscribe = onDataUpdated((event) => {
      if (event?.resource === "applications" || event?.resource === "merit-lists") {
        dispatch(fetchUniversityAdmissionLetterRecords());
      }
    });
    return () => unsubscribe();
  }, [dispatch]);

  const programs = useMemo(() => {
    const unique = new Set(applications.map((item) => item.program).filter(Boolean));
    return ["all", ...Array.from(unique)];
  }, [applications]);

  const filteredApplications = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return applications.filter((item) => {
      const matchesSearch =
        !search ||
        item.studentName.toLowerCase().includes(search) ||
        item.email.toLowerCase().includes(search) ||
        item.applicationCode.toLowerCase().includes(search) ||
        item.admissionLetter.letterNumber.toLowerCase().includes(search);

      const matchesProgram = programFilter === "all" || item.program === programFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "issued" && item.admissionLetter.issued) ||
        (statusFilter === "pending" && !item.admissionLetter.issued) ||
        (statusFilter === "sent" && item.admissionLetter.sentToStudent);

      return matchesSearch && matchesProgram && matchesStatus;
    });
  }, [applications, searchTerm, programFilter, statusFilter]);

  const stats = useMemo(
    () => ({
      total: applications.length,
      issued: applications.filter((item) => item.admissionLetter.issued).length,
      pending: applications.filter((item) => !item.admissionLetter.issued).length,
      sent: applications.filter((item) => item.admissionLetter.sentToStudent).length,
    }),
    [applications]
  );

  const selectedApplication = useMemo(
    () => applications.find((item) => item.id === selectedApplicationId) || null,
    [applications, selectedApplicationId]
  );

  const openUploadForm = (application) => {
    const nextLetterNumber = `UAAMS-AL-${String(
      applications.filter((item) => item.admissionLetter.issued).length + 1,
    ).padStart(4, "0")}`;
    setSelectedApplicationId(application.id);
    setFormData({
      letterNumber:
        application.admissionLetter.letterNumber || nextLetterNumber,
      fileUrl: application.admissionLetter.fileUrl || "",
      fileName:
        application.admissionLetter.fileName ||
        getFileNameFromPath(application.admissionLetter.fileUrl),
      sentToStudent: application.admissionLetter.sentToStudent || false,
    });
    setFormError("");
    setShowForm(true);
  };

  const closeUploadForm = () => {
    setSelectedApplicationId("");
    setFormData(initialFormState);
    setFormError("");
    setShowForm(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!selectedApplicationId) return;

    setFormError("");

    if (!formData.letterNumber.trim()) {
      setFormError("Letter number is required.");
      return;
    }

    if (!formData.fileUrl.trim()) {
      setFormError("Upload a PDF admission letter before saving.");
      return;
    }

    try {
      await dispatch(
        upsertUniversityAdmissionLetterRecord({
          applicationId: selectedApplicationId,
          payload: formData,
        }),
      ).unwrap();
      closeUploadForm();
    } catch (saveError) {
      const message =
        typeof saveError === "string"
          ? saveError
          : saveError?.message || "Unable to save admission letter.";
      setFormError(message);
    }
  };

  const handleLetterFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isPdfFile(file)) {
      setFormError("Admission letter must be uploaded as a PDF file.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setFormData((previous) => ({
        ...previous,
        fileUrl: dataUrl,
        fileName: file.name,
      }));
      setFormError("");
    } catch (fileError) {
      setFormError(fileError?.message || "Unable to process selected file.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="uaams-page-title">Admission Letter Management</h1>
        <p className="uaams-page-description">Upload and manage PDF admission letters for selected students.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Records" value={stats.total} />
        <StatCard label="Letters Issued" value={stats.issued} />
        <StatCard label="Pending" value={stats.pending} />
        <StatCard label="Sent to Student" value={stats.sent} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid md:grid-cols-3 gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search name, email, code, letter number"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={programFilter}
            onChange={(event) => setProgramFilter(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {programs.map((program) => (
              <option key={program} value={program}>
                {program === "all" ? "All Programs" : program}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="issued">Issued</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
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
          Loading admission-letter records...
        </div>
      ) : null}

      {!isLoading && filteredApplications.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No records found.
        </div>
      ) : null}

      {!isLoading && filteredApplications.length > 0 ? (
        <div className="space-y-4">
          {filteredApplications.map((application) => (
            <article key={application.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <h3 className="text-slate-900">{application.studentName}</h3>
                  <p className="text-sm text-slate-600">{application.email}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {application.applicationCode} | {application.program} | {application.aggregate}%
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Roll Number: {application.rollNumber.number || "Not assigned"}
                  </p>
                  <p className="text-xs mt-1">
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        application.eligibleForAdmissionLetter
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {application.eligibleForAdmissionLetter
                        ? "Eligible for Admission Letter"
                        : "Not Eligible"}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Letter: {application.admissionLetter.letterNumber || "Not issued"}
                  </p>
                  {application.admissionLetter.fileName ? (
                    <p className="mt-1 text-xs text-slate-500">
                      File: {application.admissionLetter.fileName}
                    </p>
                  ) : null}
                  {application.admissionLetter.uploadedAt ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Uploaded: {formatDate(application.admissionLetter.uploadedAt)}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {application.admissionLetter.fileUrl ? (
                    <a
                      href={application.admissionLetter.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-lg border border-blue-200 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                    >
                      Open Letter
                    </a>
                  ) : null}
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      application.admissionLetter.issued
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {application.admissionLetter.issued ? "Issued" : "Pending"}
                  </span>
                  {application.admissionLetter.sentToStudent ? (
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
                      Sent
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openUploadForm(application)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {application.admissionLetter.issued ? "Update" : "Issue"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {showForm && selectedApplication ? (
        <div className="uaams-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-6">
            <h2 className="text-slate-900 mb-2">Issue Admission Letter</h2>
            <p className="text-sm text-slate-600 mb-4">
              {selectedApplication.studentName} ({selectedApplication.applicationCode})
            </p>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Letter Number</label>
                <input
                  type="text"
                  value={formData.letterNumber}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      letterNumber: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">Upload Admission Letter (PDF only)</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleLetterFileChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formData.fileName ? (
                  <p className="mt-1 text-xs text-slate-500">Selected: {formData.fileName}</p>
                ) : null}
                {!formData.fileName && formData.fileUrl ? (
                  <p className="mt-1 text-xs text-slate-500">Existing file attached.</p>
                ) : null}
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formData.sentToStudent}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      sentToStudent: event.target.checked,
                    }))
                  }
                  className="rounded border-slate-300"
                />
                Mark as sent to student
              </label>

              {formError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeUploadForm}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-70"
                >
                  {isSaving ? "Saving..." : "Save Letter"}
                </button>
              </div>
            </form>
          </div>
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

export { AdmissionLetterManagement };
