const mongoose = require("mongoose");
const Application = require("../../models/Application");
const Announcement = require("../../models/Announcement");
const BlogPost = require("../../models/BlogPost");
const BlogComment = require("../../models/BlogComment");
const RecommendationSnapshot = require("../../models/RecommendationSnapshot");
const UniversityProfile = require("../../models/UniversityProfile");
const User = require("../../models/User");
const ApiError = require("../../utils/ApiError");
const asyncHandler = require("../../utils/asyncHandler");
const getPagination = require("../../utils/pagination");
const { emitDataUpdate } = require("../../utils/socket");
const { persistMaybeDataUrl } = require("../../utils/fileStorage");
const { normalizePaymentMethods } = require("../../utils/paymentMethods");
const { deleteCache } = require("../../utils/cacheClient");
const {
  isNumberInRange,
  isPdfUpload,
  isValidEmail,
  isValidName,
  isValidPhone,
  isValidRollNumber,
} = require("../../utils/validators");
const {
  sendRollNumberAssignedEmail,
  sendAdmissionLetterIssuedEmail,
} = require("../../utils/mailer");
const {
  listUniversities,
  getUniversityById,
  getUniversityFormByUniversityId,
  getMyProfile,
  updateMyProfile,
  getMyForm,
  upsertMyForm,
  listMyBloggers,
  createBlogger,
  updateMyBloggerStatus,
  deleteMyBlogger,
  invalidateUniversityPublicCache,
} = require("../../controllers/university.controller");

const UNIVERSITY_RECOMMENDATION_DATASET_CACHE_KEY = "recommendations:universities:dataset:v3";

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

const normalizeProgramDeadlineDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const parseOptionalDateTime = (value, fieldLabel) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `${fieldLabel} must be a valid date and time.`);
  }
  return date;
};

const normalizeAnnouncementVisibilityWindow = ({ visibleFrom, expiresAt, status }) => {
  const start = parseOptionalDateTime(visibleFrom, "Visible from");
  const end = parseOptionalDateTime(expiresAt, "Visible until");

  if (status === "published" && !end) {
    throw new ApiError(400, "Visible until date and time is required for published announcements.");
  }

  if (start && end && end.getTime() <= start.getTime()) {
    throw new ApiError(400, "Visible until must be after visible from.");
  }

  return {
    visibleFrom: start,
    expiresAt: end,
  };
};

const hasProgramDeadlinePassed = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  date.setHours(23, 59, 59, 999);
  return date.getTime() < Date.now();
};

const invalidateStudentRecommendationCache = async () => {
  deleteCache(UNIVERSITY_RECOMMENDATION_DATASET_CACHE_KEY);
  await RecommendationSnapshot.deleteMany({});
};

const sanitizeProfilePayload = (payload = {}) => {
  const allowedFields = [
    "universityName",
    "shortName",
    "type",
    "established",
    "email",
    "phone",
    "website",
    "address",
    "city",
    "province",
    "postalCode",
    "about",
    "mission",
    "vision",
    "totalStudents",
    "totalPrograms",
    "ranking",
    "accreditation",
    "representativeName",
    "representativePosition",
    "representativeEmail",
    "representativePhone",
    "representativeProfilePicture",
    "logo",
    "applicationFee",
    "minimumFscPercentage",
    "minimumMatricPercentage",
    "applicationStartDate",
    "applicationEndDate",
    "acceptApplicationsThroughUaams",
    "allowAutoFillFromStudentProfile",
    "notifications",
    "programs",
    "paymentMethods",
  ];

  const sanitized = {};
  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      sanitized[field] = payload[field];
    }
  });

  return sanitized;
};

