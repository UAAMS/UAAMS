import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

const normalizeAdminProfile = (profile = {}) => ({
  id: String(profile?._id || profile?.id || ""),
  name: profile?.name || "",
  email: profile?.email || "",
  phone: profile?.phone || "",
  location: profile?.location || "",
  profilePicture: profile?.profilePicture || "",
});

export const fetchAdminProfile = createAsyncThunk(
  "adminAccount/fetchAdminProfile",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/admin/me/profile");
      return normalizeAdminProfile(response?.data?.profile || {});
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load admin profile.");
    }
  },
);

export const updateAdminProfile = createAsyncThunk(
  "adminAccount/updateAdminProfile",
  async (profileData, { rejectWithValue }) => {
    try {
      const response = await api.put("/admin/me/profile", profileData || {});
      return {
        profile: normalizeAdminProfile(response?.data?.profile || profileData || {}),
        message: response?.message || "Profile updated successfully.",
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to update admin profile.");
    }
  },
);

const adminAccountSlice = createSlice({
  name: "adminAccount",
  initialState: {
    profile: normalizeAdminProfile({}),
    loading: false,
    loaded: false,
    saving: false,
    error: "",
    message: "",
  },
  reducers: {
    clearAdminProfileMessages(state) {
      state.error = "";
      state.message = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminProfile.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchAdminProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.profile = action.payload;
      })
      .addCase(fetchAdminProfile.rejected, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.error = action.payload || "Unable to load admin profile.";
      })
      .addCase(updateAdminProfile.pending, (state) => {
        state.saving = true;
        state.error = "";
        state.message = "";
      })
      .addCase(updateAdminProfile.fulfilled, (state, action) => {
        state.saving = false;
        state.profile = action.payload.profile;
        state.message = action.payload.message;
      })
      .addCase(updateAdminProfile.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload || "Unable to update admin profile.";
      });
  },
});

export const { clearAdminProfileMessages } = adminAccountSlice.actions;
export default adminAccountSlice.reducer;
