import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

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
    changingPassword: false,
    passwordError: "",
    passwordMessage: "",
  },
  reducers: {
    clearBloggerPasswordMessages(state) {
      state.passwordError = "";
      state.passwordMessage = "";
    },
  },
  extraReducers: (builder) => {
    builder
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

export const { clearBloggerPasswordMessages } = bloggerAccountSlice.actions;
export default bloggerAccountSlice.reducer;