const isValidOrganizationName = (value) =>
  /^[A-Za-z][A-Za-z0-9 .,'&()/-]{2,159}$/.test(String(value || "").trim());

const validateSettingsPayload = (payload) => {
  if (
    Object.prototype.hasOwnProperty.call(payload, "universityName") &&
    !isValidOrganizationName(payload.universityName)
  ) {
    throw new ApiError(400, "Enter a valid university name.");
  }

  if (Object.prototype.hasOwnProperty.call(payload, "email")) {
    payload.email = String(payload.email || "").trim().toLowerCase();
    if (!isValidEmail(payload.email)) {
      throw new ApiError(400, "Enter a valid university email address.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "phone")) {
    payload.phone = String(payload.phone || "").trim();
    if (payload.phone && !isValidPhone(payload.phone)) {
      throw new ApiError(400, "Enter a valid university mobile number.");
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "representativeName") &&
    String(payload.representativeName || "").trim() &&
    !isValidName(payload.representativeName)
  ) {
    throw new ApiError(400, "Enter a valid representative name.");
  }

  if (Object.prototype.hasOwnProperty.call(payload, "representativeEmail")) {
    payload.representativeEmail = String(payload.representativeEmail || "").trim().toLowerCase();
    if (payload.representativeEmail && !isValidEmail(payload.representativeEmail)) {
      throw new ApiError(400, "Enter a valid representative email address.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "representativePhone")) {
    payload.representativePhone = String(payload.representativePhone || "").trim();
    if (payload.representativePhone && !isValidPhone(payload.representativePhone)) {
      throw new ApiError(400, "Enter a valid representative mobile number.");
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "established") &&
    String(payload.established || "").trim() &&
    !isNumberInRange(payload.established, 1800, new Date().getFullYear())
  ) {
    throw new ApiError(400, "Established year must be a valid year.");
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "totalStudents") &&
    String(payload.totalStudents || "").trim() &&
    !isNumberInRange(payload.totalStudents, 0, 1000000)
  ) {
    throw new ApiError(400, "Total students must be a valid number.");
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "totalPrograms") &&
    String(payload.totalPrograms || "").trim() &&
    !isNumberInRange(payload.totalPrograms, 0, 10000)
  ) {
    throw new ApiError(400, "Total programs must be a valid number.");
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "minimumFscPercentage") &&
    !isNumberInRange(payload.minimumFscPercentage, 0, 100)
  ) {
    throw new ApiError(400, "Minimum FSC percentage must be between 0 and 100.");
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "minimumMatricPercentage") &&
    !isNumberInRange(payload.minimumMatricPercentage, 0, 100)
  ) {
    throw new ApiError(400, "Minimum Matric percentage must be between 0 and 100.");
  }
};

const ROLL_NUMBER_RECORD_PROJECTION = [
  "applicationCode",
  "student",
  "studentName",
  "email",
  "program",
  "aggregate",
  "status",
  "payment.status",
  "rollNumber",
  "eligibleForAdmissionLetter",
  "createdAt",
  "updatedAt",
].join(" ");

const ADMISSION_LETTER_RECORD_PROJECTION = [
  "applicationCode",
  "student",
  "studentName",
  "email",
  "program",
  "aggregate",
  "status",
  "payment.status",
  "rollNumber",
  "eligibleForAdmissionLetter",
  "admissionLetter",
  "createdAt",
  "updatedAt",
].join(" ");

const syncUniversityUserFromProfile = async (reqUser, profile) => {
  await User.findByIdAndUpdate(reqUser._id, {
    $set: {
      name: profile.universityName || reqUser.name,
      location: profile.city || reqUser.location,
      website: profile.website || reqUser.website,
      representativeName: profile.representativeName || reqUser.representativeName,
      phone: profile.phone || reqUser.phone,
      studentCount: profile.totalStudents || reqUser.studentCount,
      establishedYear: profile.established || reqUser.establishedYear,
    },
  });
};

const ensureMyUniversityProfile = async (reqUser) => {
  let profile = await UniversityProfile.findOne({ university: reqUser._id });

  if (!profile) {
    profile = await UniversityProfile.create({
      university: reqUser._id,
      universityName: reqUser.name,
      email: reqUser.email,
      city: reqUser.location || "",
      website: reqUser.website || "",
      representativeName: reqUser.representativeName || "",
      established: reqUser.establishedYear || "",
      totalStudents: reqUser.studentCount || "",
    });
  }

  return profile;
};

const getMyDashboard = asyncHandler(async (req, res) => {
  const profile = await ensureMyUniversityProfile(req.user);

  const [
    totalApplications,
    pendingApplications,
    underReviewApplications,
    acceptedApplications,
    assignedApplications,
    issuedAdmissionLetters,
    publishedAnnouncements,
    publishedBlogs,
    recentApplications,
  ] = await Promise.all([
    Application.countDocuments({ university: req.user._id }),
    Application.countDocuments({ university: req.user._id, status: "pending" }),
    Application.countDocuments({ university: req.user._id, status: "under-review" }),
    Application.countDocuments({ university: req.user._id, status: "accepted" }),
    Application.countDocuments({ university: req.user._id, status: { $in: ["assigned", "finalized"] } }),
    Application.countDocuments({
      university: req.user._id,
      "admissionLetter.issued": true,
    }),
    Announcement.countDocuments({
      university: req.user._id,
      status: "published",
    }),
    BlogPost.countDocuments({
      university: req.user._id,
      status: "published",
    }),
    Application.find({ university: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("student", "name email")
      .lean(),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      metrics: {
        totalApplications,
        pendingApplications,
        underReviewApplications,
        acceptedApplications,
        assignedApplications,
        issuedAdmissionLetters,
        publishedAnnouncements,
        publishedBlogs,
        activePrograms: Array.isArray(profile.programs) ? profile.programs.length : 0,
      },
      recentApplications,
      profile,
    },
  });
});

const getMySettings = asyncHandler(async (req, res) => {
  const profile = await ensureMyUniversityProfile(req.user);

  return res.status(200).json({
    success: true,
    data: { profile },
  });
});

const updateMySettings = asyncHandler(async (req, res) => {
  const payload = sanitizeProfilePayload(req.body);
  delete payload._id;
  delete payload.university;
  validateSettingsPayload(payload);
  if (Object.prototype.hasOwnProperty.call(payload, "logo")) {
    payload.logo = await persistMaybeDataUrl({
      value: payload.logo,
      folder: `university-profiles/${String(req.user._id)}`,
      preferredName: payload.shortName || payload.universityName || "university-logo",
    });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "representativeProfilePicture")) {
    payload.representativeProfilePicture = await persistMaybeDataUrl({
      value: payload.representativeProfilePicture,
      folder: `university-profiles/${String(req.user._id)}`,
      preferredName: payload.representativeName || "representative-profile",
    });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "paymentMethods")) {
    payload.paymentMethods = normalizePaymentMethods(payload.paymentMethods);
  }

  const setOnInsert = {
    university: req.user._id,
  };
  if (!Object.prototype.hasOwnProperty.call(payload, "universityName")) {
    setOnInsert.universityName = req.user.name;
  }

  const profile = await UniversityProfile.findOneAndUpdate(
    { university: req.user._id },
    {
      $set: payload,
      $setOnInsert: setOnInsert,
    },
    { new: true, upsert: true, runValidators: true }
  );

  await syncUniversityUserFromProfile(req.user, profile);
  invalidateUniversityPublicCache(req.user._id);

  const shouldBroadcastRecommendations = [
    "programs",
    "applicationFee",
    "minimumFscPercentage",
    "minimumMatricPercentage",
    "applicationStartDate",
    "applicationEndDate",
    "type",
  ].some((field) => Object.prototype.hasOwnProperty.call(payload, field));

  if (shouldBroadcastRecommendations) {
    await invalidateStudentRecommendationCache();

    emitDataUpdate({
      resource: "programs",
      action: "updated",
      roles: ["student"],
      payload: {
        universityId: String(req.user._id),
        totalPrograms: Array.isArray(profile?.programs) ? profile.programs.length : 0,
        applicationFee: Number(profile?.applicationFee || 0),
        minimumFscPercentage: Number(profile?.minimumFscPercentage || 0),
        minimumMatricPercentage: Number(profile?.minimumMatricPercentage || 0),
        applicationEndDate: profile?.applicationEndDate || null,
      },
    });
  }

  return res.status(200).json({
    success: true,
    message: "University settings updated successfully.",
    data: { profile },
  });
});

