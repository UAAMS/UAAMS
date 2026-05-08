import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

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
});

const sortByRecent = (items = []) =>
  items
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    );

export const fetchUniversityBloggers = createAsyncThunk(
  "universityBloggersManagement/fetchUniversityBloggers",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/universities/me/bloggers");
      const items = response?.data?.bloggers || [];
      return sortByRecent(items.map(normalizeBlogger));
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load bloggers.");
    }
  },
);

export const createUniversityBlogger = createAsyncThunk(
  "universityBloggersManagement/createUniversityBlogger",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await api.post("/universities/me/bloggers", payload);
      return {
        blogger: normalizeBlogger(response?.data?.blogger || {}),
        credentials: response?.data?.credentials || null,
        emailDelivery: response?.data?.emailDelivery || null,
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to create blogger.");
    }
  },
);

export const toggleUniversityBloggerStatus = createAsyncThunk(
  "universityBloggersManagement/toggleUniversityBloggerStatus",
  async ({ bloggerId, status }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/universities/me/bloggers/${bloggerId}/status`, { status });
      return normalizeBlogger(response?.data?.blogger || {});
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to update blogger status.");
    }
  },
);

export const deleteUniversityBlogger = createAsyncThunk(
  "universityBloggersManagement/deleteUniversityBlogger",
  async (bloggerId, { rejectWithValue }) => {
    try {
      await api.del(`/universities/me/bloggers/${bloggerId}`);
      return String(bloggerId);
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to delete blogger account.");
    }
  },
);

const universityBloggersManagementSlice = createSlice({
  name: "universityBloggersManagement",
  initialState: {
    items: [],
    loading: false,
    creating: false,
    error: "",
    createError: "",
    statusError: "",
    deleteError: "",
    statusMutatingIds: [],
    deletingIds: [],
    credentials: null,
    statusMessage: "",
  },
  reducers: {
    clearUniversityBloggersMessages(state) {
      state.error = "";
      state.createError = "";
      state.statusError = "";
      state.deleteError = "";
      state.statusMessage = "";
    },
    clearUniversityBloggerCredentials(state) {
      state.credentials = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUniversityBloggers.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchUniversityBloggers.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchUniversityBloggers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Unable to load bloggers.";
      })
      .addCase(createUniversityBlogger.pending, (state) => {
        state.creating = true;
        state.createError = "";
        state.statusMessage = "";
      })
      .addCase(createUniversityBlogger.fulfilled, (state, action) => {
        state.creating = false;
        const next = action.payload?.blogger;
        if (next?.id) {
          state.items = sortByRecent([next, ...state.items.filter((item) => item.id !== next.id)]);
        }
        state.credentials = action.payload?.credentials || null;
        const emailDelivery = action.payload?.emailDelivery || null;
        state.statusMessage = emailDelivery?.sent
          ? "Blogger created and credential email sent."
          : emailDelivery?.reason || "Blogger created. Credential email could not be sent.";
      })
      .addCase(createUniversityBlogger.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload || "Unable to create blogger.";
      })
      .addCase(toggleUniversityBloggerStatus.pending, (state, action) => {
        const bloggerId = String(action.meta.arg?.bloggerId || "");
        state.statusMutatingIds.push(bloggerId);
        state.statusError = "";
      })
      .addCase(toggleUniversityBloggerStatus.fulfilled, (state, action) => {
        const updated = action.payload;
        state.statusMutatingIds = state.statusMutatingIds.filter((id) => id !== updated.id);
        state.items = state.items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item));
      })
      .addCase(toggleUniversityBloggerStatus.rejected, (state, action) => {
        const bloggerId = String(action.meta.arg?.bloggerId || "");
        state.statusMutatingIds = state.statusMutatingIds.filter((id) => id !== bloggerId);
        state.statusError = action.payload || "Unable to update blogger status.";
      })
      .addCase(deleteUniversityBlogger.pending, (state, action) => {
        const bloggerId = String(action.meta.arg || "");
        state.deletingIds.push(bloggerId);
        state.deleteError = "";
      })
      .addCase(deleteUniversityBlogger.fulfilled, (state, action) => {
        const bloggerId = String(action.payload);
        state.deletingIds = state.deletingIds.filter((id) => id !== bloggerId);
        state.items = state.items.filter((item) => item.id !== bloggerId);
        state.statusMessage = "Blogger account deleted successfully.";
      })
      .addCase(deleteUniversityBlogger.rejected, (state, action) => {
        const bloggerId = String(action.meta.arg || "");
        state.deletingIds = state.deletingIds.filter((id) => id !== bloggerId);
        state.deleteError = action.payload || "Unable to delete blogger account.";
      });
  },
});

export const { clearUniversityBloggersMessages, clearUniversityBloggerCredentials } =
  universityBloggersManagementSlice.actions;
export default universityBloggersManagementSlice.reducer;
