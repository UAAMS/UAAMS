import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

const normalizeBloggerProfile = (profile = {}) => ({
  id: String(profile?._id || profile?.id || ""),
  name: profile?.name || "",
  email: profile?.email || "",
  username: profile?.username || "",
  phone: profile?.phone || "",
  location: profile?.location || "",
  website: profile?.website || "",
  profilePicture: profile?.profilePicture || "",
  managedUniversity: profile?.managedUniversity || null,
});

export const fetchBloggerProfile = createAsyncThunk(
  "bloggerAccount/fetchBloggerProfile",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/blogger/me/profile");
      return normalizeBloggerProfile(response?.data?.profile || {});
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load blogger profile.");
    }
  },
);

export const updateBloggerProfile = createAsyncThunk(
  "bloggerAccount/updateBloggerProfile",
  async (profileData, { rejectWithValue }) => {
    try {
      const response = await api.put("/blogger/me/profile", profileData || {});
      return {
        profile: normalizeBloggerProfile(response?.data?.profile || profileData || {}),
        message: response?.message || "Profile updated successfully.",
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to update blogger profile.");
    }
  },
);

export const changeBloggerPassword = createAsyncThunk(
  "bloggerAccount/changeBloggerPassword",
  async (passwordData, { rejectWithValue }) => {
    try {
      await api.patch("/blogger/me/password", passwordData);
      return "Password changed successfully.";
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to change password.");
    }
  },
);

const bloggerAccountSlice = createSlice({
  name: "bloggerAccount",
  initialState: {
    profile: normalizeBloggerProfile({}),
    profileLoading: false,
    profileLoaded: false,
    profileSaving: false,
    profileError: "",
    profileMessage: "",
    changingPassword: false,
    passwordError: "",
    passwordMessage: "",
  },
  reducers: {
    clearBloggerPasswordMessages(state) {
      state.passwordError = "";
      state.passwordMessage = "";
    },
    clearBloggerProfileMessages(state) {
      state.profileError = "";
      state.profileMessage = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBloggerProfile.pending, (state) => {
        state.profileLoading = true;
        state.profileError = "";
      })
      .addCase(fetchBloggerProfile.fulfilled, (state, action) => {
        state.profileLoading = false;
        state.profileLoaded = true;
        state.profile = action.payload;
      })
      .addCase(fetchBloggerProfile.rejected, (state, action) => {
        state.profileLoading = false;
        state.profileLoaded = true;
        state.profileError = action.payload || "Unable to load blogger profile.";
      })
      .addCase(updateBloggerProfile.pending, (state) => {
        state.profileSaving = true;
        state.profileError = "";
        state.profileMessage = "";
      })
      .addCase(updateBloggerProfile.fulfilled, (state, action) => {
        state.profileSaving = false;
        state.profile = action.payload.profile;
        state.profileMessage = action.payload.message;
      })
      .addCase(updateBloggerProfile.rejected, (state, action) => {
        state.profileSaving = false;
        state.profileError = action.payload || "Unable to update blogger profile.";
      })
      .addCase(changeBloggerPassword.pending, (state) => {
        state.changingPassword = true;
        state.passwordError = "";
        state.passwordMessage = "";
      })
      .addCase(changeBloggerPassword.fulfilled, (state, action) => {
        state.changingPassword = false;
        state.passwordMessage = action.payload || "Password changed successfully.";
      })
      .addCase(changeBloggerPassword.rejected, (state, action) => {
        state.changingPassword = false;
        state.passwordError = action.payload || "Unable to change password.";
      });
  },
});

export const { clearBloggerPasswordMessages, clearBloggerProfileMessages } =
  bloggerAccountSlice.actions;
export default bloggerAccountSlice.reducer;
