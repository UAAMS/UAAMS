import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const normalizeApplication = (item) => ({
  id: String(item?._id || item?.id || ""),
  applicationCode: item?.applicationCode || "N/A",
  universityId: String(item?.university?._id || item?.university?.id || item?.university || ""),
  university: item?.universityProfile?.universityName || item?.university?.name || "University",
  universityLogo: item?.universityProfile?.logo || item?.universityLogo || "",
  program: item?.program || "Program",
  appliedDate: formatDate(item?.appliedAt || item?.createdAt),
  lastUpdate: formatDate(item?.updatedAt || item?.createdAt),
  createdAt: item?.createdAt || null,
  updatedAt: item?.updatedAt || null,
  status: item?.status || "not-submitted",
  paymentStatus: item?.payment?.status || "unpaid",
  rollNumberSlip: item?.rollNumber?.slipFileUrl || "",
  rollNumberSlipName: item?.rollNumber?.slipFileName || "",
  eligibleForAdmissionLetter: item?.eligibleForAdmissionLetter !== false,
  admissionLetter: item?.admissionLetter?.fileUrl || "",
  admissionLetterName: item?.admissionLetter?.fileName || "",
  raw: item,
});

export const fetchStudentApplications = createAsyncThunk(
  "applications/fetchStudentApplications",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/applications/me");

      const applications = (response?.data?.applications || []).map(normalizeApplication);
      return { applications, templateSubmissions: [] };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load applications.");
    }
  },
);

export const fetchUniversityApplications = createAsyncThunk(
  "applications/fetchUniversityApplications",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/applications/university/me?limit=200");
      const applications = (response?.data?.applications || []).map((item) => ({
        ...item,
        id: String(item?._id || item?.id || ""),
      }));
      return applications;
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load university applications.");
    }
  },
);

export const fetchApplicationById = createAsyncThunk(
  "applications/fetchApplicationById",
  async (applicationId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/applications/${applicationId}`);
      return response?.data?.application || null;
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load application.");
    }
  },
);

export const deleteDraftApplication = createAsyncThunk(
  "applications/deleteDraftApplication",
  async (applicationId, { rejectWithValue }) => {
    try {
      await api.del(`/applications/${applicationId}`);
      return String(applicationId);
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to delete draft application.");
    }
  },
);

export const deleteUniversityApplication = createAsyncThunk(
  "applications/deleteUniversityApplication",
  async (applicationId, { rejectWithValue }) => {
    try {
      await api.del(`/applications/university/me/${applicationId}`);
      return String(applicationId);
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to delete application record.");
    }
  },
);

export const updateDraftApplication = createAsyncThunk(
  "applications/updateDraftApplication",
  async ({ applicationId, payload }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/applications/${applicationId}`, payload);
      return response?.data?.application || null;
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to update draft application.");
    }
  },
);

