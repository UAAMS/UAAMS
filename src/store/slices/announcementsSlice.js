import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

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

const normalizeAnnouncement = (item) => ({
  id: String(item?._id || item?.id || ""),
  university:
    item?.universityProfile?.universityName ||
    (typeof item?.university === "object" ? item?.university?.name : "") ||
    "University",
  universityLogo: item?.universityProfile?.logo || "",
  representativeName: item?.universityProfile?.representativeName || "",
  representativeProfilePicture: item?.universityProfile?.representativeProfilePicture || "",
  title: item?.title || "",
  content: item?.content || "",
  date: formatDate(item?.publishedAt || item?.createdAt),
  type: item?.type || "general",
  category: item?.category || "General",
  attachmentUrl: item?.attachmentUrl || "",
  attachmentName: item?.attachmentName || "",
  visibleFrom: item?.visibleFrom || "",
  expiresAt: item?.expiresAt || "",
});

export const fetchStudentAnnouncements = createAsyncThunk(
  "announcements/fetchStudentAnnouncements",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/students/me/announcements?limit=200");
      const items = response?.data?.announcements || [];
      return items.map(normalizeAnnouncement);
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load announcements.");
    }
  },
);

const announcementsSlice = createSlice({
  name: "announcements",
  initialState: {
    items: [],
    loading: false,
    error: "",
    loadedAt: null,
  },
  reducers: {
    clearAnnouncementsError(state) {
      state.error = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStudentAnnouncements.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchStudentAnnouncements.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        state.loadedAt = new Date().toISOString();
      })
      .addCase(fetchStudentAnnouncements.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Unable to load announcements.";
      });
  },
});

export const { clearAnnouncementsError } = announcementsSlice.actions;
export default announcementsSlice.reducer;
