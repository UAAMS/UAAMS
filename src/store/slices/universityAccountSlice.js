import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

const defaultSettings = {
  universityName: "",
  shortName: "",
  type: "public",
  established: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  city: "",
  province: "",
  postalCode: "",
  about: "",
  mission: "",
  vision: "",
  totalStudents: "",
  totalPrograms: "",
  ranking: "",
  accreditation: "HEC",
  representativeName: "",
  representativePosition: "",
  representativeEmail: "",
  representativePhone: "",
  logo: "",
  applicationFee: "0",
  applicationStartDate: "",
  applicationEndDate: "",
  acceptApplicationsThroughUaams: true,
  allowAutoFillFromStudentProfile: true,
  paymentMethods: [],
  notifications: {
    emailOnNewApplication: true,
    dailySummary: true,
    smsUrgentUpdates: false,
  },
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const buildInitialUniversityProfile = (initialName = "University") => ({
  universityName: initialName,
  shortName: "",
  type: "public",
  established: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  city: "",
  province: "",
  postalCode: "",
  about: "",
  mission: "",
  vision: "",
  totalStudents: "",
  totalPrograms: "",
  ranking: "",
  accreditation: "HEC",
  representativeName: "",
  representativePosition: "",
  representativeEmail: "",
  representativePhone: "",
  logo: "",
});

const normalizePaymentMethod = (method = {}, index = 0) => ({
  id: String(method?._id || method?.id || index + 1),
  type: ["bank", "wallet", "card", "other"].includes(String(method?.type || "").toLowerCase())
    ? String(method.type).toLowerCase()
    : "bank",
  title: String(method?.title || "").trim(),
  accountTitle: String(method?.accountTitle || "").trim(),
  bankName: String(method?.bankName || "").trim(),
  accountNumber: String(method?.accountNumber || "").trim(),
  iban: String(method?.iban || "").trim(),
  walletName: String(method?.walletName || "").trim(),
  walletNumber: String(method?.walletNumber || "").trim(),
  instructions: String(method?.instructions || "").trim(),
  isActive: method?.isActive !== false,
});

const normalizeSettingsProfile = (profile = {}) => ({
  ...defaultSettings,
  ...profile,
  applicationFee: String(profile?.applicationFee ?? 0),
  applicationStartDate: toDateInputValue(profile?.applicationStartDate),
  applicationEndDate: toDateInputValue(profile?.applicationEndDate),
  paymentMethods: Array.isArray(profile?.paymentMethods)
    ? profile.paymentMethods.map(normalizePaymentMethod)
    : [],
  notifications: {
    ...defaultSettings.notifications,
    ...(profile?.notifications || {}),
  },
});

const normalizeUniversityProfile = ({ profile = {}, initialName = "University" } = {}) => ({
  ...buildInitialUniversityProfile(initialName),
  ...profile,
});

export const fetchUniversitySettings = createAsyncThunk(
  "universityAccount/fetchUniversitySettings",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/universities/me/settings");
      return normalizeSettingsProfile(response?.data?.profile || {});
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load university settings.");
    }
  },
);

export const updateUniversitySettings = createAsyncThunk(
  "universityAccount/updateUniversitySettings",
  async (formData, { rejectWithValue }) => {
    try {
      const payload = {
        ...formData,
        applicationFee: Number(formData?.applicationFee || 0),
        applicationStartDate: formData?.applicationStartDate || null,
        applicationEndDate: formData?.applicationEndDate || null,
        paymentMethods: Array.isArray(formData?.paymentMethods)
          ? formData.paymentMethods.map(normalizePaymentMethod)
          : [],
      };
      const response = await api.put("/universities/me/settings", payload);
      const profile = response?.data?.profile || payload;
      return {
        profile: normalizeSettingsProfile(profile),
        message: response?.message || "Settings saved successfully.",
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to save university settings.");
    }
  },
);

export const fetchUniversityProfile = createAsyncThunk(
  "universityAccount/fetchUniversityProfile",
  async ({ initialName = "University" } = {}, { rejectWithValue }) => {
    try {
      const response = await api.get("/universities/me/profile");
      return normalizeUniversityProfile({
        profile: response?.data?.profile || {},
        initialName,
      });
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load profile from server.");
    }
  },
);

export const updateUniversityProfile = createAsyncThunk(
  "universityAccount/updateUniversityProfile",
  async ({ profileData, initialName = "University" } = {}, { rejectWithValue }) => {
    try {
      const response = await api.put("/universities/me/profile", profileData || {});
      return {
        profile: normalizeUniversityProfile({
          profile: response?.data?.profile || profileData || {},
          initialName,
        }),
        message: response?.message || "Profile updated successfully.",
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to update profile.");
    }
  },
);

const universityAccountSlice = createSlice({
  name: "universityAccount",
  initialState: {
    settings: {
      data: normalizeSettingsProfile({}),
      loading: false,
      saving: false,
      error: "",
      saveError: "",
      successMessage: "",
    },
    profile: {
      data: buildInitialUniversityProfile("University"),
      loading: false,
      saving: false,
      error: "",
      saveError: "",
      statusMessage: "",
    },
  },
  reducers: {
    clearUniversityAccountMessages(state) {
      state.settings.error = "";
      state.settings.saveError = "";
      state.settings.successMessage = "";
      state.profile.error = "";
      state.profile.saveError = "";
      state.profile.statusMessage = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUniversitySettings.pending, (state) => {
        state.settings.loading = true;
        state.settings.error = "";
      })
      .addCase(fetchUniversitySettings.fulfilled, (state, action) => {
        state.settings.loading = false;
        state.settings.data = action.payload;
      })
      .addCase(fetchUniversitySettings.rejected, (state, action) => {
        state.settings.loading = false;
        state.settings.error = action.payload || "Unable to load university settings.";
      })
      .addCase(updateUniversitySettings.pending, (state) => {
        state.settings.saving = true;
        state.settings.saveError = "";
        state.settings.successMessage = "";
      })
      .addCase(updateUniversitySettings.fulfilled, (state, action) => {
        state.settings.saving = false;
        state.settings.data = action.payload.profile;
        state.settings.successMessage = action.payload.message;
      })
      .addCase(updateUniversitySettings.rejected, (state, action) => {
        state.settings.saving = false;
        state.settings.saveError = action.payload || "Unable to save university settings.";
      })
      .addCase(fetchUniversityProfile.pending, (state) => {
        state.profile.loading = true;
        state.profile.error = "";
        state.profile.statusMessage = "";
      })
      .addCase(fetchUniversityProfile.fulfilled, (state, action) => {
        state.profile.loading = false;
        state.profile.data = action.payload;
      })
      .addCase(fetchUniversityProfile.rejected, (state, action) => {
        state.profile.loading = false;
        state.profile.error = action.payload || "Unable to load profile from server.";
      })
      .addCase(updateUniversityProfile.pending, (state) => {
        state.profile.saving = true;
        state.profile.saveError = "";
        state.profile.statusMessage = "";
      })
      .addCase(updateUniversityProfile.fulfilled, (state, action) => {
        state.profile.saving = false;
        state.profile.data = action.payload.profile;
        state.profile.statusMessage = action.payload.message;
      })
      .addCase(updateUniversityProfile.rejected, (state, action) => {
        state.profile.saving = false;
        state.profile.saveError = action.payload || "Unable to update profile.";
        state.profile.statusMessage = action.payload || "Unable to update profile.";
      });
  },
});

export const { clearUniversityAccountMessages } = universityAccountSlice.actions;
export default universityAccountSlice.reducer;
