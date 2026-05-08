import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

const normalizeComment = (item) => ({
  id: String(item?._id || item?.id || ""),
  content: item?.content ?? "",
  author: item?.author ?? item?.student ?? {},
  post: item?.post ?? {},
  createdAt: item?.createdAt ?? null,
  updatedAt: item?.updatedAt ?? null,
  likesCount: Number(item?.likesCount ?? (Array.isArray(item?.likes) ? item.likes.length : 0)),
  replies: Array.isArray(item?.replies) ? item.replies.map(normalizeComment) : [],
});

const removeCommentById = (comments = [], commentId) =>
  comments.reduce((acc, comment) => {
    if (comment.id === commentId) {
      return acc;
    }

    acc.push({
      ...comment,
      replies: removeCommentById(comment.replies || [], commentId),
    });

    return acc;
  }, []);

// Blogger endpoints
export const fetchBloggerPostComments = createAsyncThunk(
  "blogComments/fetchBloggerPostComments",
  async ({ postId }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/blogger/me/posts/${postId}/comments`);
      return response?.data?.comments || [];
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load comments.");
    }
  },
);

export const deleteBloggerPostComment = createAsyncThunk(
  "blogComments/deleteBloggerPostComment",
  async ({ postId, commentId }, { rejectWithValue }) => {
    try {
      await api.del(`/blogger/me/posts/${postId}/comments/${commentId}`);
      return { postId, commentId };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to delete comment.");
    }
  },
);

// University endpoints
export const fetchUniversityBlogComments = createAsyncThunk(
  "blogComments/fetchUniversityBlogComments",
  async ({ blogId }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/universities/me/blogs/${blogId}/comments`);
      return response?.data?.comments || [];
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load comments.");
    }
  },
);

export const deleteUniversityBlogComment = createAsyncThunk(
  "blogComments/deleteUniversityBlogComment",
  async ({ blogId, commentId }, { rejectWithValue }) => {
    try {
      await api.del(`/universities/me/blogs/${blogId}/comments/${commentId}`);
      return { blogId, commentId };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to delete comment.");
    }
  },
);

const initialState = {
  commentsByPost: {}, // { postId: { comments: [], loading, error } }
  deletingCommentIds: [],
  mutationError: null,
};

const blogCommentsSlice = createSlice({
  name: "blogComments",
  initialState,
  reducers: {
    clearCommentError: (state) => {
      state.mutationError = null;
    },
  },
  extraReducers: (builder) => {
    // Blogger fetch comments
    builder.addCase(fetchBloggerPostComments.pending, (state, action) => {
      const postId = action.meta.arg.postId;
      if (!state.commentsByPost[postId]) {
        state.commentsByPost[postId] = { comments: [], loading: true, error: null };
      } else {
        state.commentsByPost[postId].loading = true;
      }
    });
    builder.addCase(fetchBloggerPostComments.fulfilled, (state, action) => {
      const postId = action.meta.arg.postId;
      state.commentsByPost[postId] = {
        comments: action.payload,
        loading: false,
        error: null,
      };
    });
    builder.addCase(fetchBloggerPostComments.rejected, (state, action) => {
      const postId = action.meta.arg.postId;
      state.commentsByPost[postId] = {
        comments: [],
        loading: false,
        error: action.payload,
      };
    });

    // Blogger delete comment
    builder.addCase(deleteBloggerPostComment.pending, (state, action) => {
      state.deletingCommentIds.push(action.meta.arg.commentId);
    });
    builder.addCase(deleteBloggerPostComment.fulfilled, (state, action) => {
      const { postId, commentId } = action.payload;
      state.deletingCommentIds = state.deletingCommentIds.filter((id) => id !== commentId);
      if (state.commentsByPost[postId]) {
        state.commentsByPost[postId].comments = removeCommentById(
          state.commentsByPost[postId].comments,
          commentId,
        );
      }
    });
    builder.addCase(deleteBloggerPostComment.rejected, (state, action) => {
      const commentId = action.meta.arg.commentId;
      state.deletingCommentIds = state.deletingCommentIds.filter((id) => id !== commentId);
      state.mutationError = action.payload;
    });

    // University fetch comments
    builder.addCase(fetchUniversityBlogComments.pending, (state, action) => {
      const blogId = action.meta.arg.blogId;
      if (!state.commentsByPost[blogId]) {
        state.commentsByPost[blogId] = { comments: [], loading: true, error: null };
      } else {
        state.commentsByPost[blogId].loading = true;
      }
    });
    builder.addCase(fetchUniversityBlogComments.fulfilled, (state, action) => {
      const blogId = action.meta.arg.blogId;
      state.commentsByPost[blogId] = {
        comments: action.payload,
        loading: false,
        error: null,
      };
    });
    builder.addCase(fetchUniversityBlogComments.rejected, (state, action) => {
      const blogId = action.meta.arg.blogId;
      state.commentsByPost[blogId] = {
        comments: [],
        loading: false,
        error: action.payload,
      };
    });

    // University delete comment
    builder.addCase(deleteUniversityBlogComment.pending, (state, action) => {
      state.deletingCommentIds.push(action.meta.arg.commentId);
    });
    builder.addCase(deleteUniversityBlogComment.fulfilled, (state, action) => {
      const { blogId, commentId } = action.payload;
      state.deletingCommentIds = state.deletingCommentIds.filter((id) => id !== commentId);
      if (state.commentsByPost[blogId]) {
        state.commentsByPost[blogId].comments = removeCommentById(
          state.commentsByPost[blogId].comments,
          commentId,
        );
      }
    });
    builder.addCase(deleteUniversityBlogComment.rejected, (state, action) => {
      const commentId = action.meta.arg.commentId;
      state.deletingCommentIds = state.deletingCommentIds.filter((id) => id !== commentId);
      state.mutationError = action.payload;
    });
  },
});

export const { clearCommentError } = blogCommentsSlice.actions;
export default blogCommentsSlice.reducer;
