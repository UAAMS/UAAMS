import { useEffect, useMemo, useState } from "react";
import { Calendar, Edit, Paperclip, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { readFileAsDataUrl } from "../../lib/fileDataUrl";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  createUniversityAnnouncement,
  deleteUniversityAnnouncement,
  fetchUniversityAnnouncementsManagement,
  updateUniversityAnnouncement,
} from "../../store/slices/universityAnnouncementsManagementSlice";

const initialFormState = {
  title: "",
  content: "",
  type: "general",
  category: "General",
  attachmentUrl: "",
  attachmentName: "",
  status: "draft",
  visibleFrom: "",
  expiresAt: "",
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

const toDateTimeInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
};

function UniversityAnnouncements() {
  const dispatch = useAppDispatch();
  const {
    items: announcements,
    loading: isLoading,
    error: loadError,
    saving: isSaving,
    mutationError,
    deletingIds,
  } = useAppSelector((state) => state.universityAnnouncementsManagement);
  const error = mutationError || loadError;

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [formData, setFormData] = useState(initialFormState);
  const [formError, setFormError] = useState("");
  const [deleteAnnouncementId, setDeleteAnnouncementId] = useState("");

  useEffect(() => {
    dispatch(fetchUniversityAnnouncementsManagement());
  }, [dispatch]);

  const filteredAnnouncements = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return announcements.filter((item) => {
      const matchesSearch =
        !search ||
        item.title.toLowerCase().includes(search) ||
        item.content.toLowerCase().includes(search) ||
        item.category.toLowerCase().includes(search);

      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesType = typeFilter === "all" || item.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [announcements, searchTerm, statusFilter, typeFilter]);

  const stats = useMemo(
    () => ({
      total: announcements.length,
      published: announcements.filter((item) => item.status === "published").length,
      draft: announcements.filter((item) => item.status === "draft").length,
    }),
    [announcements],
  );

  const openCreateForm = () => {
    setEditingId("");
    setFormData(initialFormState);
    setFormError("");
    setShowForm(true);
  };

  const openEditForm = (announcement) => {
    setEditingId(announcement.id);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      category: announcement.category,
      attachmentUrl: announcement.attachmentUrl || "",
      attachmentName: announcement.attachmentName || "",
      status: announcement.status,
      visibleFrom: toDateTimeInputValue(announcement.visibleFrom),
      expiresAt: toDateTimeInputValue(announcement.expiresAt),
    });
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId("");
    setFormData(initialFormState);
    setFormError("");
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setFormError("");

    try {
      if (formData.status === "published" && !formData.expiresAt) {
        setFormError("Visible until date and time is required for published announcements.");
        return;
      }

      if (formData.visibleFrom && formData.expiresAt) {
        const start = new Date(formData.visibleFrom);
        const end = new Date(formData.expiresAt);
        if (end.getTime() <= start.getTime()) {
          setFormError("Visible until must be after visible from.");
          return;
        }
      }

      if (editingId) {
        await dispatch(
          updateUniversityAnnouncement({
            announcementId: editingId,
            payload: formData,
          }),
        ).unwrap();
      } else {
        await dispatch(createUniversityAnnouncement(formData)).unwrap();
      }

      closeForm();
    } catch (saveError) {
      const message =
        typeof saveError === "string"
          ? saveError
          : saveError?.message || "Unable to save announcement.";
      setFormError(message);
    }
  };

  const handleAttachmentFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setFormData((previous) => ({
        ...previous,
        attachmentUrl: dataUrl,
        attachmentName: file.name,
      }));
      setFormError("");
    } catch (fileError) {
      setFormError(fileError?.message || "Unable to process selected file.");
    }
  };

  const isDeletingAnnouncement = (announcementId) => deletingIds.includes(String(announcementId));

  const handleDelete = async () => {
    if (!deleteAnnouncementId) return;
    try {
      await dispatch(deleteUniversityAnnouncement(deleteAnnouncementId)).unwrap();
      setDeleteAnnouncementId("");
    } catch {
      // Errors are surfaced from Redux state.
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="uaams-page-title">Announcements</h1>
          <p className="uaams-page-description">Manage university announcements and updates</p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create Announcement
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" count={stats.total} />
        <StatCard label="Published" count={stats.published} />
        <StatCard label="Drafts" count={stats.draft} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid md:grid-cols-3 gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search title, content, category"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="general">General</option>
            <option value="deadline">Deadline</option>
            <option value="merit-list">Merit List</option>
            <option value="urgent">Urgent</option>
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
          Loading announcements...
        </div>
      ) : null}

      {!isLoading && filteredAnnouncements.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No announcements found.
        </div>
      ) : null}

      {!isLoading && filteredAnnouncements.length > 0 ? (
        <div className="space-y-4">
          {filteredAnnouncements.map((announcement) => (
            <article
              key={announcement.id}
              className="rounded-lg border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {announcement.type}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      {announcement.category}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        announcement.status === "published"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {announcement.status}
                    </span>
                  </div>
                  <h3 className="text-slate-900 mb-2">{announcement.title}</h3>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{announcement.content}</p>
                  {announcement.attachmentUrl ? (
                    <a
                      href={announcement.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {announcement.attachmentName || "Open attached merit list file"}
                    </a>
                  ) : null}
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {announcement.status === "published" ? "Published" : "Created"}:{" "}
                      {formatDate(announcement.publishedAt || announcement.createdAt)}
                    </span>
                  </div>
                  {announcement.expiresAt ? (
                    <div className="mt-1 text-xs text-slate-500">
                      Visible until: {new Date(announcement.expiresAt).toLocaleString()}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditForm(announcement)}
                    className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteAnnouncementId(announcement.id)}
                    disabled={isDeletingAnnouncement(announcement.id)}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {showForm ? (
        <div className="uaams-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6">
            <h2 className="text-slate-900 mb-4">
              {editingId ? "Edit Announcement" : "Create Announcement"}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(event) =>
                    setFormData((previous) => ({ ...previous, title: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(event) =>
                    setFormData((previous) => ({ ...previous, content: event.target.value }))
                  }
                  rows={5}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Type</label>
                  <select
                    value={formData.type}
                    onChange={(event) =>
                      setFormData((previous) => ({ ...previous, type: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="general">General</option>
                    <option value="deadline">Deadline</option>
                    <option value="merit-list">Merit List</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(event) =>
                      setFormData((previous) => ({ ...previous, category: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Status</label>
                  <select
                    value={formData.status}
                    onChange={(event) =>
                      setFormData((previous) => ({ ...previous, status: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">
                    Visible From
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.visibleFrom}
                    onChange={(event) =>
                      setFormData((previous) => ({ ...previous, visibleFrom: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">
                    Visible Until
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(event) =>
                      setFormData((previous) => ({ ...previous, expiresAt: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={formData.status === "published"}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-700">
                  Merit List / Attachment File (Optional)
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleAttachmentFileChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formData.attachmentName ? (
                  <p className="mt-1 text-xs text-slate-500">Selected: {formData.attachmentName}</p>
                ) : null}
                {formData.attachmentUrl ? (
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((previous) => ({
                        ...previous,
                        attachmentUrl: "",
                        attachmentName: "",
                      }))
                    }
                    className="mt-2 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    Remove Attachment
                  </button>
                ) : null}
              </div>

              {formError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </p>
              ) : null}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-70"
                >
                  {isSaving ? "Saving..." : "Save Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(deleteAnnouncementId)}
        title="Delete announcement?"
        description="This announcement will be removed from the university portal."
        confirmLabel="Delete Announcement"
        isLoading={deleteAnnouncementId ? isDeletingAnnouncement(deleteAnnouncementId) : false}
        onConfirm={handleDelete}
        onCancel={() => setDeleteAnnouncementId("")}
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

export { UniversityAnnouncements };