const getMyPrograms = asyncHandler(async (req, res) => {
  const profile = await ensureMyUniversityProfile(req.user);

  return res.status(200).json({
    success: true,
    data: {
      programs: profile.programs || [],
      totalPrograms: Number(profile.totalPrograms || profile.programs?.length || 0),
    },
  });
});

const updateMyPrograms = asyncHandler(async (req, res) => {
  const { programs } = req.body;

  if (!Array.isArray(programs)) {
    throw new ApiError(400, "Programs must be an array.");
  }

  const normalizedPrograms = programs.map((program) => {
    const deadlineDate = normalizeProgramDeadlineDate(program?.deadlineDate);
    return {
      name: String(program?.name || "").trim(),
      seats: Number(program?.seats || 0),
      feeRange: String(program?.feeRange || "").trim(),
      requiredAggregate: Number(program?.requiredAggregate || 0),
      deadlineDate,
      isAdmissionOpen: program?.isAdmissionOpen !== false,
    };
  });

  if (normalizedPrograms.some((program) => !program.name)) {
    throw new ApiError(400, "Every program must include a valid name.");
  }

  if (
    normalizedPrograms.some(
      (program) =>
        program.seats <= 0 ||
        !isNumberInRange(program.requiredAggregate, 0, 100) ||
        !program.feeRange,
    )
  ) {
    throw new ApiError(400, "Every program must include seats and fee range.");
  }

  if (
    normalizedPrograms.some(
      (program) => program.isAdmissionOpen && (!program.deadlineDate || hasProgramDeadlinePassed(program.deadlineDate)),
    )
  ) {
    throw new ApiError(400, "Admission-open programs require a future application deadline.");
  }

  const profile = await UniversityProfile.findOneAndUpdate(
    { university: req.user._id },
    {
      $set: {
        programs: normalizedPrograms,
        totalPrograms: String(normalizedPrograms.length),
      },
      $setOnInsert: {
        university: req.user._id,
        universityName: req.user.name,
      },
    },
    { new: true, upsert: true, runValidators: true }
  );
  invalidateUniversityPublicCache(req.user._id);
  await invalidateStudentRecommendationCache();

  emitDataUpdate({
    resource: "programs",
    action: "updated",
    roles: ["student"],
    payload: {
      universityId: String(req.user._id),
      totalPrograms: normalizedPrograms.length,
      openPrograms: normalizedPrograms.filter((program) => program.isAdmissionOpen).length,
    },
  });

  return res.status(200).json({
    success: true,
    message: "Programs updated successfully.",
    data: {
      programs: profile.programs || [],
      totalPrograms: normalizedPrograms.length,
    },
  });
});

