import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

const normalizePost = (item) => ({
  id: String(item?._id || item?.id || ""),
  title: item?.title || "",
  excerpt: item?.excerpt || "",
  content: item?.content || "",
  category: item?.category || "General",
  tags: Array.isArray(item?.tags) ? item.tags : [],
  imageUrl: item?.imageUrl || "",
  status: item?.status || "draft",
  views: Number(item?.views || 0),
  likesCount: Number(item?.likesCount ?? (Array.isArray(item?.likes) ? item.likes.length : 0)),
  commentsCount: Number(item?.commentsCount || 0),
  repliesCount: Number(item?.repliesCount || 0),
  publishedAt: item?.publishedAt || null,
  createdAt: item?.createdAt || null,
  updatedAt: item?.updatedAt || null,
});

const sortByRecent = (items = []) =>
  items
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.publishedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.publishedAt || a.createdAt || 0).getTime(),
    );

export const fetchUniversityBlogPostsManagement = createAsyncThunk(
  "universityBlogManagement/fetchUniversityBlogPostsManagement",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/universities/me/blogs?limit=200");
      const items = response?.data?.posts || [];
      return sortByRecent(items.map(normalizePost));
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load blog posts.");
    }
  },
);

export const createUniversityBlogPost = createAsyncThunk(
  "universityBlogManagement/createUniversityBlogPost",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await api.post("/universities/me/blogs", payload);
      return response?.data?.post || null;
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to save blog post.");
    }
  },
);

export const updateUniversityBlogPost = createAsyncThunk(
  "universityBlogManagement/updateUniversityBlogPost",
  async ({ postId, payload }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/universities/me/blogs/${postId}`, payload);
      return response?.data?.post || null;
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to save blog post.");
    }
  },
);

export const deleteUniversityBlogPost = createAsyncThunk(
  "universityBlogManagement/deleteUniversityBlogPost",
  async (postId, { rejectWithValue }) => {
    try {
      await api.del(`/universities/me/blogs/${postId}`);
      return String(postId);
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to delete blog post.");
    }
  },
);

const universityBlogManagementSlice = createSlice({
  name: "universityBlogManagement",
  initialState: {
    items: [],
    loading: false,
    error: "",
    saving: false,
    mutationError: "",
    deletingIds: [],
  },
  reducers: {
    clearUniversityBlogManagementErrors(state) {
      state.error = "";
      state.mutationError = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUniversityBlogPostsManagement.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchUniversityBlogPostsManagement.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchUniversityBlogPostsManagement.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Unable to load blog posts.";
      })
      .addCase(createUniversityBlogPost.pending, (state) => {
        state.saving = true;
        state.mutationError = "";
      })
      .addCase(createUniversityBlogPost.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload) {
          const next = normalizePost(action.payload);
          state.items = sortByRecent([next, ...state.items.filter((item) => item.id !== next.id)]);
        }
      })
      .addCase(createUniversityBlogPost.rejected, (state, action) => {
        state.saving = false;
        state.mutationError = action.payload || "Unable to save blog post.";
      })
      .addCase(updateUniversityBlogPost.pending, (state) => {
        state.saving = true;
        state.mutationError = "";
      })
      .addCase(updateUniversityBlogPost.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload) {
          const next = normalizePost(action.payload);
          state.items = sortByRecent(
            state.items.map((item) => (item.id === next.id ? { ...item, ...next } : item)),
          );
        }
      })
      .addCase(updateUniversityBlogPost.rejected, (state, action) => {
        state.saving = false;
        state.mutationError = action.payload || "Unable to save blog post.";
      })
      .addCase(deleteUniversityBlogPost.pending, (state, action) => {
        state.deletingIds.push(String(action.meta.arg || ""));
        state.mutationError = "";
      })
      .addCase(deleteUniversityBlogPost.fulfilled, (state, action) => {
        const id = String(action.payload);
        state.deletingIds = state.deletingIds.filter((item) => item !== id);
        state.items = state.items.filter((item) => item.id !== id);
      })
      .addCase(deleteUniversityBlogPost.rejected, (state, action) => {
        const id = String(action.meta.arg || "");
        state.deletingIds = state.deletingIds.filter((item) => item !== id);
        state.mutationError = action.payload || "Unable to delete blog post.";
      });
  },
});

export const { clearUniversityBlogManagementErrors } = universityBlogManagementSlice.actions;
export default universityBlogManagementSlice.reducer;
