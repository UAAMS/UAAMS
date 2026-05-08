import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { getFileNameFromPath, readFileAsDataUrl } from "../../lib/fileDataUrl";
import { onDataUpdated } from "../../lib/socketClient";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  fetchUniversityRollNumberRecords,
  upsertUniversityRollNumberRecord,
} from "../../store/slices/universityApplicationRecordsSlice";

const initialFormState = {
  number: "",
  slipFileUrl: "",
  slipFileName: "",
  eligibleForAdmissionLetter: false,
};

function RollNumberManagement() {
  const dispatch = useAppDispatch();
  const {
    items: applications,
    loading: isLoading,
    error,
    savingId,
  } = useAppSelector((state) => state.universityApplicationRecords.rollNumbers);

  const [searchTerm, setSearchTerm] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [formData, setFormData] = useState(initialFormState);
  const [formError, setFormError] = useState("");
  const isSaving = Boolean(selectedApplicationId) && savingId === selectedApplicationId;

  useEffect(() => {
    dispatch(fetchUniversityRollNumberRecords());
    const unsubscribe = onDataUpdated((event) => {
      if (event?.resource === "applications" || event?.resource === "merit-lists") {
        dispatch(fetchUniversityRollNumberRecords());
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
        item.rollNumber.number.toLowerCase().includes(search);

      const matchesProgram = programFilter === "all" || item.program === programFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "assigned" && item.rollNumber.assigned) ||
        (statusFilter === "pending" && !item.rollNumber.assigned);

      return matchesSearch && matchesProgram && matchesStatus;
    });
  }, [applications, searchTerm, programFilter, statusFilter]);

  const stats = useMemo(
    () => ({
      total: applications.length,
      assigned: applications.filter((item) => item.rollNumber.assigned).length,
      pending: applications.filter((item) => !item.rollNumber.assigned).length,
    }),
    [applications]
  );

  const selectedApplication = useMemo(
    () => applications.find((item) => item.id === selectedApplicationId) || null,
    [applications, selectedApplicationId]
  );

  const openAssignForm = (application) => {
    setSelectedApplicationId(application.id);
    setFormData({
      number: application.rollNumber.number || "",
      slipFileUrl: application.rollNumber.slipFileUrl || "",
      slipFileName:
        application.rollNumber.slipFileName ||
        getFileNameFromPath(application.rollNumber.slipFileUrl),
      eligibleForAdmissionLetter: Boolean(application.eligibleForAdmissionLetter),
    });
    setFormError("");
    setShowForm(true);
  };

  const closeAssignForm = () => {
    setSelectedApplicationId("");
    setFormData(initialFormState);
    setFormError("");
    setShowForm(false);
  };

  const handleAssign = async (event) => {
    event.preventDefault();
    if (!selectedApplicationId) return;

    setFormError("");

    try {
      await dispatch(
        upsertUniversityRollNumberRecord({
          applicationId: selectedApplicationId,
          payload: formData,
        }),
      ).unwrap();
      closeAssignForm();
    } catch (saveError) {
      const message =
        typeof saveError === "string" ? saveError : saveError?.message || "Unable to save roll number.";
      setFormError(message);
    }
  };

  const handleSlipFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setFormData((previous) => ({
        ...previous,
        slipFileUrl: dataUrl,
        slipFileName: file.name,
      }));
      setFormError("");
    } catch (fileError) {
      setFormError(fileError?.message || "Unable to process selected file.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-slate-900 mb-2">Roll Number Management</h1>
        <p className="text-slate-600">Assign roll numbers and slip links for accepted students.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <StatCard label="Total Applications" value={stats.total} />
        <StatCard label="Roll Numbers Assigned" value={stats.assigned} />
        <StatCard label="Pending Assignment" value={stats.pending} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid md:grid-cols-3 gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search name, email, code, roll number"
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
            <option value="assigned">Assigned</option>
            <option value="pending">Pending</option>
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
          Loading roll-number records...
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
              <div className="flex items-start justify-between gap-4">
                <div>
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
                        : "Not Eligible for Admission Letter"}
                    </span>
                  </p>
                  {application.rollNumber.slipFileUrl ? (
                    <a
                      href={application.rollNumber.slipFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-xs text-blue-600 hover:text-blue-700"
                    >
                      Open Slip
                    </a>
                  ) : null}
                  {application.rollNumber.slipFileName ? (
                    <p className="mt-1 text-xs text-slate-500">
                      File: {application.rollNumber.slipFileName}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      application.rollNumber.assigned
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {application.rollNumber.assigned ? "Assigned" : "Pending"}
                  </span>
                  <button
                    type="button"
                    onClick={() => openAssignForm(application)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {application.rollNumber.assigned ? "Update" : "Assign"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {showForm && selectedApplication ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6">
            <h2 className="text-slate-900 mb-2">Assign Roll Number</h2>
            <p className="text-sm text-slate-600 mb-4">
              {selectedApplication.studentName} ({selectedApplication.applicationCode})
            </p>

            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Roll Number</label>
                <input
                  type="text"
                  value={formData.number}
                  onChange={(event) =>
                    setFormData((previous) => ({ ...previous, number: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">Upload Roll Number Slip (PDF/Image)</label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleSlipFileChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formData.slipFileName ? (
                  <p className="mt-1 text-xs text-slate-500">Selected: {formData.slipFileName}</p>
                ) : null}
                {!formData.slipFileName && formData.slipFileUrl ? (
                  <p className="mt-1 text-xs text-slate-500">Existing file attached.</p>
                ) : null}
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(formData.eligibleForAdmissionLetter)}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      eligibleForAdmissionLetter: event.target.checked,
                    }))
                  }
                  className="rounded border-slate-300"
                />
                Eligible for admission letter
              </label>

              {formError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              ) : null}

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closeAssignForm}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-70"
                >
                  {isSaving ? "Saving..." : "Save Roll Number"}
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

export { RollNumberManagement };
