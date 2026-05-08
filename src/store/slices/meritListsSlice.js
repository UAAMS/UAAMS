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

const normalizeEntry = (entry) => ({
  id: String(entry?.id || entry?._id || ""),
  rollNumber: entry?.rollNumber || "N/A",
  studentName: entry?.studentName || "Student",
  program: entry?.program || "",
  aggregate: Number(entry?.aggregate || 0),
  status: entry?.status || "not-selected",
  meritPosition: Number(entry?.meritPosition || 0),
  isCurrentStudent: Boolean(entry?.isCurrentStudent),
});

const normalizeMeritList = (item) => ({
  id: String(item?.id || item?._id || ""),
  universityId: String(item?.universityId || ""),
  university: item?.university || "University",
  program: item?.program || "Program",
  session: item?.session || "Session",
  listNumber: Number(item?.listNumber || 1),
  publishedDate: formatDate(item?.publishedDate),
  totalSeats: Number(item?.totalSeats || 0),
  entries: Array.isArray(item?.entries) ? item.entries.map(normalizeEntry) : [],
});

export const fetchStudentMeritLists = createAsyncThunk(
  "meritLists/fetchStudentMeritLists",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/students/me/merit-lists?limit=200");
      const items = response?.data?.meritLists || [];
      return items.map(normalizeMeritList);
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load merit lists.");
    }
  },
);

const meritListsSlice = createSlice({
  name: "meritLists",
  initialState: {
    items: [],
    loading: false,
    error: "",
    loadedAt: null,
  },
  reducers: {
    clearMeritListsError(state) {
      state.error = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStudentMeritLists.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchStudentMeritLists.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
        state.loadedAt = new Date().toISOString();
      })
      .addCase(fetchStudentMeritLists.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Unable to load merit lists.";
      });
  },
});

export const { clearMeritListsError } = meritListsSlice.actions;
export default meritListsSlice.reducer;
