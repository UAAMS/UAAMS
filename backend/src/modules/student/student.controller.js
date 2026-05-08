const mongoose = require("mongoose");
const Application = require("../../models/Application");
const Announcement = require("../../models/Announcement");
const BlogPost = require("../../models/BlogPost");
const BlogComment = require("../../models/BlogComment");
const User = require("../../models/User");
const StudentProfile = require("../../models/StudentProfile");

const asyncHandler = require("../../utils/asyncHandler");
const getPagination = require("../../utils/pagination");
const ApiError = require("../../utils/ApiError");
const { emitDataUpdate } = require("../../utils/socket");

const { ROLES, UNIVERSITY_APPROVAL, USER_STATUS } = require("../../constants/roles");
const {
  ensureStudentRole,
  getMyProfile,
  updateMyProfile,
  getRecommendations,
} = require("../../controllers/student.controller");

const ensureObjectId = (id, message = "Invalid resource id.") => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, message);
  }
};

const normalizeSearchRegex = (search) => ({
  $regex: String(search || "").trim(),
  $options: "i",
});

const MERIT_LIST_PROJECTION = [
  "applicationCode",
  "student",
  "studentName",
  "program",
  "aggregate",
  "status",
  "meritPosition",
  "meritListNumber",
  "rollNumber.number",
  "university",
  "createdAt",
  "updatedAt",
].join(" ");

const DASHBOARD_RECENT_APPLICATIONS_PROJECTION = [
  "applicationCode",
  "university",
  "studentName",
  "program",
  "aggregate",
  "status",
  "payment.status",
  "createdAt",
  "updatedAt",
].join(" ");

const sortCommentTreeByCreatedAt = (items = []) => {
  items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  items.forEach((item) => sortCommentTreeByCreatedAt(item.replies));
  return items;
};

const normalizeComment = (comment, currentUserId) => {
  const likes = Array.isArray(comment?.likes) ? comment.likes : [];
  const studentId = String(comment?.student?._id || comment?.student || "");

  return {
    id: String(comment?._id || ""),
    postId: String(comment?.post || ""),
    parentCommentId: comment?.parentComment ? String(comment.parentComment) : "",
    student: {
      id: studentId,
      name: comment?.student?.name || "Student",
    },
    content: String(comment?.content || ""),
    likesCount: likes.length,
    likedByMe: likes.some((item) => String(item) === String(currentUserId)),
    createdAt: comment?.createdAt || null,
    updatedAt: comment?.updatedAt || null,
    replies: [],
  };
};

const buildCommentThread = (comments, currentUserId) => {
  const commentMap = new Map();
  const roots = [];

  comments.forEach((comment) => {
    const normalized = normalizeComment(comment, currentUserId);
    commentMap.set(normalized.id, normalized);
  });

  comments.forEach((comment) => {
    const id = String(comment?._id || "");
    const parentCommentId = comment?.parentComment ? String(comment.parentComment) : "";
    const current = commentMap.get(id);

    if (!current) return;

    if (parentCommentId && commentMap.has(parentCommentId)) {
      commentMap.get(parentCommentId).replies.push(current);
      return;
    }

    roots.push(current);
  });

  return sortCommentTreeByCreatedAt(roots);
};

