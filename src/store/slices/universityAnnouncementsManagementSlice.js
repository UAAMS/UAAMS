import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

const normalizeAnnouncement = (item) => ({
  id: String(item?._id || item?.id || ""),
  title: item?.title || "",
  content: item?.content || "",
  type: item?.type || "general",
  category: item?.category || "General",
  attachmentUrl: item?.attachmentUrl || "",
  attachmentName: item?.attachmentName || "",
  status: item?.status || "draft",
  visibleFrom: item?.visibleFrom || "",
  expiresAt: item?.expiresAt || "",
  publishedAt: item?.publishedAt || null,
  createdAt: item?.createdAt || null,
  updatedAt: item?.updatedAt || null,
});

const sortByRecent = (items = []) =>
  items
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.publishedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.publishedAt || a.createdAt || 0).getTime(),
    );

export const fetchUniversityAnnouncementsManagement = createAsyncThunk(
  "universityAnnouncementsManagement/fetchUniversityAnnouncementsManagement",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/universities/me/announcements?limit=200");
      const items = response?.data?.announcements || [];
      return sortByRecent(items.map(normalizeAnnouncement));
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load announcements.");
    }
  },
);

export const createUniversityAnnouncement = createAsyncThunk(
  "universityAnnouncementsManagement/createUniversityAnnouncement",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await api.post("/universities/me/announcements", payload);
      return response?.data?.announcement || null;
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to save announcement.");
    }
  },
);

export const updateUniversityAnnouncement = createAsyncThunk(
  "universityAnnouncementsManagement/updateUniversityAnnouncement",
  async ({ announcementId, payload }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/universities/me/announcements/${announcementId}`, payload);
      return response?.data?.announcement || null;
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to save announcement.");
    }
  },
);

export const deleteUniversityAnnouncement = createAsyncThunk(
  "universityAnnouncementsManagement/deleteUniversityAnnouncement",
  async (announcementId, { rejectWithValue }) => {
    try {
      await api.del(`/universities/me/announcements/${announcementId}`);
      return String(announcementId);
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to delete announcement.");
    }
  },
);

const universityAnnouncementsManagementSlice = createSlice({
  name: "universityAnnouncementsManagement",
  initialState: {
    items: [],
    loading: false,
    error: "",
    saving: false,
    mutationError: "",
    deletingIds: [],
  },
  reducers: {
    clearUniversityAnnouncementsManagementErrors(state) {
      state.error = "";
      state.mutationError = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUniversityAnnouncementsManagement.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchUniversityAnnouncementsManagement.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchUniversityAnnouncementsManagement.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Unable to load announcements.";
      })
      .addCase(createUniversityAnnouncement.pending, (state) => {
        state.saving = true;
        state.mutationError = "";
      })
      .addCase(createUniversityAnnouncement.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload) {
          const next = normalizeAnnouncement(action.payload);
          state.items = sortByRecent([next, ...state.items.filter((item) => item.id !== next.id)]);
        }
      })
      .addCase(createUniversityAnnouncement.rejected, (state, action) => {
        state.saving = false;
        state.mutationError = action.payload || "Unable to save announcement.";
      })
      .addCase(updateUniversityAnnouncement.pending, (state) => {
        state.saving = true;
        state.mutationError = "";
      })
      .addCase(updateUniversityAnnouncement.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload) {
          const next = normalizeAnnouncement(action.payload);
          state.items = sortByRecent(
            state.items.map((item) => (item.id === next.id ? { ...item, ...next } : item)),
          );
        }
      })
      .addCase(updateUniversityAnnouncement.rejected, (state, action) => {
        state.saving = false;
        state.mutationError = action.payload || "Unable to save announcement.";
      })
      .addCase(deleteUniversityAnnouncement.pending, (state, action) => {
        state.deletingIds.push(String(action.meta.arg || ""));
        state.mutationError = "";
      })
      .addCase(deleteUniversityAnnouncement.fulfilled, (state, action) => {
        const id = String(action.payload);
        state.deletingIds = state.deletingIds.filter((item) => item !== id);
        state.items = state.items.filter((item) => item.id !== id);
      })
      .addCase(deleteUniversityAnnouncement.rejected, (state, action) => {
        const id = String(action.meta.arg || "");
        state.deletingIds = state.deletingIds.filter((item) => item !== id);
        state.mutationError = action.payload || "Unable to delete announcement.";
      });
  },
});

export const { clearUniversityAnnouncementsManagementErrors } =
  universityAnnouncementsManagementSlice.actions;
export default universityAnnouncementsManagementSlice.reducer;