const listMyAnnouncements = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const query = { university: req.user._id };

  if (req.query.status) {
    query.status = String(req.query.status);
  }

  if (req.query.type) {
    query.type = String(req.query.type);
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
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
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

const createMyAnnouncement = asyncHandler(async (req, res) => {
  const {
    title,
    content,
    type,
    category,
    status,
    attachmentUrl,
    attachmentName,
    visibleFrom,
    expiresAt,
  } = req.body;

  if (!title || !content) {
    throw new ApiError(400, "Title and content are required.");
  }

  const normalizedStatus = status === "published" ? "published" : "draft";
  const visibilityWindow = normalizeAnnouncementVisibilityWindow({
    visibleFrom,
    expiresAt,
    status: normalizedStatus,
  });

  const persistedAttachmentUrl = await persistMaybeDataUrl({
    value: attachmentUrl,
    folder: `announcements/${String(req.user._id)}`,
    preferredName: attachmentName || title || "announcement-attachment",
  });

  const announcement = await Announcement.create({
    university: req.user._id,
    createdBy: req.user._id,
    title: String(title).trim(),
    content: String(content).trim(),
    type: String(type || "general"),
    category: String(category || "General"),
    attachmentUrl: String(persistedAttachmentUrl || "").trim(),
    attachmentName: String(attachmentName || "").trim(),
    status: normalizedStatus,
    ...visibilityWindow,
    publishedAt: normalizedStatus === "published" ? new Date() : null,
  });

  emitDataUpdate({
    resource: "announcements",
    action: "created",
    roles: ["student", "university"],
    payload: {
      universityId: String(req.user._id),
      announcementId: String(announcement._id),
      status: announcement.status,
    },
  });

  return res.status(201).json({
    success: true,
    message: "Announcement created successfully.",
    data: { announcement },
  });
});

const updateMyAnnouncement = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid announcement id.");

  const announcement = await Announcement.findOne({
    _id: req.params.id,
    university: req.user._id,
  });

  if (!announcement) {
    throw new ApiError(404, "Announcement not found.");
  }

  const updates = { ...req.body };
  delete updates._id;
  delete updates.university;
  delete updates.createdBy;

  if (Object.prototype.hasOwnProperty.call(updates, "attachmentUrl")) {
    updates.attachmentUrl = await persistMaybeDataUrl({
      value: updates.attachmentUrl,
      folder: `announcements/${String(req.user._id)}`,
      preferredName: updates.attachmentName || updates.title || "announcement-attachment",
    });
    updates.attachmentUrl = String(updates.attachmentUrl || "").trim();
  }
  if (Object.prototype.hasOwnProperty.call(updates, "attachmentName")) {
    updates.attachmentName = String(updates.attachmentName || "").trim();
  }

  const nextStatus = updates.status || announcement.status;
  if (
    Object.prototype.hasOwnProperty.call(updates, "visibleFrom") ||
    Object.prototype.hasOwnProperty.call(updates, "expiresAt") ||
    Object.prototype.hasOwnProperty.call(updates, "status")
  ) {
    const visibilityWindow = normalizeAnnouncementVisibilityWindow({
      visibleFrom: Object.prototype.hasOwnProperty.call(updates, "visibleFrom")
        ? updates.visibleFrom
        : announcement.visibleFrom,
      expiresAt: Object.prototype.hasOwnProperty.call(updates, "expiresAt")
        ? updates.expiresAt
        : announcement.expiresAt,
      status: nextStatus,
    });
    updates.visibleFrom = visibilityWindow.visibleFrom;
    updates.expiresAt = visibilityWindow.expiresAt;
  }

  if (updates.status === "published" && !announcement.publishedAt) {
    updates.publishedAt = new Date();
  }

  const updated = await Announcement.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  emitDataUpdate({
    resource: "announcements",
    action: "updated",
    roles: ["student", "university"],
    payload: {
      universityId: String(req.user._id),
      announcementId: String(updated?._id || req.params.id),
      status: updated?.status || announcement.status,
    },
  });

  return res.status(200).json({
    success: true,
    message: "Announcement updated successfully.",
    data: { announcement: updated },
  });
});

