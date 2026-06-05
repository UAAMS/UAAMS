import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

const normalizeRecommendation = (item) => ({
  id: String(item?.id || item?._id || ""),
  name: item?.name || "University",
  location: item?.location || "Pakistan",
  programs: Array.isArray(item?.programs) ? item.programs : [],
  programRecommendations: Array.isArray(item?.programRecommendations)
    ? item.programRecommendations.map((program) => ({
        ...program,
        minimumFscPercentage: Number(program?.minimumFscPercentage || 0),
        minimumMatricPercentage: Number(program?.minimumMatricPercentage || 0),
      }))
    : [],
  feeRange: item?.feeRange || "Contact university",
  requiredAggregate: Number(item?.requiredAggregate || 0),
  deadline: item?.deadline || "Not announced",
  matchScore: Number(item?.matchScore || 0),
  type: String(item?.type || "public"),
  applicationFee: Number(item?.applicationFee || 0),
  minimumFscPercentage: Number(item?.minimumFscPercentage || 0),
  minimumMatricPercentage: Number(item?.minimumMatricPercentage || 0),
  logo: item?.logo || "",
  representativeName: item?.representativeName || "",
  representativeProfilePicture: item?.representativeProfilePicture || "",
});

const normalizeModelRecommendation = (item) => ({
  id: String(item?.mongo_id || item?.program || item?.program_name || ""),
  program: item?.program || "Program",
  campus: item?.campus || "",
  programName: item?.program_name || item?.program || "Program",
  closingMerit: Number(item?.closing_merit || 0),
  predictedAggregate: Number(item?.predicted_aggr || 0),
  estimatedTestScore: Number(item?.estimated_test_score || 0),
  difference: Number(item?.difference || 0),
  percentDifference: Number(item?.percent_difference || 0),
  chance: item?.chance || "",
  recommendationText: item?.recommendation_text || "",
  colorCode: item?.color_code || "#0f766e",
  sourceLink: item?.source_link || "",
  universityId: item?.university_id || "",
  universityName: item?.university_name || "",
  applyProgramName: item?.apply_program_name || item?.program_name || item?.program || "",
  canApply: item?.can_apply !== false,
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

export const fetchModelRecommendations = createAsyncThunk(
  "recommendations/fetchModelRecommendations",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/students/recommendations/model");
      return {
        items: (response?.data?.recommendations || []).map(normalizeModelRecommendation),
        userInput: response?.data?.userInput || {},
        estimationFormula: response?.data?.estimationFormula || "",
        summary: response?.data?.summary || null,
        message: response?.data?.message || "",
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load model recommendations.");
    }
  },
);

const recommendationsSlice = createSlice({
  name: "recommendations",
  initialState: {
    items: [],
    profileBasis: {},
    modelItems: [],
    modelUserInput: {},
    modelSummary: null,
    modelMessage: "",
    modelEstimationFormula: "",
    modelLoading: false,
    modelError: "",
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
      })
      .addCase(fetchModelRecommendations.pending, (state) => {
        state.modelLoading = true;
        state.modelError = "";
      })
      .addCase(fetchModelRecommendations.fulfilled, (state, action) => {
        state.modelLoading = false;
        state.modelItems = action.payload.items;
        state.modelUserInput = action.payload.userInput;
        state.modelSummary = action.payload.summary;
        state.modelMessage = action.payload.message;
        state.modelEstimationFormula = action.payload.estimationFormula;
      })
      .addCase(fetchModelRecommendations.rejected, (state, action) => {
        state.modelLoading = false;
        state.modelError = action.payload || "Unable to load model recommendations.";
      });
  },
});

export const { clearRecommendationsError } = recommendationsSlice.actions;
export default recommendationsSlice.reducer;
