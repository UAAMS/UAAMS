import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

const createDashboardState = () => ({
  data: null,
  loading: false,
  error: "",
  loadedAt: null,
});

export const fetchStudentDashboard = createAsyncThunk(
  "dashboards/fetchStudentDashboard",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/students/me/dashboard");
      return response?.data || null;
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load student dashboard.");
    }
  },
);

export const fetchUniversityDashboard = createAsyncThunk(
  "dashboards/fetchUniversityDashboard",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/universities/me/dashboard");
      return response?.data || null;
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load university dashboard.");
    }
  },
);

export const fetchAdminDashboard = createAsyncThunk(
  "dashboards/fetchAdminDashboard",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/admin/stats");
      return response?.data || null;
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load admin dashboard.");
    }
  },
);

export const fetchBloggerDashboard = createAsyncThunk(
  "dashboards/fetchBloggerDashboard",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/blogger/me/dashboard");
      return response?.data || null;
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load blogger dashboard.");
    }
  },
);

const withPending = (stateNode) => {
  stateNode.loading = true;
  stateNode.error = "";
};

const withFulfilled = (stateNode, payload) => {
  stateNode.loading = false;
  stateNode.data = payload;
  stateNode.loadedAt = new Date().toISOString();
};

const withRejected = (stateNode, payload, fallback) => {
  stateNode.loading = false;
  stateNode.error = payload || fallback;
};

const dashboardsSlice = createSlice({
  name: "dashboards",
  initialState: {
    student: createDashboardState(),
    university: createDashboardState(),
    admin: createDashboardState(),
    blogger: createDashboardState(),
  },
  reducers: {
    clearDashboardErrors(state) {
      state.student.error = "";
      state.university.error = "";
      state.admin.error = "";
      state.blogger.error = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStudentDashboard.pending, (state) => withPending(state.student))
      .addCase(fetchStudentDashboard.fulfilled, (state, action) =>
        withFulfilled(state.student, action.payload),
      )
      .addCase(fetchStudentDashboard.rejected, (state, action) =>
        withRejected(state.student, action.payload, "Unable to load student dashboard."),
      )
      .addCase(fetchUniversityDashboard.pending, (state) => withPending(state.university))
      .addCase(fetchUniversityDashboard.fulfilled, (state, action) =>
        withFulfilled(state.university, action.payload),
      )
      .addCase(fetchUniversityDashboard.rejected, (state, action) =>
        withRejected(state.university, action.payload, "Unable to load university dashboard."),
      )
      .addCase(fetchAdminDashboard.pending, (state) => withPending(state.admin))
      .addCase(fetchAdminDashboard.fulfilled, (state, action) =>
        withFulfilled(state.admin, action.payload),
      )
      .addCase(fetchAdminDashboard.rejected, (state, action) =>
        withRejected(state.admin, action.payload, "Unable to load admin dashboard."),
      )
      .addCase(fetchBloggerDashboard.pending, (state) => withPending(state.blogger))
      .addCase(fetchBloggerDashboard.fulfilled, (state, action) =>
        withFulfilled(state.blogger, action.payload),
      )
      .addCase(fetchBloggerDashboard.rejected, (state, action) =>
        withRejected(state.blogger, action.payload, "Unable to load blogger dashboard."),
      );
  },
});

export const { clearDashboardErrors } = dashboardsSlice.actions;
export default dashboardsSlice.reducer;