const deleteMyAnnouncement = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid announcement id.");

  const deleted = await Announcement.findOneAndDelete({
    _id: req.params.id,
    university: req.user._id,
  });

  if (!deleted) {
    throw new ApiError(404, "Announcement not found.");
  }

  emitDataUpdate({
    resource: "announcements",
    action: "deleted",
    roles: ["student", "university"],
    payload: {
      universityId: String(req.user._id),
      announcementId: String(req.params.id),
    },
  });

  return res.status(200).json({
    success: true,
    message: "Announcement deleted successfully.",
  });
});

const listMyBlogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const query = { university: req.user._id };

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
      .populate("author", "name role")
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
      ]),
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

const createMyBlog = asyncHandler(async (req, res) => {
  const { title, excerpt, content, category, tags, imageUrl, status } = req.body;

  if (!title || !content) {
    throw new ApiError(400, "Title and content are required.");
  }

  const normalizedStatus = status === "published" ? "published" : "draft";

  const persistedImageUrl = await persistMaybeDataUrl({
    value: imageUrl,
    folder: `blogs/${String(req.user._id)}`,
    preferredName: title || "blog-image",
  });

  const post = await BlogPost.create({
    author: req.user._id,
    university: req.user._id,
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
      universityId: String(req.user._id),
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

const updateMyBlog = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid blog id.");

  const post = await BlogPost.findOne({
    _id: req.params.id,
    university: req.user._id,
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
      folder: `blogs/${String(req.user._id)}`,
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
      universityId: String(req.user._id),
      postId: String(updated?._id || req.params.id),
      status: updated?.status || post.status,
    },
  });

  return res.status(200).json({
    success: true,
    message: "Blog post updated successfully.",
    data: { post: updated },
  });
});

const deleteMyBlog = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid blog id.");

  const deleted = await BlogPost.findOneAndDelete({
    _id: req.params.id,
    university: req.user._id,
  });

  if (!deleted) {
    throw new ApiError(404, "Blog post not found.");
  }

  emitDataUpdate({
    resource: "blogs",
    action: "deleted",
    roles: ["student", "university"],
    payload: {
      universityId: String(req.user._id),
      postId: String(req.params.id),
    },
  });

  return res.status(200).json({
    success: true,
    message: "Blog post deleted successfully.",
  });
});

const getMyBlogComments = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.blogId, "Invalid blog id.");

  const post = await BlogPost.findOne({
    _id: req.params.blogId,
    university: req.user._id,
  });

  if (!post) {
    throw new ApiError(404, "Blog post not found.");
  }

  const comments = await BlogComment.find({ post: req.params.blogId })
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

