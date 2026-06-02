import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { HighlightText } from "../shared/HighlightText";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  deleteAdminStudent,
  fetchAdminStudentsManagement,
  toggleAdminStudentStatus,
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

function StudentManagement() {
  const dispatch = useAppDispatch();
  const {
    items: students,
    loading: isLoading,
    error: loadError,
    mutationError,
    mutatingKeys,
  } = useAppSelector((state) => state.adminUsersManagement.students);
  const error = mutationError || loadError;

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pendingAction, setPendingAction] = useState(null);
  const activeId = mutatingKeys[0] || "";

  useEffect(() => {
    const timeout = setTimeout(() => {
      dispatch(fetchAdminStudentsManagement({ searchTerm }));
    }, 250);

    return () => clearTimeout(timeout);
  }, [dispatch, searchTerm]);

  const filteredStudents = useMemo(() => {
    if (statusFilter === "all") return students;
    return students.filter((item) => item.status === statusFilter);
  }, [students, statusFilter]);

  const stats = useMemo(
    () => ({
      total: students.length,
      active: students.filter((item) => item.status === "active").length,
      inactive: students.filter((item) => item.status === "inactive").length,
      applications: students.reduce(
        (sum, item) => sum + Number(item.applicationStats?.total || 0),
        0
      ),
    }),
    [students]
  );

  const handleToggleStatus = async (student = pendingAction?.item) => {
    if (!student) return;
    const nextStatus = student.status === "active" ? "inactive" : "active";
    try {
      await dispatch(
        toggleAdminStudentStatus({ studentId: student.id, status: nextStatus }),
      ).unwrap();
      setPendingAction(null);
    } catch {
      // Errors are surfaced from Redux state.
    }
  };

  const handleDeleteStudent = async (student = pendingAction?.item) => {
    if (!student) return;
    try {
      await dispatch(deleteAdminStudent(student.id)).unwrap();
      setPendingAction(null);
    } catch {
      // Errors are surfaced from Redux state.
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="uaams-page-title">Student Management</h1>
        <p className="uaams-page-description">Monitor student profiles and account status.</p>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={stats.total} />
        <StatCard label="Active" value={stats.active} />
        <StatCard label="Inactive" value={stats.inactive} />
        <StatCard label="Applications" value={stats.applications} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid md:grid-cols-2 gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by name, email, city"
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
          Loading students...
        </div>
      ) : null}

      {!isLoading && filteredStudents.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No students found.
        </div>
      ) : null}

      {!isLoading && filteredStudents.length > 0 ? (
        <div className="space-y-4">
          {filteredStudents.map((student) => (
            <article key={student.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-slate-900"><HighlightText text={student.name} query={searchTerm} /></h3>
                  <p className="text-sm text-slate-600"><HighlightText text={student.email} query={searchTerm} /></p>
                  <p className="text-xs text-slate-500 mt-1">
                    Phone: <HighlightText text={student.phone || "N/A"} query={searchTerm} /> | City: <HighlightText text={student.city || "N/A"} query={searchTerm} />
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Registered: {formatDate(student.createdAt)} | Applications:{" "}
                    {student.applicationStats?.total || 0}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge label="Pending" value={student.applicationStats?.pending || 0} />
                    <Badge
                      label="Under Review"
                      value={student.applicationStats?.underReview || 0}
                    />
                    <Badge label="Accepted" value={student.applicationStats?.accepted || 0} />
                    <Badge label="Rejected" value={student.applicationStats?.rejected || 0} />
                    <Badge label="Assigned" value={student.applicationStats?.assigned || 0} />
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      student.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {student.status}
                  </span>

                  <button
                    type="button"
                    onClick={() => setPendingAction({ type: "status", item: student })}
                    disabled={Boolean(activeId)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-70"
                  >
                    {student.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingAction({ type: "delete", item: student })}
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
        title={pendingAction?.type === "delete" ? "Delete student?" : "Change student status?"}
        description={
          pendingAction?.type === "delete"
            ? `This will remove ${pendingAction?.item?.name || "this student"} and related records.`
            : `Set ${pendingAction?.item?.name || "this student"} to ${
                pendingAction?.item?.status === "active" ? "inactive" : "active"
              }.`
        }
        confirmLabel={pendingAction?.type === "delete" ? "Delete Student" : "Update Status"}
        tone={pendingAction?.type === "delete" ? "danger" : "success"}
        isLoading={Boolean(activeId)}
        onConfirm={() =>
          pendingAction?.type === "delete" ? handleDeleteStudent() : handleToggleStatus()
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

export { StudentManagement };