const listMyAnnouncements = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const query = { status: "published" };

  if (req.query.type) {
    query.type = String(req.query.type);
  }

  if (req.query.universityId) {
    ensureObjectId(req.query.universityId, "Invalid university id.");
    query.university = req.query.universityId;
  }

  if (req.query.search) {
    query.$or = [
      { title: normalizeSearchRegex(req.query.search) },
      { content: normalizeSearchRegex(req.query.search) },
      { category: normalizeSearchRegex(req.query.search) },
    ];
  }

  const [total, announcements] = await Promise.all([
    Announcement.countDocuments(query),
    Announcement.find(query)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("university", "name")
      .lean(),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      announcements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

const listMyMeritLists = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const meritStatuses = ["accepted", "assigned", "finalized", "rejected"];
  const query = { status: { $in: meritStatuses } };

  if (req.query.universityId) {
    ensureObjectId(req.query.universityId, "Invalid university id.");
    query.university = req.query.universityId;
  }

  if (req.query.program) {
    query.program = String(req.query.program);
  }

  const applications = await Application.find(query)
    .select(MERIT_LIST_PROJECTION)
    .sort({ updatedAt: -1, createdAt: -1 })
    .populate("university", "name")
    .lean();

  const grouped = new Map();
  const currentStudentId = String(req.user._id);

  applications.forEach((application) => {
    const university = application.university || {};
    const universityId = String(university._id || university.id || application.university || "");
    const universityName = university.name || "University";
    const listNumber = Number(application.meritListNumber || 1);
    const key = `${universityId}::${application.program}::${listNumber}`;

    if (!grouped.has(key)) {
      const year = new Date(application.createdAt || Date.now()).getFullYear();
      grouped.set(key, {
        id: key,
        universityId,
        university: universityName,
        program: application.program,
        session: `Fall ${year}`,
        listNumber,
        publishedDate: new Date(
          application.updatedAt || application.createdAt || Date.now()
        ).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        totalSeats: 0,
        entries: [],
      });
    }

    const list = grouped.get(key);
    list.entries.push({
      id: String(application._id),
      rollNumber:
        application.rollNumber?.number ||
        application.applicationCode ||
        `APP-${String(application._id).slice(-6).toUpperCase()}`,
      studentName: application.studentName,
      program: application.program,
      aggregate: Number(application.aggregate || 0),
      status: application.status === "rejected" ? "not-selected" : "selected",
      meritPosition: Number(application.meritPosition || 0),
      isCurrentStudent: String(application.student) === currentStudentId,
    });
  });

  const meritLists = Array.from(grouped.values()).map((list) => {
    const sortedEntries = list.entries
      .slice()
      .sort((a, b) => {
        if (a.meritPosition > 0 && b.meritPosition > 0) {
          return a.meritPosition - b.meritPosition;
        }
        return b.aggregate - a.aggregate;
      })
      .map((entry, index) => ({
        ...entry,
        meritPosition: entry.meritPosition > 0 ? entry.meritPosition : index + 1,
      }));

    return {
      ...list,
      entries: sortedEntries,
      totalSeats: sortedEntries.filter((entry) => entry.status === "selected").length,
    };
  });

  meritLists.sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate));

  const total = meritLists.length;
  const paginatedLists = meritLists.slice(skip, skip + limit);

  return res.status(200).json({
    success: true,
    data: {
      meritLists: paginatedLists,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

const listMyBlogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const query = { status: "published" };

  if (req.query.category) {
    query.category = String(req.query.category);
  }

  if (req.query.universityId) {
    ensureObjectId(req.query.universityId, "Invalid university id.");
    query.university = req.query.universityId;
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
      .select("-viewedBy")
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "name")
      .populate("university", "name")
      .lean(),
  ]);

  const postIds = posts.map((post) => post?._id).filter(Boolean);
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
    const likes = Array.isArray(post?.likes) ? post.likes : [];
    const stats = commentStatsByPostId.get(String(post?._id || "")) || {
      commentsCount: 0,
      repliesCount: 0,
    };

    return {
      ...post,
      likesCount: likes.length,
      likedByMe: likes.some((item) => String(item) === String(req.user._id)),
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

const recordBlogPostView = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.postId, "Invalid blog id.");

  const post = await BlogPost.findById(req.params.postId).lean();
  if (!post || post.status !== "published") {
    throw new ApiError(404, "Blog post not found.");
  }

  const updatedPost = await BlogPost.findOneAndUpdate(
    {
      _id: req.params.postId,
      viewedBy: { $ne: req.user._id },
    },
    {
      $addToSet: { viewedBy: req.user._id },
      $inc: { views: 1 },
    },
    { new: true },
  );

  const views = Number(updatedPost?.views ?? post.views ?? 0);

  return res.status(200).json({
    success: true,
    data: {
      postId: String(req.params.postId),
      views,
    },
  });
});

const getMyDashboard = asyncHandler(async (req, res) => {
  const studentProfile = await StudentProfile.findOne({ user: req.user._id }).lean();

  const [
    totalApplications,
    pendingApplications,
    acceptedApplications,
    announcementsCount,
    recommendationsCount,
    recentApplications,
  ] = await Promise.all([
    Application.countDocuments({ student: req.user._id }),
    Application.countDocuments({
      student: req.user._id,
      status: { $in: ["pending", "under-review"] },
    }),
    Application.countDocuments({
      student: req.user._id,
      status: { $in: ["accepted", "assigned", "finalized"] },
    }),
    Announcement.countDocuments({ status: "published" }),
    User.countDocuments({
      role: ROLES.UNIVERSITY,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
      status: USER_STATUS.ACTIVE,
    }),
    Application.find({ student: req.user._id })
      .select(DASHBOARD_RECENT_APPLICATIONS_PROJECTION)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("university", "name")
      .lean(),
  ]);

  const completionKeys = [
    "fullName",
    "email",
    "phone",
    "cnic",
    "address",
    "city",
    "matricObtainedMarks",
    "interObtainedMarks",
    "preferredPrograms",
    "preferredCities",
    "profilePicture",
    "domicileDocument",
    "matricResultDocument",
    "interResultDocument",
  ];
  const completed = completionKeys.filter((key) => {
    const value = studentProfile?.[key];
    if (Array.isArray(value)) return value.length > 0;
    return String(value || "").trim().length > 0;
  }).length;
  const profileCompletion = Math.round((completed / completionKeys.length) * 100);

  return res.status(200).json({
    success: true,
    data: {
      metrics: {
        totalApplications,
        pendingApplications,
        acceptedApplications,
        recommendationsCount,
        announcementsCount,
        profileCompletion,
      },
      recentApplications,
    },
  });
});

