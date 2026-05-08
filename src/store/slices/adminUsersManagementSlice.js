import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

const normalizeStudent = (item) => ({
  id: String(item?._id || item?.id || ""),
  name: item?.name || "",
  email: item?.email || "",
  phone: item?.phone || item?.profile?.phone || "",
  city: item?.location || item?.profile?.city || "",
  status: item?.status || "active",
  createdAt: item?.createdAt || null,
  profile: item?.profile || null,
  applicationStats: item?.applicationStats || {
    total: 0,
    pending: 0,
    underReview: 0,
    accepted: 0,
    rejected: 0,
    assigned: 0,
  },
});

const normalizeBlogger = (item) => ({
  id: String(item?._id || item?.id || ""),
  name: item?.name || "",
  email: item?.email || "",
  username: item?.username || "",
  phone: item?.phone || "",
  status: item?.status || "active",
  managedUniversity:
    typeof item?.managedUniversity === "object"
      ? item.managedUniversity?.name || ""
      : item?.managedUniversity || "",
  createdAt: item?.createdAt || null,
  postStats: item?.postStats || {
    totalPosts: 0,
    publishedPosts: 0,
    draftPosts: 0,
    totalViews: 0,
  },
});

const createListState = () => ({
  items: [],
  loading: false,
  error: "",
  mutationError: "",
  mutatingKeys: [],
  lastQuery: {},
});

const removeMutationKey = (stateNode, key) => {
  stateNode.mutatingKeys = stateNode.mutatingKeys.filter((item) => item !== key);
};

const statusMutationKey = (id) => `${String(id)}-status`;
const deleteMutationKey = (id) => `${String(id)}-delete`;

export const fetchAdminStudentsManagement = createAsyncThunk(
  "adminUsersManagement/fetchAdminStudentsManagement",
  async ({ searchTerm = "" } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (searchTerm.trim()) params.set("search", searchTerm.trim());

      const response = await api.get(`/admin/students/management?${params.toString()}`);
      const items = response?.data?.items || [];
      return {
        items: items.map(normalizeStudent),
        searchTerm,
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load students.");
    }
  },
);