export const updateUniversityApplicationStatus = createAsyncThunk(
  "applications/updateUniversityApplicationStatus",
  async ({ applicationId, status }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/applications/${applicationId}/status`, { status });
      return {
        ...(response?.data?.application || {}),
        id: String(response?.data?.application?._id || response?.data?.application?.id || applicationId || ""),
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to update application status.");
    }
  },
);

const upsertStudentApplication = (state, application) => {
  const normalized = normalizeApplication(application);
  const index = state.student.items.findIndex((item) => item.id === normalized.id);
  if (index === -1) {
    state.student.items.unshift(normalized);
  } else {
    state.student.items[index] = normalized;
  }
};

const applicationsSlice = createSlice({
  name: "applications",
  initialState: {
    student: {
      items: [],
      templateSubmissions: [],
      loading: false,
      error: "",
    },
    university: {
      items: [],
      loading: false,
      error: "",
      statusMutatingIds: [],
      deletingIds: [],
    },
    current: {
      item: null,
      loading: false,
      error: "",
    },
    mutatingIds: [],
  },
  reducers: {
    clearApplicationsErrors(state) {
      state.student.error = "";
      state.university.error = "";
      state.current.error = "";
    },
    setCurrentApplication(state, action) {
      state.current.item = action.payload || null;
    },
    upsertApplicationFromRealtime(state, action) {
      const application = action.payload;
      if (!application) return;
      upsertStudentApplication(state, application);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStudentApplications.pending, (state) => {
        state.student.loading = true;
        state.student.error = "";
      })
      .addCase(fetchStudentApplications.fulfilled, (state, action) => {
        state.student.loading = false;
        state.student.items = action.payload.applications;
        state.student.templateSubmissions = action.payload.templateSubmissions;
      })
      .addCase(fetchStudentApplications.rejected, (state, action) => {
        state.student.loading = false;
        state.student.error = action.payload || "Unable to load applications.";
      })
      .addCase(fetchUniversityApplications.pending, (state) => {
        state.university.loading = true;
        state.university.error = "";
      })
      .addCase(fetchUniversityApplications.fulfilled, (state, action) => {
        state.university.loading = false;
        state.university.items = action.payload;
      })
      .addCase(fetchUniversityApplications.rejected, (state, action) => {
        state.university.loading = false;
        state.university.error = action.payload || "Unable to load university applications.";
      })
      .addCase(updateUniversityApplicationStatus.pending, (state, action) => {
        const id = String(action.meta.arg?.applicationId || "");
        state.university.statusMutatingIds.push(id);
        state.university.error = "";
      })
      .addCase(updateUniversityApplicationStatus.fulfilled, (state, action) => {
        const updated = action.payload;
        const id = String(updated?.id || "");
        state.university.statusMutatingIds = state.university.statusMutatingIds.filter(
          (item) => item !== id,
        );
        state.university.items = state.university.items.map((item) =>
          String(item?.id || item?._id || "") === id ? { ...item, ...updated } : item,
        );
        if (String(state.current.item?._id || state.current.item?.id || "") === id) {
          state.current.item = {
            ...(state.current.item || {}),
            ...updated,
          };
        }
      })
      .addCase(updateUniversityApplicationStatus.rejected, (state, action) => {
        const id = String(action.meta.arg?.applicationId || "");
        state.university.statusMutatingIds = state.university.statusMutatingIds.filter(
          (item) => item !== id,
        );
        state.university.error = action.payload || "Unable to update application status.";
      })
      .addCase(deleteUniversityApplication.pending, (state, action) => {
        const id = String(action.meta.arg || "");
        state.university.deletingIds.push(id);
        state.university.error = "";
      })
      .addCase(deleteUniversityApplication.fulfilled, (state, action) => {
        const id = String(action.payload || "");
        state.university.deletingIds = state.university.deletingIds.filter((item) => item !== id);
        state.university.items = state.university.items.filter(
          (item) => String(item?.id || item?._id || "") !== id,
        );
        if (String(state.current.item?._id || state.current.item?.id || "") === id) {
          state.current.item = null;
        }
      })
      .addCase(deleteUniversityApplication.rejected, (state, action) => {
        const id = String(action.meta.arg || "");
        state.university.deletingIds = state.university.deletingIds.filter((item) => item !== id);
        state.university.error = action.payload || "Unable to delete application record.";
      })
      .addCase(fetchApplicationById.pending, (state) => {
        state.current.loading = true;
        state.current.error = "";
      })
      .addCase(fetchApplicationById.fulfilled, (state, action) => {
        state.current.loading = false;
        state.current.item = action.payload;
      })
      .addCase(fetchApplicationById.rejected, (state, action) => {
        state.current.loading = false;
        state.current.error = action.payload || "Unable to load application.";
      })
      .addCase(deleteDraftApplication.pending, (state, action) => {
        state.mutatingIds.push(String(action.meta.arg));
      })
      .addCase(deleteDraftApplication.fulfilled, (state, action) => {
        const id = String(action.payload);
        state.mutatingIds = state.mutatingIds.filter((item) => item !== id);
        state.student.items = state.student.items.filter((item) => item.id !== id);
      })
      .addCase(deleteDraftApplication.rejected, (state, action) => {
        const id = String(action.meta.arg);
        state.mutatingIds = state.mutatingIds.filter((item) => item !== id);
        state.student.error = action.payload || "Unable to delete draft application.";
      })
      .addCase(updateDraftApplication.pending, (state, action) => {
        state.mutatingIds.push(String(action.meta.arg?.applicationId || ""));
      })
      .addCase(updateDraftApplication.fulfilled, (state, action) => {
        const id = String(action.payload?._id || action.payload?.id || "");
        state.mutatingIds = state.mutatingIds.filter((item) => item !== id);
        if (action.payload) {
          upsertStudentApplication(state, action.payload);
          state.current.item = action.payload;
        }
      })
      .addCase(updateDraftApplication.rejected, (state, action) => {
        const id = String(action.meta.arg?.applicationId || "");
        state.mutatingIds = state.mutatingIds.filter((item) => item !== id);
        state.student.error = action.payload || "Unable to update draft application.";
      });
  },
});

export const { clearApplicationsErrors, setCurrentApplication, upsertApplicationFromRealtime } =
  applicationsSlice.actions;
export default applicationsSlice.reducer;
