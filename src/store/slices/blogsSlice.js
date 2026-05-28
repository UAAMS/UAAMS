import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "../../lib/apiClient";

const countRootComments = (items = []) => items.length;
const countReplies = (items = []) =>
  items.reduce((sum, item) => {
    const directReplies = Array.isArray(item?.replies) ? item.replies.length : 0;
    return sum + directReplies;
  }, 0);

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const normalizePost = (item) => ({
  id: String(item?._id || item?.id || ""),
  title: item?.title || "",
  excerpt: item?.excerpt || "",
  content: item?.content || "",
  author: item?.author?.name || item?.universityProfile?.representativeName || "University Representative",
  authorTitle: item?.author?.role === "blogger" ? "University Blogger" : "University Representative",
  authorRole: item?.author?.role || "university",
  authorProfilePicture:
    item?.author?.profilePicture ||
    item?.universityProfile?.representativeProfilePicture ||
    "",
  university: item?.universityProfile?.universityName || item?.university?.name || "University",
  universityLogo: item?.universityProfile?.logo || "",
  representativeProfilePicture: item?.universityProfile?.representativeProfilePicture || "",
  publishDate: formatDate(item?.publishedAt || item?.createdAt),
  readTime: item?.readTime || "1 min",
  category: item?.category || "General",
  tags: Array.isArray(item?.tags) ? item.tags : [],
  imageUrl: item?.imageUrl || "",
  views: Number(item?.views || 0),
  likesCount: Number(item?.likesCount || 0),
  likedByMe: Boolean(item?.likedByMe),
  commentsCount: Number(item?.commentsCount || 0),
  repliesCount: Number(item?.repliesCount || 0),
});

export const fetchStudentBlogs = createAsyncThunk(
  "blogs/fetchStudentBlogs",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/students/me/blogs?limit=200");
      const items = response?.data?.posts || [];
      return items.map(normalizePost);
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to load blog posts.");
    }
  },
);

export const fetchBlogComments = createAsyncThunk(
  "blogs/fetchBlogComments",
  async (postId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/students/blogs/${postId}/comments`);
      return {
        postId: String(postId),
        comments: Array.isArray(response?.data?.comments) ? response.data.comments : [],
        postInteraction: response?.data?.postInteraction || {},
      };
    } catch (error) {
      return rejectWithValue({
        postId: String(postId),
        message: error?.message || "Unable to load comments.",
      });
    }
  },
);

export const markBlogPostViewed = createAsyncThunk(
  "blogs/markBlogPostViewed",
  async (postId, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/students/blogs/${postId}/view`);
      const views = Number(response?.data?.data?.views ?? response?.data?.views ?? 0);
      return { postId: String(postId), views };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to record blog view.");
    }
  },
);