export const toggleAdminStudentStatus = createAsyncThunk(
  "adminUsersManagement/toggleAdminStudentStatus",
  async ({ studentId, status }, { rejectWithValue }) => {
    try {
      await api.patch(`/admin/users/${studentId}/status`, { status });
      return {
        studentId: String(studentId),
        status,
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to update student status.");
    }
  },
);

export const deleteAdminStudent = createAsyncThunk(
  "adminUsersManagement/deleteAdminStudent",
  async (studentId, { rejectWithValue }) => {
    try {
      await api.del(`/admin/users/${studentId}`);
      return String(studentId);
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to delete student.");
    }
  },
);

export const fetchAdminBloggersManagement = createAsyncThunk(
  "adminUsersManagement/fetchAdminBloggersManagement",
  async ({ searchTerm = "", statusFilter = "all" } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await api.get(`/admin/bloggers/management?${params.toString()}`);
      const items = response?.data?.items || [];
      return {
        items: items.map(normalizeBlogger),
        searchTerm,
        statusFilter,
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load bloggers.");
    }
  },
);

export const toggleAdminBloggerStatus = createAsyncThunk(
  "adminUsersManagement/toggleAdminBloggerStatus",
  async ({ bloggerId, status }, { rejectWithValue }) => {
    try {
      await api.patch(`/admin/users/${bloggerId}/status`, { status });
      return {
        bloggerId: String(bloggerId),
        status,
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to update blogger status.");
    }
  },
);

export const deleteAdminBlogger = createAsyncThunk(
  "adminUsersManagement/deleteAdminBlogger",
  async (bloggerId, { rejectWithValue }) => {
    try {
      await api.del(`/admin/users/${bloggerId}`);
      return String(bloggerId);
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to delete blogger.");
    }
  },
);

const adminUsersManagementSlice = createSlice({
  name: "adminUsersManagement",
  initialState: {
    students: createListState(),
    bloggers: createListState(),
  },
  reducers: {
    clearAdminUsersManagementErrors(state) {
      state.students.error = "";
      state.students.mutationError = "";
      state.bloggers.error = "";
      state.bloggers.mutationError = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminStudentsManagement.pending, (state) => {
        state.students.loading = true;
        state.students.error = "";
        state.students.mutationError = "";
      })
      .addCase(fetchAdminStudentsManagement.fulfilled, (state, action) => {
        state.students.loading = false;
        state.students.items = action.payload.items;
        state.students.lastQuery = { searchTerm: action.payload.searchTerm };
      })
      .addCase(fetchAdminStudentsManagement.rejected, (state, action) => {
        state.students.loading = false;
        state.students.error = action.payload || "Unable to load students.";
      })
      .addCase(toggleAdminStudentStatus.pending, (state, action) => {
        const key = statusMutationKey(action.meta.arg?.studentId);
        state.students.mutatingKeys.push(key);
        state.students.mutationError = "";
      })
      .addCase(toggleAdminStudentStatus.fulfilled, (state, action) => {
        const { studentId, status } = action.payload;
        const key = statusMutationKey(studentId);
        removeMutationKey(state.students, key);
        state.students.items = state.students.items.map((item) =>
          item.id === studentId ? { ...item, status } : item,
        );
      })
      .addCase(toggleAdminStudentStatus.rejected, (state, action) => {
        const key = statusMutationKey(action.meta.arg?.studentId);
        removeMutationKey(state.students, key);
        state.students.mutationError = action.payload || "Unable to update student status.";
      })
      .addCase(deleteAdminStudent.pending, (state, action) => {
        const key = deleteMutationKey(action.meta.arg);
        state.students.mutatingKeys.push(key);
        state.students.mutationError = "";
      })
      .addCase(deleteAdminStudent.fulfilled, (state, action) => {
        const id = String(action.payload);
        const key = deleteMutationKey(id);
        removeMutationKey(state.students, key);
        state.students.items = state.students.items.filter((item) => item.id !== id);
      })
      .addCase(deleteAdminStudent.rejected, (state, action) => {
        const key = deleteMutationKey(action.meta.arg);
        removeMutationKey(state.students, key);
        state.students.mutationError = action.payload || "Unable to delete student.";
      })
      .addCase(fetchAdminBloggersManagement.pending, (state) => {
        state.bloggers.loading = true;
        state.bloggers.error = "";
        state.bloggers.mutationError = "";
      })
      .addCase(fetchAdminBloggersManagement.fulfilled, (state, action) => {
        state.bloggers.loading = false;
        state.bloggers.items = action.payload.items;
        state.bloggers.lastQuery = {
          searchTerm: action.payload.searchTerm,
          statusFilter: action.payload.statusFilter,
        };
      })
      .addCase(fetchAdminBloggersManagement.rejected, (state, action) => {
        state.bloggers.loading = false;
        state.bloggers.error = action.payload || "Unable to load bloggers.";
      })
      .addCase(toggleAdminBloggerStatus.pending, (state, action) => {
        const key = statusMutationKey(action.meta.arg?.bloggerId);
        state.bloggers.mutatingKeys.push(key);
        state.bloggers.mutationError = "";
      })
      .addCase(toggleAdminBloggerStatus.fulfilled, (state, action) => {
        const { bloggerId, status } = action.payload;
        const key = statusMutationKey(bloggerId);
        removeMutationKey(state.bloggers, key);
        state.bloggers.items = state.bloggers.items.map((item) =>
          item.id === bloggerId ? { ...item, status } : item,
        );
      })
      .addCase(toggleAdminBloggerStatus.rejected, (state, action) => {
        const key = statusMutationKey(action.meta.arg?.bloggerId);
        removeMutationKey(state.bloggers, key);
        state.bloggers.mutationError = action.payload || "Unable to update blogger status.";
      })
      .addCase(deleteAdminBlogger.pending, (state, action) => {
        const key = deleteMutationKey(action.meta.arg);
        state.bloggers.mutatingKeys.push(key);
        state.bloggers.mutationError = "";
      })
      .addCase(deleteAdminBlogger.fulfilled, (state, action) => {
        const id = String(action.payload);
        const key = deleteMutationKey(id);
        removeMutationKey(state.bloggers, key);
        state.bloggers.items = state.bloggers.items.filter((item) => item.id !== id);
      })
      .addCase(deleteAdminBlogger.rejected, (state, action) => {
        const key = deleteMutationKey(action.meta.arg);
        removeMutationKey(state.bloggers, key);
        state.bloggers.mutationError = action.payload || "Unable to delete blogger.";
      });
  },
});

export const { clearAdminUsersManagementErrors } = adminUsersManagementSlice.actions;
export default adminUsersManagementSlice.reducer;
