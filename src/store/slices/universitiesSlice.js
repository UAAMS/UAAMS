import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

const normalizeUniversityListItem = (item) => ({
  id: String(item?.id || item?._id || ""),
  name: item?.name || "University",
  type: item?.type || "public",
  location: item?.location || "Pakistan",
  email: item?.email || "",
  website: item?.website || "",
  applicationFee: Number(item?.applicationFee || 0),
  programs: Array.isArray(item?.programs) ? item.programs : [],
});

const UNIVERSITIES_CACHE_MS = 60 * 1000;

export const fetchUniversities = createAsyncThunk(
  "universities/fetchUniversities",
  async (_arg, { rejectWithValue }) => {
    try {
      const response = await api.get("/universities");
      const items = response?.data?.items || [];
      return items.map(normalizeUniversityListItem);
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load universities.");
    }
  },
  {
    condition: (arg, { getState }) => {
      const state = getState()?.universities;
      if (!state) return true;
      if (state.loadingList) return false;

      const force = Boolean(arg?.force);
      if (force) return true;
      if (!state.listLoadedAt || state.list.length === 0) return true;

      const loadedAtTime = new Date(state.listLoadedAt).getTime();
      if (Number.isNaN(loadedAtTime)) return true;
      return Date.now() - loadedAtTime > UNIVERSITIES_CACHE_MS;
    },
  },
);

export const fetchUniversityById = createAsyncThunk(
  "universities/fetchUniversityById",
  async (universityId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/universities/${universityId}`);
      return response?.data?.university || null;
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load university details.");
    }
  },
);

const universitiesSlice = createSlice({
  name: "universities",
  initialState: {
    list: [],
    loadingList: false,
    listError: "",
    listLoadedAt: null,
    byId: {},
    loadingById: {},
    errorById: {},
  },
  reducers: {
    clearUniversitiesErrors(state) {
      state.listError = "";
      state.errorById = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUniversities.pending, (state) => {
        state.loadingList = true;
        state.listError = "";
      })
      .addCase(fetchUniversities.fulfilled, (state, action) => {
        state.loadingList = false;
        state.list = action.payload;
        state.listLoadedAt = new Date().toISOString();
      })
      .addCase(fetchUniversities.rejected, (state, action) => {
        state.loadingList = false;
        state.listError = action.payload || "Unable to load universities.";
      })
      .addCase(fetchUniversityById.pending, (state, action) => {
        const key = String(action.meta.arg || "");
        state.loadingById[key] = true;
        state.errorById[key] = "";
      })
      .addCase(fetchUniversityById.fulfilled, (state, action) => {
        const item = action.payload;
        const key = String(item?.id || "");
        if (key) {
          state.byId[key] = item;
          state.loadingById[key] = false;
        }
      })
      .addCase(fetchUniversityById.rejected, (state, action) => {
        const key = String(action.meta.arg || "");
        state.loadingById[key] = false;
        state.errorById[key] = action.payload || "Unable to load university details.";
      });
  },
});

export const { clearUniversitiesErrors } = universitiesSlice.actions;
export default universitiesSlice.reducer;
