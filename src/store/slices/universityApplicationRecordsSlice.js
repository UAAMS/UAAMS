import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

const normalizeRollNumberApplication = (item) => ({
  id: String(item?._id || item?.id || ""),
  applicationCode: item?.applicationCode || "N/A",
  studentName: item?.studentName || item?.student?.name || "Student",
  email: item?.email || item?.student?.email || "",
  program: item?.program || "Program",
  aggregate: Number(item?.aggregate || 0),
  status: item?.status || "pending",
  eligibleForAdmissionLetter: Boolean(item?.eligibleForAdmissionLetter),
  rollNumber: {
    assigned: Boolean(item?.rollNumber?.assigned),
    number: item?.rollNumber?.number || "",
    slipFileUrl: item?.rollNumber?.slipFileUrl || "",
    slipFileName: item?.rollNumber?.slipFileName || "",
    assignedAt: item?.rollNumber?.assignedAt || null,
  },
});

const normalizeAdmissionLetterApplication = (item) => ({
  id: String(item?._id || item?.id || ""),
  applicationCode: item?.applicationCode || "N/A",
  studentName: item?.studentName || item?.student?.name || "Student",
  email: item?.email || item?.student?.email || "",
  program: item?.program || "Program",
  aggregate: Number(item?.aggregate || 0),
  status: item?.status || "pending",
  eligibleForAdmissionLetter: Boolean(item?.eligibleForAdmissionLetter),
  rollNumber: {
    assigned: Boolean(item?.rollNumber?.assigned),
    number: item?.rollNumber?.number || "",
  },
  admissionLetter: {
    issued: Boolean(item?.admissionLetter?.issued),
    letterNumber: item?.admissionLetter?.letterNumber || "",
    fileUrl: item?.admissionLetter?.fileUrl || "",
    fileName: item?.admissionLetter?.fileName || "",
    remarks: item?.admissionLetter?.remarks || "",
    sentToStudent: Boolean(item?.admissionLetter?.sentToStudent),
    uploadedAt: item?.admissionLetter?.uploadedAt || null,
  },
});

const updateItemById = (items, nextItem) =>
  items.map((item) => (item.id === nextItem.id ? { ...item, ...nextItem } : item));

export const fetchUniversityRollNumberRecords = createAsyncThunk(
  "universityApplicationRecords/fetchUniversityRollNumberRecords",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/universities/me/roll-numbers?limit=200");
      const items = response?.data?.applications || [];
      return items.map(normalizeRollNumberApplication);
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load roll-number records.");
    }
  },
);

