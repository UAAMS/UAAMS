import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

const normalizeUniversity = (item) => ({
  id: String(item?._id || item?.id || ""),
  name: item?.profile?.universityName || item?.name || "University",
  email: item?.email || item?.profile?.email || "",
  location: item?.location || item?.profile?.city || "N/A",
  representative: item?.representativeName || item?.profile?.representativeName || "N/A",
  website: item?.website || item?.profile?.website || "",
  established: item?.profile?.established || item?.establishedYear || "",
  approvalStatus: item?.approvalStatus || "pending",
  status: item?.status || "active",
  createdAt: item?.createdAt || null,
  bloggerCount: Number(item?.bloggerCount || 0),
  applicationStats: item?.applicationStats || {
    total: 0,
    pending: 0,
    underReview: 0,
    accepted: 0,
    rejected: 0,
    assigned: 0,
  },
});

const byNewest = (a, b) =>
  new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime();

const removeMutationKey = (state, key) => {
  state.mutatingKeys = state.mutatingKeys.filter((item) => item !== key);
};

export const fetchAdminUniversitiesManagement = createAsyncThunk(
  "adminUniversityManagement/fetchAdminUniversitiesManagement",
  async ({ searchTerm = "", statusFilter = "all" } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (searchTerm.trim()) params.set("search", searchTerm.trim());

      const response = await api.get(`/admin/universities/management?${params.toString()}`);
      const items = response?.data?.items || [];
      return {
        items: items.map(normalizeUniversity).sort(byNewest),
        searchTerm,
        statusFilter,
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load universities.");
    }
  },
);

export const reviewAdminUniversity = createAsyncThunk(
  "adminUniversityManagement/reviewAdminUniversity",
  async ({ universityId, approvalStatus }, { rejectWithValue }) => {
    try {
      await api.patch(`/admin/universities/${universityId}/review`, { approvalStatus });
      return {
        universityId: String(universityId),
        approvalStatus,
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to update approval status.");
    }
  },
);

export const toggleAdminUniversityStatus = createAsyncThunk(
  "adminUniversityManagement/toggleAdminUniversityStatus",
  async ({ universityId, status }, { rejectWithValue }) => {
    try {
      await api.patch(`/admin/users/${universityId}/status`, { status });
      return {
        universityId: String(universityId),
        status,
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to update university status.");
    }
  },
);

export const deleteAdminUniversity = createAsyncThunk(
  "adminUniversityManagement/deleteAdminUniversity",
  async (universityId, { rejectWithValue }) => {
    try {
      await api.del(`/admin/users/${universityId}`);
      return String(universityId);
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to delete university.");
    }
  },
);

const reviewMutationKey = (universityId) => `${String(universityId)}-review`;
const statusMutationKey = (universityId) => `${String(universityId)}-status`;
const deleteMutationKey = (universityId) => `${String(universityId)}-delete`;

const adminUniversityManagementSlice = createSlice({
  name: "adminUniversityManagement",
  initialState: {
    items: [],
    loading: false,
    error: "",
    mutationError: "",
    mutatingKeys: [],
    lastQuery: {
      searchTerm: "",
      statusFilter: "all",
    },
  },
  reducers: {
    clearAdminUniversityManagementErrors(state) {
      state.error = "";
      state.mutationError = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminUniversitiesManagement.pending, (state) => {
        state.loading = true;
        state.error = "";
        state.mutationError = "";
      })
      .addCase(fetchAdminUniversitiesManagement.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.lastQuery = {
          searchTerm: action.payload.searchTerm,
          statusFilter: action.payload.statusFilter,
        };
      })
      .addCase(fetchAdminUniversitiesManagement.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Unable to load universities.";
      })
      .addCase(reviewAdminUniversity.pending, (state, action) => {
        const key = reviewMutationKey(action.meta.arg?.universityId);
        state.mutatingKeys.push(key);
        state.mutationError = "";
      })
      .addCase(reviewAdminUniversity.fulfilled, (state, action) => {
        const { universityId, approvalStatus } = action.payload;
        const key = reviewMutationKey(universityId);
        removeMutationKey(state, key);
        state.items = state.items.map((item) =>
          item.id === universityId ? { ...item, approvalStatus } : item,
        );
      })
      .addCase(reviewAdminUniversity.rejected, (state, action) => {
        const key = reviewMutationKey(action.meta.arg?.universityId);
        removeMutationKey(state, key);
        state.mutationError = action.payload || "Unable to update approval status.";
      })
      .addCase(toggleAdminUniversityStatus.pending, (state, action) => {
        const key = statusMutationKey(action.meta.arg?.universityId);
        state.mutatingKeys.push(key);
        state.mutationError = "";
      })
      .addCase(toggleAdminUniversityStatus.fulfilled, (state, action) => {
        const { universityId, status } = action.payload;
        const key = statusMutationKey(universityId);
        removeMutationKey(state, key);
        state.items = state.items.map((item) =>
          item.id === universityId ? { ...item, status } : item,
        );
      })
      .addCase(toggleAdminUniversityStatus.rejected, (state, action) => {
        const key = statusMutationKey(action.meta.arg?.universityId);
        removeMutationKey(state, key);
        state.mutationError = action.payload || "Unable to update university status.";
      })
      .addCase(deleteAdminUniversity.pending, (state, action) => {
        const key = deleteMutationKey(action.meta.arg);
        state.mutatingKeys.push(key);
        state.mutationError = "";
      })
      .addCase(deleteAdminUniversity.fulfilled, (state, action) => {
        const universityId = String(action.payload);
        const key = deleteMutationKey(universityId);
        removeMutationKey(state, key);
        state.items = state.items.filter((item) => item.id !== universityId);
      })
      .addCase(deleteAdminUniversity.rejected, (state, action) => {
        const key = deleteMutationKey(action.meta.arg);
        removeMutationKey(state, key);
        state.mutationError = action.payload || "Unable to delete university.";
      });
  },
});

export const { clearAdminUniversityManagementErrors } = adminUniversityManagementSlice.actions;
export default adminUniversityManagementSlice.reducer;
