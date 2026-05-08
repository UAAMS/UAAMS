const mongoose = require("mongoose");
const BlogPost = require("../models/BlogPost");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const getPagination = require("../utils/pagination");
const { persistMaybeDataUrl } = require("../utils/fileStorage");
const { ROLES } = require("../constants/roles");

const ensureObjectId = (id, message = "Invalid resource id.") => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, message);
  }
};

const calculateReadTime = (content) => {
  const words = String(content || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min`;
};

const listBlogPosts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const query = {};

  const includeDrafts = String(req.query.includeDrafts || "false") === "true";
  if (!includeDrafts) {
    query.status = "published";
  }

  if (req.query.category) {
    query.category = String(req.query.category);
  }

  if (req.query.universityId) {
    ensureObjectId(req.query.universityId, "Invalid university id.");
    query.university = req.query.universityId;
  }

  if (req.query.search) {
    const search = String(req.query.search).trim();
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { excerpt: { $regex: search, $options: "i" } },
      { content: { $regex: search, $options: "i" } },
      { tags: { $regex: search, $options: "i" } },
    ];
  }

  const [total, posts] = await Promise.all([
    BlogPost.countDocuments(query),
    BlogPost.find(query)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "name role")
      .populate("university", "name")
      .lean(),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

const getBlogPostById = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid blog id.");

  const post = await BlogPost.findById(req.params.id)
    .populate("author", "name role")
    .populate("university", "name")
    .lean();

  if (!post) {
    throw new ApiError(404, "Blog post not found.");
  }

  const isOwner =
    req.user &&
    (String(post.author?._id || post.author) === String(req.user._id) ||
      req.user.role === ROLES.ADMIN);

  if (post.status !== "published" && !isOwner) {
    throw new ApiError(403, "You do not have permission to access this blog post.");
  }

  if (post.status === "published") {
    await BlogPost.findByIdAndUpdate(post._id, { $inc: { views: 1 } });
    post.views += 1;
  }

  return res.status(200).json({
    success: true,
    data: { post },
  });
});

const createBlogPost = asyncHandler(async (req, res) => {
  const { title, excerpt, content, category, tags, imageUrl, status } = req.body;

  if (!title || !content) {
    throw new ApiError(400, "Title and content are required.");
  }

  let universityId = req.user._id;
  if (req.user.role === ROLES.BLOGGER) {
    if (!req.user.managedUniversity) {
      throw new ApiError(400, "Blogger is not linked to any university.");
    }
    universityId = req.user.managedUniversity;
  }

  const exists = await User.findById(universityId);
  if (!exists) {
    throw new ApiError(404, "University context not found.");
  }

  const normalizedStatus = status === "published" ? "published" : "draft";
  const persistedImageUrl = await persistMaybeDataUrl({
    value: imageUrl,
    folder: `blogs/${String(universityId)}`,
    preferredName: title || "blog-image",
  });

  const post = await BlogPost.create({
    author: req.user._id,
    university: universityId,
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

  return res.status(201).json({
    success: true,
    message: "Blog post created successfully.",
    data: { post },
  });
});

const updateBlogPost = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid blog id.");

  const post = await BlogPost.findById(req.params.id);
  if (!post) {
    throw new ApiError(404, "Blog post not found.");
  }

  const isOwner = String(post.author) === String(req.user._id);
  const isAdmin = req.user.role === ROLES.ADMIN;
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You do not have permission to update this blog post.");
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

  return res.status(200).json({
    success: true,
    message: "Blog post updated successfully.",
    data: { post: updated },
  });
});

const deleteBlogPost = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid blog id.");

  const post = await BlogPost.findById(req.params.id);
  if (!post) {
    throw new ApiError(404, "Blog post not found.");
  }

  const isOwner = String(post.author) === String(req.user._id);
  const isAdmin = req.user.role === ROLES.ADMIN;
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You do not have permission to delete this blog post.");
  }

  await BlogPost.findByIdAndDelete(req.params.id);

  return res.status(200).json({
    success: true,
    message: "Blog post deleted successfully.",
  });
});

module.exports = {
  listBlogPosts,
  getBlogPostById,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
};