export const upsertUniversityRollNumberRecord = createAsyncThunk(
  "universityApplicationRecords/upsertUniversityRollNumberRecord",
  async ({ applicationId, payload }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/universities/me/roll-numbers/${applicationId}`, payload);
      return normalizeRollNumberApplication(response?.data?.application || {});
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to save roll number.");
    }
  },
);

export const fetchUniversityAdmissionLetterRecords = createAsyncThunk(
  "universityApplicationRecords/fetchUniversityAdmissionLetterRecords",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/universities/me/admission-letters?limit=200");
      const items = response?.data?.applications || [];
      return items.map(normalizeAdmissionLetterApplication);
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load admission-letter records.");
    }
  },
);

export const upsertUniversityAdmissionLetterRecord = createAsyncThunk(
  "universityApplicationRecords/upsertUniversityAdmissionLetterRecord",
  async ({ applicationId, payload }, { rejectWithValue }) => {
    try {
      const response = await api.patch(
        `/universities/me/admission-letters/${applicationId}`,
        payload,
      );
      return normalizeAdmissionLetterApplication(response?.data?.application || {});
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to save admission letter.");
    }
  },
);

export const deleteUniversityApplicationRecord = createAsyncThunk(
  "universityApplicationRecords/deleteUniversityApplicationRecord",
  async ({ applicationId, recordType }, { rejectWithValue }) => {
    try {
      await api.del(`/applications/university/me/${applicationId}`);
      return {
        applicationId: String(applicationId || ""),
        recordType: recordType === "admissionLetters" ? "admissionLetters" : "rollNumbers",
      };
    } catch (error) {
      return rejectWithValue({
        message: error?.message || "Unable to delete application record.",
        applicationId: String(applicationId || ""),
        recordType: recordType === "admissionLetters" ? "admissionLetters" : "rollNumbers",
      });
    }
  },
);

const createRecordState = () => ({
  items: [],
  loading: false,
  error: "",
  savingId: "",
  saveError: "",
  deletingIds: [],
});

const universityApplicationRecordsSlice = createSlice({
  name: "universityApplicationRecords",
  initialState: {
    rollNumbers: createRecordState(),
    admissionLetters: createRecordState(),
  },
  reducers: {
    clearUniversityApplicationRecordsErrors(state) {
      state.rollNumbers.error = "";
      state.rollNumbers.saveError = "";
      state.admissionLetters.error = "";
      state.admissionLetters.saveError = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUniversityRollNumberRecords.pending, (state) => {
        state.rollNumbers.loading = true;
        state.rollNumbers.error = "";
      })
      .addCase(fetchUniversityRollNumberRecords.fulfilled, (state, action) => {
        state.rollNumbers.loading = false;
        state.rollNumbers.items = action.payload;
      })
      .addCase(fetchUniversityRollNumberRecords.rejected, (state, action) => {
        state.rollNumbers.loading = false;
        state.rollNumbers.error = action.payload || "Unable to load roll-number records.";
      })
      .addCase(upsertUniversityRollNumberRecord.pending, (state, action) => {
        state.rollNumbers.savingId = String(action.meta.arg?.applicationId || "");
        state.rollNumbers.saveError = "";
      })
      .addCase(upsertUniversityRollNumberRecord.fulfilled, (state, action) => {
        state.rollNumbers.savingId = "";
        const nextItem = action.payload;
        if (!nextItem?.id) return;
        const exists = state.rollNumbers.items.some((item) => item.id === nextItem.id);
        state.rollNumbers.items = exists
          ? updateItemById(state.rollNumbers.items, nextItem)
          : [nextItem, ...state.rollNumbers.items];
      })
      .addCase(upsertUniversityRollNumberRecord.rejected, (state, action) => {
        state.rollNumbers.savingId = "";
        state.rollNumbers.saveError = action.payload || "Unable to save roll number.";
      })
      .addCase(fetchUniversityAdmissionLetterRecords.pending, (state) => {
        state.admissionLetters.loading = true;
        state.admissionLetters.error = "";
      })
      .addCase(fetchUniversityAdmissionLetterRecords.fulfilled, (state, action) => {
        state.admissionLetters.loading = false;
        state.admissionLetters.items = action.payload;
      })
      .addCase(fetchUniversityAdmissionLetterRecords.rejected, (state, action) => {
        state.admissionLetters.loading = false;
        state.admissionLetters.error =
          action.payload || "Unable to load admission-letter records.";
      })
      .addCase(upsertUniversityAdmissionLetterRecord.pending, (state, action) => {
        state.admissionLetters.savingId = String(action.meta.arg?.applicationId || "");
        state.admissionLetters.saveError = "";
      })
      .addCase(upsertUniversityAdmissionLetterRecord.fulfilled, (state, action) => {
        state.admissionLetters.savingId = "";
        const nextItem = action.payload;
        if (!nextItem?.id) return;
        const exists = state.admissionLetters.items.some((item) => item.id === nextItem.id);
        state.admissionLetters.items = exists
          ? updateItemById(state.admissionLetters.items, nextItem)
          : [nextItem, ...state.admissionLetters.items];
      })
      .addCase(upsertUniversityAdmissionLetterRecord.rejected, (state, action) => {
        state.admissionLetters.savingId = "";
        state.admissionLetters.saveError = action.payload || "Unable to save admission letter.";
      })
      .addCase(deleteUniversityApplicationRecord.pending, (state, action) => {
        const applicationId = String(action.meta.arg?.applicationId || "");
        const recordType =
          action.meta.arg?.recordType === "admissionLetters" ? "admissionLetters" : "rollNumbers";
        state[recordType].deletingIds.push(applicationId);
        state[recordType].error = "";
      })
      .addCase(deleteUniversityApplicationRecord.fulfilled, (state, action) => {
        const applicationId = String(action.payload?.applicationId || "");
        const recordType =
          action.payload?.recordType === "admissionLetters" ? "admissionLetters" : "rollNumbers";
        state[recordType].deletingIds = state[recordType].deletingIds.filter(
          (item) => item !== applicationId,
        );
        state.rollNumbers.items = state.rollNumbers.items.filter((item) => item.id !== applicationId);
        state.admissionLetters.items = state.admissionLetters.items.filter(
          (item) => item.id !== applicationId,
        );
      })
      .addCase(deleteUniversityApplicationRecord.rejected, (state, action) => {
        const payload = action.payload || {};
        const applicationId = String(
          payload.applicationId || action.meta.arg?.applicationId || "",
        );
        const recordType =
          payload.recordType === "admissionLetters" || action.meta.arg?.recordType === "admissionLetters"
            ? "admissionLetters"
            : "rollNumbers";
        state[recordType].deletingIds = state[recordType].deletingIds.filter(
          (item) => item !== applicationId,
        );
        state[recordType].error =
          payload.message || "Unable to delete application record.";
      });
  },
});

export const { clearUniversityApplicationRecordsErrors } = universityApplicationRecordsSlice.actions;
export default universityApplicationRecordsSlice.reducer;