export const toggleBlogPostLike = createAsyncThunk(
  "blogs/toggleBlogPostLike",
  async (postId, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/students/blogs/${postId}/like`);
      return {
        postId: String(postId),
        data: response?.data || {},
      };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to update like.");
    }
  },
);

export const addBlogComment = createAsyncThunk(
  "blogs/addBlogComment",
  async ({ postId, content, parentCommentId = "" }, { dispatch, rejectWithValue }) => {
    try {
      await api.post(`/students/blogs/${postId}/comments`, {
        content,
        parentCommentId: parentCommentId || undefined,
      });
      await dispatch(fetchBlogComments(postId));
      return { postId: String(postId) };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to add comment.");
    }
  },
);

export const toggleBlogCommentLike = createAsyncThunk(
  "blogs/toggleBlogCommentLike",
  async ({ postId, commentId }, { dispatch, rejectWithValue }) => {
    try {
      await api.patch(`/students/blog-comments/${commentId}/like`);
      await dispatch(fetchBlogComments(postId));
      return { postId: String(postId), commentId: String(commentId) };
    } catch (error) {
      return rejectWithValue(error?.message || "Unable to update comment like.");
    }
  },
);

const blogsSlice = createSlice({
  name: "blogs",
  initialState: {
    posts: [],
    postsLoading: false,
    postsError: "",
    commentsByPost: {},
    commentErrorsByPost: {},
    loadingCommentsByPost: {},
    postingCommentByPost: {},
    togglingPostLikeIds: [],
  },
  reducers: {
    clearBlogErrors(state) {
      state.postsError = "";
      state.commentErrorsByPost = {};
    },
    syncBlogRealtime(state, action) {
      const payload = action.payload || {};
      const postId = String(payload.postId || "");
      if (!postId) return;
      const index = state.posts.findIndex((post) => post.id === postId);
      if (index === -1) return;
      if (typeof payload.likesCount === "number") {
        state.posts[index].likesCount = payload.likesCount;
      }
      if (typeof payload.likedByMe === "boolean") {
        state.posts[index].likedByMe = payload.likedByMe;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStudentBlogs.pending, (state) => {
        state.postsLoading = true;
        state.postsError = "";
      })
      .addCase(fetchStudentBlogs.fulfilled, (state, action) => {
        state.postsLoading = false;
        state.posts = action.payload;
      })
      .addCase(fetchStudentBlogs.rejected, (state, action) => {
        state.postsLoading = false;
        state.postsError = action.payload || "Unable to load blog posts.";
      })
      .addCase(fetchBlogComments.pending, (state, action) => {
        const postId = String(action.meta.arg || "");
        state.loadingCommentsByPost[postId] = true;
        state.commentErrorsByPost[postId] = "";
      })
      .addCase(fetchBlogComments.fulfilled, (state, action) => {
        const { postId, comments, postInteraction } = action.payload;
        state.loadingCommentsByPost[postId] = false;
        state.commentsByPost[postId] = comments;
        const index = state.posts.findIndex((post) => post.id === postId);
        if (index !== -1) {
          if (typeof postInteraction.likesCount === "number") {
            state.posts[index].likesCount = Number(postInteraction.likesCount || 0);
          }
          if (typeof postInteraction.likedByMe === "boolean") {
            state.posts[index].likedByMe = postInteraction.likedByMe;
          }
          state.posts[index].commentsCount = countRootComments(comments);
          state.posts[index].repliesCount = countReplies(comments);
        }
      })
      .addCase(fetchBlogComments.rejected, (state, action) => {
        const postId = String(action.meta.arg || action.payload?.postId || "");
        state.loadingCommentsByPost[postId] = false;
        state.commentErrorsByPost[postId] =
          action.payload?.message || action.payload || "Unable to load comments.";
      })
      .addCase(toggleBlogPostLike.pending, (state, action) => {
        state.togglingPostLikeIds.push(String(action.meta.arg || ""));
      })
      .addCase(toggleBlogPostLike.fulfilled, (state, action) => {
        const { postId, data } = action.payload;
        state.togglingPostLikeIds = state.togglingPostLikeIds.filter((id) => id !== postId);
        const index = state.posts.findIndex((post) => post.id === postId);
        if (index !== -1) {
          state.posts[index].likesCount = Number(data.likesCount ?? state.posts[index].likesCount);
          state.posts[index].likedByMe = Boolean(data.likedByMe ?? state.posts[index].likedByMe);
        }
      })
      .addCase(markBlogPostViewed.fulfilled, (state, action) => {
        const { postId, views } = action.payload;
        const index = state.posts.findIndex((post) => post.id === postId);
        if (index !== -1) {
          state.posts[index].views = views;
        }
      })
      .addCase(toggleBlogPostLike.rejected, (state, action) => {
        const postId = String(action.meta.arg || "");
        state.togglingPostLikeIds = state.togglingPostLikeIds.filter((id) => id !== postId);
        state.postsError = action.payload || "Unable to update like.";
      })
      .addCase(addBlogComment.pending, (state, action) => {
        const postId = String(action.meta.arg?.postId || "");
        state.postingCommentByPost[postId] = true;
      })
      .addCase(addBlogComment.fulfilled, (state, action) => {
        const postId = String(action.payload?.postId || "");
        state.postingCommentByPost[postId] = false;
      })
      .addCase(addBlogComment.rejected, (state, action) => {
        const postId = String(action.meta.arg?.postId || "");
        state.postingCommentByPost[postId] = false;
        state.commentErrorsByPost[postId] = action.payload || "Unable to add comment.";
      })
      .addCase(toggleBlogCommentLike.rejected, (state, action) => {
        const postId = String(action.meta.arg?.postId || "");
        state.commentErrorsByPost[postId] = action.payload || "Unable to update comment like.";
      });
  },
});

export const { clearBlogErrors, syncBlogRealtime } = blogsSlice.actions;
export default blogsSlice.reducer;