const deleteMyBlogComment = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.blogId, "Invalid blog id.");
  ensureObjectId(req.params.commentId, "Invalid comment id.");

  const post = await BlogPost.findOne({
    _id: req.params.blogId,
    university: req.user._id,
  });

  if (!post) {
    throw new ApiError(404, "Blog post not found.");
  }

  const comment = await BlogComment.findOne({
    _id: req.params.commentId,
    post: req.params.blogId,
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

const listMyRollNumbers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const query = {
    university: req.user._id,
    status: { $in: ["accepted", "assigned", "finalized"] },
    "payment.status": "paid",
  };

  if (req.query.program) {
    query.program = String(req.query.program);
  }

  if (req.query.search) {
    query.$or = [
      { studentName: normalizeSearchRegex(req.query.search) },
      { email: normalizeSearchRegex(req.query.search) },
      { applicationCode: normalizeSearchRegex(req.query.search) },
      { "rollNumber.number": normalizeSearchRegex(req.query.search) },
    ];
  }

  const [total, applications] = await Promise.all([
    Application.countDocuments(query),
    Application.find(query)
      .select(ROLL_NUMBER_RECORD_PROJECTION)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("student", "name email")
      .lean(),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      applications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

const upsertMyRollNumber = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.applicationId, "Invalid application id.");

  const { number, slipFileUrl, slipFileName, eligibleForAdmissionLetter } = req.body;
  if (!isValidRollNumber(number)) {
    throw new ApiError(400, "Enter a valid roll number.");
  }

  if (!String(slipFileUrl || "").trim()) {
    throw new ApiError(400, "Roll number slip PDF is required.");
  }

  if (!isPdfUpload({ dataUrl: slipFileUrl, fileName: slipFileName, url: slipFileUrl })) {
    throw new ApiError(400, "Roll number slip must be a PDF file.");
  }

  const application = await Application.findOne({
    _id: req.params.applicationId,
    university: req.user._id,
  });

  if (!application) {
    throw new ApiError(404, "Application not found.");
  }

  if (!["accepted", "assigned", "finalized"].includes(String(application.status))) {
    throw new ApiError(
      400,
      "Roll number can only be assigned after application is accepted."
    );
  }

  if (application.payment?.status !== "paid") {
    throw new ApiError(400, "Payment is not completed for this application.");
  }

  const persistedSlipFileUrl = await persistMaybeDataUrl({
    value: slipFileUrl,
    folder: `applications/${String(application._id)}/roll-slips`,
    preferredName: slipFileName || `roll-slip-${String(number || "assigned")}`,
  });

  application.rollNumber = {
    assigned: true,
    number: String(number).trim(),
    slipFileUrl: String(persistedSlipFileUrl || ""),
    slipFileName: String(slipFileName || ""),
    assignedAt: new Date(),
    assignedBy: req.user._id,
  };
  if (eligibleForAdmissionLetter !== undefined) {
    application.eligibleForAdmissionLetter = Boolean(eligibleForAdmissionLetter);
  }
  if (application.status !== "finalized") {
    application.status = "assigned";
  }

  await application.save();

  let rollEmailDelivery = { sent: false, reason: "" };
  try {
    rollEmailDelivery = await sendRollNumberAssignedEmail({
      to: application.email,
      studentName: application.studentName,
      universityName: req.user?.name || "University",
      applicationCode: application.applicationCode,
      program: application.program,
      rollNumber: application.rollNumber?.number,
      slipFileUrl: application.rollNumber?.slipFileUrl,
      slipFileName: application.rollNumber?.slipFileName,
    });
  } catch (emailError) {
    rollEmailDelivery = {
      sent: false,
      reason: emailError?.message || "Failed to send roll number email.",
    };
  }

  emitDataUpdate({
    resource: "applications",
    action: "updated",
    userIds: [String(application.student), String(req.user._id)],
    payload: {
      applicationId: String(application._id),
      universityId: String(application.university),
      status: application.status,
      rollAssigned: true,
      eligibleForAdmissionLetter: application.eligibleForAdmissionLetter,
    },
  });
  emitDataUpdate({
    resource: "merit-lists",
    action: "updated",
    roles: ["student"],
    payload: {
      universityId: String(application.university),
      applicationId: String(application._id),
    },
  });

  return res.status(200).json({
    success: true,
    message: "Roll number saved successfully.",
    data: { application, emailDelivery: rollEmailDelivery },
  });
});

const listMyAdmissionLetters = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const query = {
    university: req.user._id,
    status: { $in: ["assigned", "finalized"] },
    "payment.status": "paid",
    "rollNumber.assigned": true,
    eligibleForAdmissionLetter: true,
  };

  if (req.query.program) {
    query.program = String(req.query.program);
  }

  if (req.query.issued === "true") {
    query["admissionLetter.issued"] = true;
  }

  if (req.query.issued === "false") {
    query["admissionLetter.issued"] = false;
  }

  if (req.query.search) {
    query.$or = [
      { studentName: normalizeSearchRegex(req.query.search) },
      { email: normalizeSearchRegex(req.query.search) },
      { applicationCode: normalizeSearchRegex(req.query.search) },
      { "admissionLetter.letterNumber": normalizeSearchRegex(req.query.search) },
    ];
  }

  const [total, applications] = await Promise.all([
    Application.countDocuments(query),
    Application.find(query)
      .select(ADMISSION_LETTER_RECORD_PROJECTION)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("student", "name email")
      .lean(),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      applications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

const upsertMyAdmissionLetter = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.applicationId, "Invalid application id.");

  const { letterNumber, fileUrl, fileName, remarks, sentToStudent } = req.body;

  if (!letterNumber || !fileUrl) {
    throw new ApiError(400, "Letter number and file URL are required.");
  }

  if (!isPdfUpload({ dataUrl: fileUrl, fileName, url: fileUrl })) {
    throw new ApiError(400, "Admission letter must be a PDF file.");
  }

  const application = await Application.findOne({
    _id: req.params.applicationId,
    university: req.user._id,
  });

  if (!application) {
    throw new ApiError(404, "Application not found.");
  }

  if (!application.rollNumber?.assigned) {
    throw new ApiError(400, "Admission letter cannot be issued before roll number is assigned.");
  }

  if (!application.eligibleForAdmissionLetter) {
    throw new ApiError(400, "This application is not marked eligible for admission letter.");
  }

  if (application.payment?.status !== "paid") {
    throw new ApiError(400, "Payment is not completed for this application.");
  }

  const persistedLetterFileUrl = await persistMaybeDataUrl({
    value: fileUrl,
    folder: `applications/${String(application._id)}/admission-letters`,
    preferredName: fileName || `admission-letter-${String(letterNumber || "issued")}`,
  });

  application.admissionLetter = {
    issued: true,
    letterNumber: String(letterNumber).trim(),
    fileUrl: String(persistedLetterFileUrl || "").trim(),
    fileName: String(fileName || "").trim(),
    remarks: String(remarks || ""),
    sentToStudent: Boolean(sentToStudent),
    uploadedAt: new Date(),
    uploadedBy: req.user._id,
    sentAt: sentToStudent ? new Date() : null,
  };
  application.status = "finalized";

  await application.save();

  let letterEmailDelivery = { sent: false, reason: "" };
  try {
    letterEmailDelivery = await sendAdmissionLetterIssuedEmail({
      to: application.email,
      studentName: application.studentName,
      universityName: req.user?.name || "University",
      applicationCode: application.applicationCode,
      program: application.program,
      letterNumber: application.admissionLetter?.letterNumber,
      fileUrl: application.admissionLetter?.fileUrl,
      fileName: application.admissionLetter?.fileName,
    });
  } catch (emailError) {
    letterEmailDelivery = {
      sent: false,
      reason: emailError?.message || "Failed to send admission letter email.",
    };
  }

  emitDataUpdate({
    resource: "applications",
    action: "updated",
    userIds: [String(application.student), String(req.user._id)],
    payload: {
      applicationId: String(application._id),
      universityId: String(application.university),
      status: application.status,
      letterIssued: true,
    },
  });

  return res.status(200).json({
    success: true,
    message: "Admission letter saved successfully.",
    data: { application, emailDelivery: letterEmailDelivery },
  });
});

module.exports = {
  listUniversities,
  getUniversityById,
  getUniversityFormByUniversityId,
  getMyProfile,
  updateMyProfile,
  getMyForm,
  upsertMyForm,
  listMyBloggers,
  createBlogger,
  updateMyBloggerStatus,
  deleteMyBlogger,
  getMyDashboard,
  getMySettings,
  updateMySettings,
  getMyPrograms,
  updateMyPrograms,
  listMyAnnouncements,
  createMyAnnouncement,
  updateMyAnnouncement,
  deleteMyAnnouncement,
  listMyBlogs,
  createMyBlog,
  updateMyBlog,
  deleteMyBlog,
  getMyBlogComments,
  deleteMyBlogComment,
  listMyRollNumbers,
  upsertMyRollNumber,
  listMyAdmissionLetters,
  upsertMyAdmissionLetter,
};
