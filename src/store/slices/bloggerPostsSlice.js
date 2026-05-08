import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

const normalizePost = (item, fallback = {}) => ({
  id: String(item?._id || item?.id || fallback?.id || ""),
  title: item?.title ?? fallback?.title ?? "",
  excerpt: item?.excerpt ?? fallback?.excerpt ?? "",
  content: item?.content ?? fallback?.content ?? "",
  category: item?.category ?? fallback?.category ?? "General",
  tags: Array.isArray(item?.tags) ? item.tags : Array.isArray(fallback?.tags) ? fallback.tags : [],
  imageUrl: item?.imageUrl ?? fallback?.imageUrl ?? "",
  status: item?.status ?? fallback?.status ?? "draft",
  views: Number(item?.views ?? fallback?.views ?? 0),
  likesCount: Number(
    item?.likesCount ??
      (Array.isArray(item?.likes) ? item.likes.length : fallback?.likesCount ?? 0),
  ),
  commentsCount: Number(item?.commentsCount ?? fallback?.commentsCount ?? 0),
  repliesCount: Number(item?.repliesCount ?? fallback?.repliesCount ?? 0),
  publishedAt: item?.publishedAt ?? fallback?.publishedAt ?? null,
  createdAt: item?.createdAt ?? fallback?.createdAt ?? null,
  updatedAt: item?.updatedAt ?? fallback?.updatedAt ?? null,
});

const sortByLatest = (items = []) =>
  items
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime(),
    );

export const fetchBloggerPosts = createAsyncThunk(
  "bloggerPosts/fetchBloggerPosts",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/blogger/me/posts?limit=200");
      const posts = response?.data?.posts || [];
      return sortByLatest(posts.map((item) => normalizePost(item)));
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load blogger posts.");
    }
  },
);

export const createBloggerPost = createAsyncThunk(
  "bloggerPosts/createBloggerPost",
  async (payload, { rejectWithValue }) => {
    try {
      const response = await api.post("/blogger/me/posts", payload);
      return response?.data?.post || null;
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to save post.");
    }
  },
);

export const updateBloggerPost = createAsyncThunk(
  "bloggerPosts/updateBloggerPost",
  async ({ postId, payload }, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/blogger/me/posts/${postId}`, payload);
      return response?.data?.post || null;
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to save post.");
    }
  },
);

export const deleteBloggerPost = createAsyncThunk(
  "bloggerPosts/deleteBloggerPost",
  async (postId, { rejectWithValue }) => {
    try {
      await api.del(`/blogger/me/posts/${postId}`);
      return String(postId);
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to delete post.");
    }
  },
);

const bloggerPostsSlice = createSlice({
  name: "bloggerPosts",
  initialState: {
    items: [],
    loading: false,
    error: "",
    saving: false,
    mutationError: "",
    deletingIds: [],
  },
  reducers: {
    clearBloggerPostsErrors(state) {
      state.error = "";
      state.mutationError = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBloggerPosts.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(fetchBloggerPosts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchBloggerPosts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Unable to load blogger posts.";
      })
      .addCase(createBloggerPost.pending, (state) => {
        state.saving = true;
        state.mutationError = "";
      })
      .addCase(createBloggerPost.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload) {
          const post = normalizePost(action.payload);
          state.items = sortByLatest([post, ...state.items.filter((item) => item.id !== post.id)]);
        }
      })
      .addCase(createBloggerPost.rejected, (state, action) => {
        state.saving = false;
        state.mutationError = action.payload || "Unable to save post.";
      })
      .addCase(updateBloggerPost.pending, (state) => {
        state.saving = true;
        state.mutationError = "";
      })
      .addCase(updateBloggerPost.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload) {
          const id = String(action.payload?._id || action.payload?.id || "");
          const existing = state.items.find((item) => item.id === id) || {};
          const next = normalizePost(action.payload, existing);
          state.items = sortByLatest(state.items.map((item) => (item.id === id ? next : item)));
        }
      })
      .addCase(updateBloggerPost.rejected, (state, action) => {
        state.saving = false;
        state.mutationError = action.payload || "Unable to save post.";
      })
      .addCase(deleteBloggerPost.pending, (state, action) => {
        state.deletingIds.push(String(action.meta.arg || ""));
        state.mutationError = "";
      })
      .addCase(deleteBloggerPost.fulfilled, (state, action) => {
        const id = String(action.payload);
        state.deletingIds = state.deletingIds.filter((item) => item !== id);
        state.items = state.items.filter((item) => item.id !== id);
      })
      .addCase(deleteBloggerPost.rejected, (state, action) => {
        const id = String(action.meta.arg || "");
        state.deletingIds = state.deletingIds.filter((item) => item !== id);
        state.mutationError = action.payload || "Unable to delete post.";
      });
  },
});

export const { clearBloggerPostsErrors } = bloggerPostsSlice.actions;
export default bloggerPostsSlice.reducer;
