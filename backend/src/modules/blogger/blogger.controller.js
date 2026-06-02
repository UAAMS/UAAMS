const mongoose = require("mongoose");
const BlogPost = require("../../models/BlogPost");
const BlogComment = require("../../models/BlogComment");
const User = require("../../models/User");
const ApiError = require("../../utils/ApiError");
const asyncHandler = require("../../utils/asyncHandler");
const getPagination = require("../../utils/pagination");
const { emitDataUpdate } = require("../../utils/socket");
const { persistMaybeDataUrl } = require("../../utils/fileStorage");
const { isValidEmail, isValidName, isValidPhone } = require("../../utils/validators");

const ensureObjectId = (id, message = "Invalid resource id.") => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, message);
  }
};

const deleteCommentThread = async (commentId) => {
  const queue = [commentId];
  const allIds = [];

  while (queue.length > 0) {
    const currentId = queue.shift();
    allIds.push(currentId);

    const children = await BlogComment.find({ parentComment: currentId })
      .select("_id")
      .lean();

    children.forEach((child) => queue.push(String(child._id)));
  }

  await BlogComment.deleteMany({ _id: { $in: allIds } });
};

const normalizeSearchRegex = (search) => ({
  $regex: String(search || "").trim(),
  $options: "i",
});

const calculateReadTime = (content) => {
  const words = String(content || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min`;
};

const getMyProfile = asyncHandler(async (req, res) => {
  const blogger = await User.findById(req.user._id)
    .populate("managedUniversity", "name email")
    .lean();

  if (!blogger) {
    throw new ApiError(404, "Blogger account not found.");
  }

  return res.status(200).json({
    success: true,
    data: { profile: blogger },
  });
});

const updateMyProfile = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  const allowedFields = [
    "name",
    "email",
    "username",
    "phone",
    "location",
    "website",
    "profilePicture",
  ];
  const updates = {};

  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      updates[field] = payload[field];
    }
  });

  if (Object.prototype.hasOwnProperty.call(updates, "email")) {
    const normalizedEmail = String(updates.email || "").trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      throw new ApiError(400, "Enter a valid email address.");
    }

    const existingEmail = await User.findOne({
      _id: { $ne: req.user._id },
      email: normalizedEmail,
    });
    if (existingEmail) {
      throw new ApiError(409, "This email is already in use.");
    }
    updates.email = normalizedEmail;
  }

  if (Object.prototype.hasOwnProperty.call(updates, "username")) {
    const normalizedUsername = String(updates.username || "").trim().toLowerCase();
    if (!normalizedUsername) {
      throw new ApiError(400, "Username cannot be empty.");
    }

    const existingUsername = await User.findOne({
      _id: { $ne: req.user._id },
      username: normalizedUsername,
    });
    if (existingUsername) {
      throw new ApiError(409, "This username is already in use.");
    }
    updates.username = normalizedUsername;
  }

  if (Object.prototype.hasOwnProperty.call(updates, "name")) {
    updates.name = String(updates.name || "").trim();
    if (!isValidName(updates.name)) {
      throw new ApiError(400, "Enter a valid blogger name.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, "phone")) {
    updates.phone = String(updates.phone || "").trim();
    if (updates.phone && !isValidPhone(updates.phone)) {
      throw new ApiError(400, "Enter a valid mobile number.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, "location")) {
    updates.location = String(updates.location || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(updates, "website")) {
    updates.website = String(updates.website || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(updates, "profilePicture")) {
    updates.profilePicture = await persistMaybeDataUrl({
      value: updates.profilePicture,
      folder: `blogger-profiles/${String(req.user._id)}`,
      preferredName: updates.username || updates.name || "blogger-profile",
    });
    updates.profilePicture = String(updates.profilePicture || "");
  }

  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true }
  )
    .populate("managedUniversity", "name email")
    .lean();

  return res.status(200).json({
    success: true,
    message: "Blogger profile updated successfully.",
    data: { profile: updated },
  });
});

const changeMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Current password and new password are required.");
  }

  if (String(newPassword).length < 6) {
    throw new ApiError(400, "New password must be at least 6 characters long.");
  }

  if (confirmPassword !== undefined && String(newPassword) !== String(confirmPassword)) {
    throw new ApiError(400, "New password and confirm password do not match.");
  }

  const blogger = await User.findById(req.user._id).select("+password");
  if (!blogger) {
    throw new ApiError(404, "Blogger account not found.");
  }

  const isCurrentPasswordValid = await blogger.comparePassword(String(currentPassword));
  if (!isCurrentPasswordValid) {
    throw new ApiError(400, "Current password is incorrect.");
  }

  if (String(currentPassword) === String(newPassword)) {
    throw new ApiError(400, "New password must be different from current password.");
  }

  blogger.password = String(newPassword);
  await blogger.save();

  return res.status(200).json({
    success: true,
    message: "Password changed successfully.",
  });
});

const getMyDashboard = asyncHandler(async (req, res) => {
  const blogger = await User.findById(req.user._id)
    .populate("managedUniversity", "name email")
    .lean();

  if (!blogger) {
    throw new ApiError(404, "Blogger account not found.");
  }

  const [allPosts, totalPosts, publishedPosts, draftPosts, recentPosts] = await Promise.all([
    BlogPost.find({ author: req.user._id }).select("_id views likes").lean(),
    BlogPost.countDocuments({ author: req.user._id }),
    BlogPost.countDocuments({ author: req.user._id, status: "published" }),
    BlogPost.countDocuments({ author: req.user._id, status: "draft" }),
    BlogPost.find({ author: req.user._id })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(5)
      .populate("university", "name")
      .lean(),
  ]);

  const totalViews = allPosts.reduce((sum, item) => sum + Number(item?.views || 0), 0);
  const totalPostLikes = allPosts.reduce(
    (sum, item) => sum + (Array.isArray(item?.likes) ? item.likes.length : 0),
    0
  );
  const allPostIds = allPosts.map((item) => item?._id).filter(Boolean);

  let totalComments = 0;
  let totalReplies = 0;
  let commentStatsByPostId = new Map();

  if (allPostIds.length > 0) {
    const commentStats = await BlogComment.aggregate([
      { $match: { post: { $in: allPostIds } } },
      {
        $group: {
          _id: "$post",
          commentsCount: {
            $sum: {
              $cond: [{ $eq: ["$parentComment", null] }, 1, 0],
            },
          },
          repliesCount: {
            $sum: {
              $cond: [{ $ne: ["$parentComment", null] }, 1, 0],
            },
          },
        },
      },
    ]);

    commentStatsByPostId = new Map(
      commentStats.map((item) => [
        String(item._id),
        {
          commentsCount: Number(item.commentsCount || 0),
          repliesCount: Number(item.repliesCount || 0),
        },
      ])
    );

    commentStats.forEach((item) => {
      totalComments += Number(item.commentsCount || 0);
      totalReplies += Number(item.repliesCount || 0);
    });
  }

  const enrichedRecentPosts = recentPosts.map((post) => {
    const postStats = commentStatsByPostId.get(String(post?._id || "")) || {
      commentsCount: 0,
      repliesCount: 0,
    };
    return {
      ...post,
      likesCount: Array.isArray(post?.likes) ? post.likes.length : 0,
      commentsCount: postStats.commentsCount,
      repliesCount: postStats.repliesCount,
    };
  });

  return res.status(200).json({
    success: true,
    data: {
      metrics: {
        totalPosts,
        publishedPosts,
        draftPosts,
        totalViews,
        totalPostLikes,
        totalComments,
        totalReplies,
      },
      recentPosts: enrichedRecentPosts,
      managedUniversity: blogger.managedUniversity || null,
    },
  });
});

const listMyPosts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const query = { author: req.user._id };

  if (req.query.status) {
    query.status = String(req.query.status);
  }

  if (req.query.category) {
    query.category = String(req.query.category);
  }

  if (req.query.search) {
    query.$or = [
      { title: normalizeSearchRegex(req.query.search) },
      { excerpt: normalizeSearchRegex(req.query.search) },
      { content: normalizeSearchRegex(req.query.search) },
      { tags: normalizeSearchRegex(req.query.search) },
    ];
  }

  const [total, posts] = await Promise.all([
    BlogPost.countDocuments(query),
    BlogPost.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("university", "name")
      .lean(),
  ]);

  const postIds = posts.map((item) => item?._id).filter(Boolean);
  let commentStatsByPostId = new Map();

  if (postIds.length > 0) {
    const commentStats = await BlogComment.aggregate([
      { $match: { post: { $in: postIds } } },
      {
        $group: {
          _id: "$post",
          commentsCount: {
            $sum: {
              $cond: [{ $eq: ["$parentComment", null] }, 1, 0],
            },
          },
          repliesCount: {
            $sum: {
              $cond: [{ $ne: ["$parentComment", null] }, 1, 0],
            },
          },
        },
      },
    ]);

    commentStatsByPostId = new Map(
      commentStats.map((item) => [
        String(item._id),
        {
          commentsCount: Number(item.commentsCount || 0),
          repliesCount: Number(item.repliesCount || 0),
        },
      ])
    );
  }

  const normalizedPosts = posts.map((post) => {
    const stats = commentStatsByPostId.get(String(post?._id || "")) || {
      commentsCount: 0,
      repliesCount: 0,
    };

    return {
      ...post,
      likesCount: Array.isArray(post?.likes) ? post.likes.length : 0,
      commentsCount: stats.commentsCount,
      repliesCount: stats.repliesCount,
    };
  });

  return res.status(200).json({
    success: true,
    data: {
      posts: normalizedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

const createMyPost = asyncHandler(async (req, res) => {
  const { title, excerpt, content, category, tags, imageUrl, status } = req.body;

  if (!title || !content) {
    throw new ApiError(400, "Title and content are required.");
  }

  if (!req.user.managedUniversity) {
    throw new ApiError(400, "Blogger is not linked to any university.");
  }

  const university = await User.findById(req.user.managedUniversity);
  if (!university) {
    throw new ApiError(404, "Managed university not found.");
  }

  const normalizedStatus = status === "published" ? "published" : "draft";
  const persistedImageUrl = await persistMaybeDataUrl({
    value: imageUrl,
    folder: `blogs/${String(university._id)}`,
    preferredName: title || "blog-image",
  });

  const post = await BlogPost.create({
    author: req.user._id,
    university: university._id,
    title: String(title).trim(),
    excerpt: String(excerpt || content.slice(0, 180)).trim(),
    content: String(content).trim(),
    category: String(category || "General"),
    tags: Array.isArray(tags)
      ? tags.map((item) => String(item).trim()).filter(Boolean)
      : String(tags || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
    imageUrl: String(persistedImageUrl || ""),
    status: normalizedStatus,
    readTime: calculateReadTime(content),
    publishedAt: normalizedStatus === "published" ? new Date() : null,
  });

  emitDataUpdate({
    resource: "blogs",
    action: "created",
    roles: ["student", "university"],
    payload: {
      universityId: String(university._id),
      postId: String(post._id),
      status: post.status,
    },
  });

  return res.status(201).json({
    success: true,
    message: "Blog post created successfully.",
    data: { post },
  });
});

const updateMyPost = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid blog id.");

  const post = await BlogPost.findOne({
    _id: req.params.id,
    author: req.user._id,
  });

  if (!post) {
    throw new ApiError(404, "Blog post not found.");
  }

  const updates = { ...req.body };
  delete updates._id;
  delete updates.author;
  delete updates.university;
  delete updates.views;
  delete updates.likes;

  if (updates.content) {
    updates.readTime = calculateReadTime(updates.content);
  }

  if (updates.tags && !Array.isArray(updates.tags)) {
    updates.tags = String(updates.tags)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (Object.prototype.hasOwnProperty.call(updates, "imageUrl")) {
    updates.imageUrl = await persistMaybeDataUrl({
      value: updates.imageUrl,
      folder: `blogs/${String(post.university)}`,
      preferredName: updates.title || post.title || "blog-image",
    });
    updates.imageUrl = String(updates.imageUrl || "");
  }

  if (updates.status === "published" && !post.publishedAt) {
    updates.publishedAt = new Date();
  }

  const updated = await BlogPost.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  emitDataUpdate({
    resource: "blogs",
    action: "updated",
    roles: ["student", "university"],
    payload: {
      universityId: String(updated?.university || post.university),
      postId: String(updated?._id || post._id),
      status: updated?.status || post.status,
    },
  });

  return res.status(200).json({
    success: true,
    message: "Blog post updated successfully.",
    data: { post: updated },
  });
});

const deleteMyPost = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid blog id.");

  const deleted = await BlogPost.findOneAndDelete({
    _id: req.params.id,
    author: req.user._id,
  });

  if (!deleted) {
    throw new ApiError(404, "Blog post not found.");
  }

  emitDataUpdate({
    resource: "blogs",
    action: "deleted",
    roles: ["student", "university"],
    payload: {
      universityId: String(deleted.university || req.user.managedUniversity || ""),
      postId: String(deleted._id),
    },
  });

  return res.status(200).json({
    success: true,
    message: "Blog post deleted successfully.",
  });
});

const getMyPostComments = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.postId, "Invalid blog id.");

  const post = await BlogPost.findOne({
    _id: req.params.postId,
    author: req.user._id,
  });

  if (!post) {
    throw new ApiError(404, "Blog post not found.");
  }

  const comments = await BlogComment.find({ post: req.params.postId })
    .sort({ createdAt: 1 })
    .populate("student", "name")
    .populate("parentComment", "content")
    .lean();

  const nestedComments = buildCommentThread(comments, req.user._id);

  return res.status(200).json({
    success: true,
    data: {
      comments: nestedComments,
      post: {
        id: post._id,
        title: post.title,
        status: post.status,
      },
    },
  });
});

const deleteMyPostComment = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.postId, "Invalid blog id.");
  ensureObjectId(req.params.commentId, "Invalid comment id.");

  const post = await BlogPost.findOne({
    _id: req.params.postId,
    author: req.user._id,
  });

  if (!post) {
    throw new ApiError(404, "Blog post not found.");
  }

  const comment = await BlogComment.findOne({
    _id: req.params.commentId,
    post: req.params.postId,
  });

  if (!comment) {
    throw new ApiError(404, "Comment not found.");
  }

  await deleteCommentThread(req.params.commentId);

  emitDataUpdate({
    resource: "blog-interactions",
    action: "deleted",
    roles: ["student", "blogger", "university"],
    userIds: [String(post.author || ""), String(post.university || "")].filter(Boolean),
    payload: {
      postId: String(post._id),
      commentId: String(req.params.commentId),
    },
  });

  return res.status(200).json({
    success: true,
    message: "Comment deleted successfully.",
  });
});

const buildCommentThread = (comments, currentUserId) => {
  const commentMap = new Map();
  const rootComments = [];

  comments.forEach((comment) => {
    const normalized = {
      id: comment._id,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      likesCount: Array.isArray(comment.likes) ? comment.likes.length : 0,
      likedByMe: Array.isArray(comment.likes)
        ? comment.likes.some((item) => String(item) === String(currentUserId))
        : false,
      student: comment.student,
      replies: [],
    };

    commentMap.set(String(comment._id), normalized);

    const parentId = comment.parentComment?
      (typeof comment.parentComment === "object" ? String(comment.parentComment._id) : String(comment.parentComment))
      : null;

    if (parentId) {
      const parent = commentMap.get(parentId);
      if (parent) {
        parent.replies.push(normalized);
      }
    } else {
      rootComments.push(normalized);
    }
  });

  return rootComments;
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  getMyDashboard,
  listMyPosts,
  createMyPost,
  updateMyPost,
  deleteMyPost,
  getMyPostComments,
  deleteMyPostComment,
};
