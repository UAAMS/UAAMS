import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

export const fetchStudentProfile = createAsyncThunk(
  "studentProfile/fetchStudentProfile",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/students/me/profile");
      return response?.data?.profile || null;
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load student profile.");
    }
  },
);

export const updateStudentProfile = createAsyncThunk(
  "studentProfile/updateStudentProfile",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await api.put("/students/me/profile", payload);
      return response?.data?.profile || payload;
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to update student profile.");
    }
  },
);

const studentProfileSlice = createSlice({
  name: "studentProfile",
  initialState: {
    profile: null,
    loading: false,
    saving: false,
    loaded: false,
    error: "",
    saveError: "",
  },
  reducers: {
    clearStudentProfileErrors(state) {
      state.error = "";
      state.saveError = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStudentProfile.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchStudentProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.profile = action.payload;
      })
      .addCase(fetchStudentProfile.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = action.payload || "Unable to load student profile.";
      })
      .addCase(updateStudentProfile.pending, (state) => {
        state.saving = true;
        state.saveError = "";
      })
      .addCase(updateStudentProfile.fulfilled, (state, action) => {
        state.saving = false;
        state.profile = action.payload;
      })
      .addCase(updateStudentProfile.rejected, (state, action) => {
        state.saving = false;
        state.saveError = action.payload || "Unable to update student profile.";
      });
  },
});

export const { clearStudentProfileErrors } = studentProfileSlice.actions;
export default studentProfileSlice.reducer;
