import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { PasswordField } from "../shared/PasswordField";
import { isStrongPassword, isValidEmail, isValidName, isValidPhone } from "../../lib/validation";
import { onDataUpdated } from "../../lib/socketClient";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  clearUniversityBloggerCredentials,
  clearUniversityBloggersMessages,
  createUniversityBlogger,
  deleteUniversityBlogger,
  fetchUniversityBloggers,
  toggleUniversityBloggerStatus,
} from "../../store/slices/universityBloggersManagementSlice";

const initialFormState = {
  name: "",
  email: "",
  username: "",
  phone: "",
  password: "",
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

function BloggerManagement() {
  const dispatch = useAppDispatch();
  const {
    items: bloggers,
    loading: isLoading,
    creating: isCreating,
    error: loadError,
    createError,
    statusError,
    deleteError,
    statusMutatingIds,
    deletingIds,
    credentials,
    statusMessage,
  } = useAppSelector((state) => state.universityBloggersManagement);
  const error = deleteError || statusError || loadError;

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(initialFormState);
  const [formError, setFormError] = useState("");
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    dispatch(fetchUniversityBloggers());
    const unsubscribe = onDataUpdated((event) => {
      if (event?.resource === "bloggers") {
        dispatch(fetchUniversityBloggers());
      }
    });

    return () => {
      unsubscribe();
    };
  }, [dispatch]);

  const filteredBloggers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return bloggers.filter((item) => {
      const matchesSearch =
        !search ||
        item.name.toLowerCase().includes(search) ||
        item.email.toLowerCase().includes(search) ||
        item.username.toLowerCase().includes(search);

      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bloggers, searchTerm, statusFilter]);

  const stats = useMemo(
    () => ({
      total: bloggers.length,
      active: bloggers.filter((item) => item.status === "active").length,
      inactive: bloggers.filter((item) => item.status === "inactive").length,
    }),
    [bloggers]
  );

  const openCreateForm = () => {
    dispatch(clearUniversityBloggersMessages());
    setShowForm(true);
    setFormData(initialFormState);
    setFormError("");
  };

  const closeCreateForm = () => {
    dispatch(clearUniversityBloggersMessages());
    setShowForm(false);
    setFormData(initialFormState);
    setFormError("");
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    dispatch(clearUniversityBloggersMessages());
    setFormError("");

    if (!isValidName(formData.name)) {
      setFormError("Enter a valid blogger name.");
      return;
    }

    if (!isValidEmail(formData.email)) {
      setFormError("Enter a valid email address.");
      return;
    }

    if (formData.phone.trim() && !isValidPhone(formData.phone)) {
      setFormError("Enter a valid Pakistani mobile number.");
      return;
    }

    if (formData.username.trim() && !/^[A-Za-z][A-Za-z0-9._-]{2,29}$/.test(formData.username.trim())) {
      setFormError("Username must start with a letter and use 3-30 letters, numbers, dots, underscores, or hyphens.");
      return;
    }

    if (!isStrongPassword(formData.password)) {
      setFormError(
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
      );
      return;
    }

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        username: formData.username || undefined,
        phone: formData.phone,
        password: formData.password,
      };

      await dispatch(createUniversityBlogger(payload)).unwrap();
      closeCreateForm();
    } catch (createError) {
      const message =
        typeof createError === "string" ? createError : createError?.message || "Unable to create blogger.";
      setFormError(message);
    }
  };

  const handleToggleStatus = async (blogger = pendingAction?.blogger) => {
    if (!blogger) return;
    const nextStatus = blogger.status === "active" ? "inactive" : "active";
    try {
      await dispatch(
        toggleUniversityBloggerStatus({
          bloggerId: blogger.id,
          status: nextStatus,
        }),
      ).unwrap();
      setPendingAction(null);
    } catch {
      // Errors are surfaced from Redux state.
    }
  };

  const handleDeleteBlogger = async (blogger = pendingAction?.blogger) => {
    if (!blogger) return;
    try {
      await dispatch(deleteUniversityBlogger(blogger.id)).unwrap();
      setPendingAction(null);
    } catch {
      // Errors are surfaced from Redux state.
    }
  };

  const isStatusMutating = (bloggerId) => statusMutatingIds.includes(String(bloggerId));
  const isDeleting = (bloggerId) => deletingIds.includes(String(bloggerId));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="uaams-page-title">Blogger Management</h1>
          <p className="uaams-page-description">Create and manage bloggers for your university.</p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Blogger
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" count={stats.total} />
        <StatCard label="Active" count={stats.active} />
        <StatCard label="Inactive" count={stats.inactive} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid md:grid-cols-2 gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search name, email, username"
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
      {statusMessage ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {statusMessage}
        </p>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading bloggers...
        </div>
      ) : null}

      {!isLoading && filteredBloggers.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No bloggers found.
        </div>
      ) : null}

      {!isLoading && filteredBloggers.length > 0 ? (
        <div className="space-y-4">
          {filteredBloggers.map((blogger) => (
            <article key={blogger.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <h3 className="text-slate-900">{blogger.name}</h3>
                  <p className="text-sm text-slate-600">{blogger.email}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Username: {blogger.username || "N/A"} | Phone: {blogger.phone || "N/A"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Added: {formatDate(blogger.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
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
                    onClick={() => setPendingAction({ type: "status", blogger })}
                    disabled={isStatusMutating(blogger.id) || isDeleting(blogger.id)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {isStatusMutating(blogger.id)
                      ? "Updating..."
                      : blogger.status === "active"
                        ? "Deactivate"
                        : "Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingAction({ type: "delete", blogger })}
                    disabled={isDeleting(blogger.id) || isStatusMutating(blogger.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 inline-flex items-center gap-1 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isDeleting(blogger.id) ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {showForm ? (
        <div className="uaams-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-6">
            <h2 className="text-slate-900 mb-4">Add Blogger</h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(event) => {
                      dispatch(clearUniversityBloggersMessages());
                      setFormError("");
                      setFormData((previous) => ({ ...previous, name: event.target.value }));
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(event) => {
                      dispatch(clearUniversityBloggersMessages());
                      setFormError("");
                      setFormData((previous) => ({ ...previous, email: event.target.value }));
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Username (optional)</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(event) => {
                      dispatch(clearUniversityBloggersMessages());
                      setFormError("");
                      setFormData((previous) => ({ ...previous, username: event.target.value }));
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(event) => {
                      dispatch(clearUniversityBloggersMessages());
                      setFormError("");
                      setFormData((previous) => ({ ...previous, phone: event.target.value }));
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">Password</label>
                <PasswordField
                  value={formData.password}
                  onChange={(event) => {
                    dispatch(clearUniversityBloggersMessages());
                    setFormError("");
                    setFormData((previous) => ({ ...previous, password: event.target.value }));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  autoComplete="new-password"
                />
              </div>

              {formError || createError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError || createError}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCreateForm}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-70"
                >
                  {isCreating ? "Creating..." : "Create Blogger"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {credentials ? (
        <div className="uaams-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6">
            <h3 className="text-slate-900 mb-2">Blogger Credentials</h3>
            <p className="text-sm text-slate-600 mb-4">
              Credentials were sent via email. Save this backup as well.
            </p>

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <div className="text-xs text-slate-500">Username</div>
                <div className="text-sm text-slate-900">{credentials.username || "N/A"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Email</div>
                <div className="text-sm text-slate-900">{credentials.email || "N/A"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Password</div>
                <div className="text-sm text-slate-900">{credentials.password || "N/A"}</div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => dispatch(clearUniversityBloggerCredentials())}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.type === "delete" ? "Delete blogger?" : "Change blogger status?"}
        description={
          pendingAction?.type === "delete"
            ? `Delete blogger account for ${pendingAction?.blogger?.name || "this user"}?`
            : `Set ${pendingAction?.blogger?.name || "this blogger"} to ${
                pendingAction?.blogger?.status === "active" ? "inactive" : "active"
              }.`
        }
        confirmLabel={pendingAction?.type === "delete" ? "Delete Blogger" : "Update Status"}
        tone={pendingAction?.type === "delete" ? "danger" : "success"}
        isLoading={
          pendingAction?.type === "delete"
            ? isDeleting(pendingAction?.blogger?.id)
            : isStatusMutating(pendingAction?.blogger?.id)
        }
        onConfirm={() =>
          pendingAction?.type === "delete" ? handleDeleteBlogger() : handleToggleStatus()
        }
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}

function StatCard({ label, count }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-600">{label}</div>
      <div className="text-2xl text-slate-900">{count}</div>
    </div>
  );
}

export { BloggerManagement };
