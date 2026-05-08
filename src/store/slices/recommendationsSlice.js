import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

const normalizeRecommendation = (item) => ({
  id: String(item?.id || item?._id || ""),
  name: item?.name || "University",
  location: item?.location || "Pakistan",
  programs: Array.isArray(item?.programs) ? item.programs : [],
  programRecommendations: Array.isArray(item?.programRecommendations)
    ? item.programRecommendations
    : [],
  feeRange: item?.feeRange || "Contact university",
  requiredAggregate: Number(item?.requiredAggregate || 0),
  deadline: item?.deadline || "Not announced",
  matchScore: Number(item?.matchScore || 0),
  type: String(item?.type || "public"),
  applicationFee: Number(item?.applicationFee || 0),
});

const RECOMMENDATIONS_CACHE_MS = 60 * 1000;

export const fetchRecommendations = createAsyncThunk(
  "recommendations/fetchRecommendations",
  async (_arg, { rejectWithValue }) => {
    try {
      const response = await api.get("/students/recommendations");
      return {
        items: (response?.data?.recommendations || []).map(normalizeRecommendation),
        profileBasis: response?.data?.profileBasis || {},
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load recommendations.");
    }
  },
  {
    condition: (arg, { getState }) => {
      const state = getState()?.recommendations;
      if (!state) return true;
      if (state.loading) return false;

      const force = Boolean(arg?.force);
      if (force) return true;
      if (!state.loadedAt) return true;

      const loadedAtTime = new Date(state.loadedAt).getTime();
      if (Number.isNaN(loadedAtTime)) return true;
      return Date.now() - loadedAtTime > RECOMMENDATIONS_CACHE_MS;
    },
  },
);

const recommendationsSlice = createSlice({
  name: "recommendations",
  initialState: {
    items: [],
    profileBasis: {},
    loading: false,
    error: "",
    loadedAt: null,
  },
  reducers: {
    clearRecommendationsError(state) {
      state.error = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecommendations.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchRecommendations.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.profileBasis = action.payload.profileBasis;
        state.loadedAt = new Date().toISOString();
      })
      .addCase(fetchRecommendations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Unable to load recommendations.";
      });
  },
});

export const { clearRecommendationsError } = recommendationsSlice.actions;
export default recommendationsSlice.reducer;