const getBlogComments = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.postId, "Invalid blog id.");

  const post = await BlogPost.findById(req.params.postId).lean();
  if (!post || post.status !== "published") {
    throw new ApiError(404, "Blog post not found.");
  }

  const comments = await BlogComment.find({ post: req.params.postId })
    .sort({ createdAt: 1 })
    .populate("student", "name")
    .lean();

  const nestedComments = buildCommentThread(comments, req.user._id);
  const likes = Array.isArray(post.likes) ? post.likes : [];

  return res.status(200).json({
    success: true,
    data: {
      comments: nestedComments,
      postInteraction: {
        likesCount: likes.length,
        likedByMe: likes.some((item) => String(item) === String(req.user._id)),
      },
    },
  });
});

const createBlogComment = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.postId, "Invalid blog id.");

  const content = String(req.body?.content || "").trim();
  const parentCommentId = req.body?.parentCommentId || null;

  if (!content) {
    throw new ApiError(400, "Comment text is required.");
  }

  const post = await BlogPost.findById(req.params.postId);
  if (!post || post.status !== "published") {
    throw new ApiError(404, "Blog post not found.");
  }

  let validatedParentCommentId = null;
  if (parentCommentId) {
    ensureObjectId(parentCommentId, "Invalid parent comment id.");
    const parentComment = await BlogComment.findOne({
      _id: parentCommentId,
      post: req.params.postId,
    }).lean();

    if (!parentComment) {
      throw new ApiError(404, "Parent comment not found.");
    }

    validatedParentCommentId = parentCommentId;
  }

  const comment = await BlogComment.create({
    post: req.params.postId,
    student: req.user._id,
    parentComment: validatedParentCommentId,
    content,
  });

  const hydratedComment = await BlogComment.findById(comment._id).populate("student", "name").lean();

  emitDataUpdate({
    resource: "blog-interactions",
    action: "created",
    roles: ["student", "blogger", "university"],
    userIds: [String(post.author || ""), String(post.university || "")].filter(Boolean),
    payload: {
      postId: String(post._id),
      commentId: String(comment._id),
      parentCommentId: validatedParentCommentId ? String(validatedParentCommentId) : "",
    },
  });

  return res.status(201).json({
    success: true,
    message: validatedParentCommentId
      ? "Reply added successfully."
      : "Comment added successfully.",
    data: {
      comment: normalizeComment(hydratedComment, req.user._id),
    },
  });
});

const toggleBlogPostLike = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.postId, "Invalid blog id.");

  const post = await BlogPost.findById(req.params.postId);
  if (!post || post.status !== "published") {
    throw new ApiError(404, "Blog post not found.");
  }

  const currentUserId = String(req.user._id);
  const currentlyLiked = Array.isArray(post.likes)
    ? post.likes.some((item) => String(item) === currentUserId)
    : false;

  if (currentlyLiked) {
    post.likes = post.likes.filter((item) => String(item) !== currentUserId);
  } else {
    post.likes.push(req.user._id);
  }

  await post.save();

  emitDataUpdate({
    resource: "blog-interactions",
    action: "updated",
    roles: ["student", "blogger", "university"],
    userIds: [String(post.author || ""), String(post.university || "")].filter(Boolean),
    payload: {
      postId: String(post._id),
      likedByMe: !currentlyLiked,
      likesCount: post.likes.length,
    },
  });

  return res.status(200).json({
    success: true,
    data: {
      postId: String(post._id),
      likedByMe: !currentlyLiked,
      likesCount: post.likes.length,
    },
  });
});

const toggleBlogCommentLike = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.commentId, "Invalid comment id.");

  const comment = await BlogComment.findById(req.params.commentId).populate(
    "post",
    "status author university"
  );

  if (!comment) {
    throw new ApiError(404, "Comment not found.");
  }

  if (!comment.post || comment.post.status !== "published") {
    throw new ApiError(404, "Related blog post not found.");
  }

  const currentUserId = String(req.user._id);
  const currentlyLiked = Array.isArray(comment.likes)
    ? comment.likes.some((item) => String(item) === currentUserId)
    : false;

  if (currentlyLiked) {
    comment.likes = comment.likes.filter((item) => String(item) !== currentUserId);
  } else {
    comment.likes.push(req.user._id);
  }

  await comment.save();

  emitDataUpdate({
    resource: "blog-interactions",
    action: "updated",
    roles: ["student", "blogger", "university"],
    userIds: [String(comment.post.author || ""), String(comment.post.university || "")].filter(Boolean),
    payload: {
      postId: String(comment.post._id),
      commentId: String(comment._id),
      likedByMe: !currentlyLiked,
      likesCount: comment.likes.length,
    },
  });

  return res.status(200).json({
    success: true,
    data: {
      postId: String(comment.post._id),
      commentId: String(comment._id),
      likedByMe: !currentlyLiked,
      likesCount: comment.likes.length,
    },
  });
});

module.exports = {
  ensureStudentRole,
  getMyProfile,
  updateMyProfile,
  getRecommendations,
  getMyDashboard,
  listMyAnnouncements,
  listMyMeritLists,
  listMyBlogs,
  recordBlogPostView,
  getBlogComments,
  createBlogComment,
  toggleBlogPostLike,
  toggleBlogCommentLike,
};
