const mongoose = require("mongoose");
const Application = require("../../models/Application");
const Announcement = require("../../models/Announcement");
const BlogPost = require("../../models/BlogPost");
const StudentProfile = require("../../models/StudentProfile");
const UniversityProfile = require("../../models/UniversityProfile");
const UniversityForm = require("../../models/UniversityForm");
const User = require("../../models/User");
const ApiError = require("../../utils/ApiError");
const asyncHandler = require("../../utils/asyncHandler");
const getPagination = require("../../utils/pagination");
const { emitDataUpdate } = require("../../utils/socket");
const { persistMaybeDataUrl } = require("../../utils/fileStorage");
const { isValidEmail, isValidName, isValidPhone } = require("../../utils/validators");
const { invalidateUniversityPublicCache } = require("../../controllers/university.controller");
const {
  ROLES,
  UNIVERSITY_APPROVAL,
} = require("../../constants/roles");
const {
  getDashboardStats,
  listUniversitiesForAdmin,
  reviewUniversity,
  listStudentsForAdmin,
  listBloggersForAdmin,
  updateUserStatus,
} = require("../../controllers/admin.controller");

const ensureObjectId = (id, message = "Invalid resource id.") => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, message);
  }
};

const getMyProfile = asyncHandler(async (req, res) => {
  const admin = await User.findById(req.user._id).lean();
  if (!admin) {
    throw new ApiError(404, "Admin account not found.");
  }

  return res.status(200).json({
    success: true,
    data: { profile: admin },
  });
});

const updateMyProfile = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  const allowedFields = ["name", "email", "phone", "location", "profilePicture"];
  const updates = {};

  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      updates[field] = payload[field];
    }
  });

  if (Object.prototype.hasOwnProperty.call(updates, "name")) {
    updates.name = String(updates.name || "").trim();
    if (!isValidName(updates.name)) {
      throw new ApiError(400, "Enter a valid admin name.");
    }
  }

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

  if (Object.prototype.hasOwnProperty.call(updates, "phone")) {
    updates.phone = String(updates.phone || "").trim();
    if (updates.phone && !isValidPhone(updates.phone)) {
      throw new ApiError(400, "Enter a valid mobile number.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, "location")) {
    updates.location = String(updates.location || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(updates, "profilePicture")) {
    updates.profilePicture = await persistMaybeDataUrl({
      value: updates.profilePicture,
      folder: `admin-profiles/${String(req.user._id)}`,
      preferredName: updates.name || "admin-profile",
    });
    updates.profilePicture = String(updates.profilePicture || "");
  }

  const admin = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true },
  ).lean();

  return res.status(200).json({
    success: true,
    message: "Admin profile updated successfully.",
    data: { profile: admin },
  });
});

const ADMIN_APPLICATION_SUMMARY_PROJECTION = [
  "applicationCode",
  "student",
  "studentName",
  "program",
  "aggregate",
  "status",
  "university",
  "createdAt",
  "updatedAt",
].join(" ");

const getAdminDashboard = asyncHandler(async (_req, res) => {
  const [
    totalUniversities,
    pendingApprovals,
    approvedUniversities,
    rejectedUniversities,
    totalStudents,
    totalBloggers,
    totalApplications,
    pendingApplications,
    underReviewApplications,
    acceptedApplications,
    rejectedApplications,
    totalBlogs,
    publishedBlogs,
    totalAnnouncements,
    publishedAnnouncements,
    recentPendingUniversities,
    recentApplications,
    recentBlogs,
  ] = await Promise.all([
    User.countDocuments({ role: ROLES.UNIVERSITY }),
    User.countDocuments({
      role: ROLES.UNIVERSITY,
      approvalStatus: UNIVERSITY_APPROVAL.PENDING,
    }),
    User.countDocuments({
      role: ROLES.UNIVERSITY,
      approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
    }),
    User.countDocuments({
      role: ROLES.UNIVERSITY,
      approvalStatus: UNIVERSITY_APPROVAL.REJECTED,
    }),
    User.countDocuments({ role: ROLES.STUDENT }),
    User.countDocuments({ role: ROLES.BLOGGER }),
    Application.countDocuments({}),
    Application.countDocuments({ status: "pending" }),
    Application.countDocuments({ status: "under-review" }),
    Application.countDocuments({ status: "accepted" }),
    Application.countDocuments({ status: "rejected" }),
    BlogPost.countDocuments({}),
    BlogPost.countDocuments({ status: "published" }),
    Announcement.countDocuments({}),
    Announcement.countDocuments({ status: "published" }),
    User.find({
      role: ROLES.UNIVERSITY,
      approvalStatus: UNIVERSITY_APPROVAL.PENDING,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Application.find({})
      .select(ADMIN_APPLICATION_SUMMARY_PROJECTION)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("university", "name")
      .populate("student", "name email")
      .lean(),
    BlogPost.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("author", "name role")
      .populate("university", "name")
      .lean(),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      metrics: {
        universities: {
          total: totalUniversities,
          pendingApprovals,
          approved: approvedUniversities,
          rejected: rejectedUniversities,
        },
        users: {
          students: totalStudents,
          bloggers: totalBloggers,
        },
        applications: {
          total: totalApplications,
          pending: pendingApplications,
          inReview: underReviewApplications,
          accepted: acceptedApplications,
          rejected: rejectedApplications,
        },
        content: {
          blogs: {
            total: totalBlogs,
            published: publishedBlogs,
          },
          announcements: {
            total: totalAnnouncements,
            published: publishedAnnouncements,
          },
        },
      },
      recent: {
        pendingUniversities: recentPendingUniversities,
        applications: recentApplications,
        blogs: recentBlogs,
      },
    },
  });
});

const listAdminActivities = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);

  const [universities, applications, blogs, announcements] = await Promise.all([
    User.find({ role: ROLES.UNIVERSITY })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    Application.find({})
      .select(ADMIN_APPLICATION_SUMMARY_PROJECTION)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("university", "name")
      .lean(),
    BlogPost.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("author", "name role")
      .populate("university", "name")
      .lean(),
    Announcement.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("university", "name")
      .lean(),
  ]);

  const activities = [
    ...universities.map((item) => ({
      id: `uni-${item._id}`,
      type: "university-registration",
      action: item.approvalStatus === "pending" ? "submitted" : "reviewed",
      title: item.name,
      description: `University account is ${item.approvalStatus}.`,
      createdAt: item.createdAt,
      meta: {
        universityId: item._id,
        approvalStatus: item.approvalStatus,
      },
    })),
    ...applications.map((item) => ({
      id: `app-${item._id}`,
      type: "application",
      action: item.status,
      title: item.applicationCode,
      description: `${item.studentName} applied to ${item.university?.name || "University"}.`,
      createdAt: item.createdAt,
      meta: {
        applicationId: item._id,
        status: item.status,
      },
    })),
    ...blogs.map((item) => ({
      id: `blog-${item._id}`,
      type: "blog",
      action: item.status,
      title: item.title,
      description: `${item.author?.name || "Author"} posted for ${
        item.university?.name || "university"
      }.`,
      createdAt: item.createdAt,
      meta: {
        blogId: item._id,
        status: item.status,
      },
    })),
    ...announcements.map((item) => ({
      id: `announcement-${item._id}`,
      type: "announcement",
      action: item.status,
      title: item.title,
      description: `${item.university?.name || "University"} announcement updated.`,
      createdAt: item.createdAt,
      meta: {
        announcementId: item._id,
        status: item.status,
      },
    })),
  ]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = activities.length;
  const paginated = activities.slice(skip, skip + limit);

  return res.status(200).json({
    success: true,
    data: {
      activities: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

const listUniversitiesManagement = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const search = String(req.query.search || "").trim();
  const statusFilter = String(req.query.status || "all").toLowerCase();

  const query = { role: ROLES.UNIVERSITY };

  if (statusFilter !== "all") {
    query.approvalStatus = statusFilter;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
    ];
  }

  const [total, universities] = await Promise.all([
    User.countDocuments(query),
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  const universityIds = universities.map((item) => item._id);

  const [profiles, applicationStats, bloggerStats] = await Promise.all([
    UniversityProfile.find({ university: { $in: universityIds } }).lean(),
    Application.aggregate([
      { $match: { university: { $in: universityIds } } },
      {
        $group: {
          _id: { university: "$university", status: "$status" },
          count: { $sum: 1 },
        },
      },
    ]),
    User.aggregate([
      {
        $match: {
          role: ROLES.BLOGGER,
          managedUniversity: { $in: universityIds },
        },
      },
      {
        $group: {
          _id: "$managedUniversity",
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const profileMap = new Map(profiles.map((item) => [String(item.university), item]));
  const bloggerCountMap = new Map(
    bloggerStats.map((item) => [String(item._id), Number(item.count || 0)])
  );
  const applicationMap = new Map();

  applicationStats.forEach((item) => {
    const universityId = String(item._id.university);
    if (!applicationMap.has(universityId)) {
      applicationMap.set(universityId, {
        total: 0,
        pending: 0,
        underReview: 0,
        accepted: 0,
        rejected: 0,
        assigned: 0,
      });
    }

    const stats = applicationMap.get(universityId);
    stats.total += Number(item.count || 0);

    if (item._id.status === "pending") stats.pending += Number(item.count || 0);
    if (item._id.status === "under-review") stats.underReview += Number(item.count || 0);
    if (item._id.status === "accepted") stats.accepted += Number(item.count || 0);
    if (item._id.status === "rejected") stats.rejected += Number(item.count || 0);
    if (item._id.status === "assigned") stats.assigned += Number(item.count || 0);
  });

  const items = universities.map((university) => ({
    ...university,
    profile: profileMap.get(String(university._id)) || null,
    bloggerCount: bloggerCountMap.get(String(university._id)) || 0,
    applicationStats: applicationMap.get(String(university._id)) || {
      total: 0,
      pending: 0,
      underReview: 0,
      accepted: 0,
      rejected: 0,
      assigned: 0,
    },
  }));

  return res.status(200).json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

const listStudentsManagement = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const search = String(req.query.search || "").trim();

  const query = { role: ROLES.STUDENT };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
    ];
  }

  const [total, students] = await Promise.all([
    User.countDocuments(query),
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  const studentIds = students.map((item) => item._id);
  const [profiles, applicationStats] = await Promise.all([
    StudentProfile.find({ user: { $in: studentIds } }).lean(),
    Application.aggregate([
      { $match: { student: { $in: studentIds } } },
      {
        $group: {
          _id: { student: "$student", status: "$status" },
          count: { $sum: 1 },
          latestApplicationAt: { $max: "$createdAt" },
        },
      },
    ]),
  ]);

  const profileMap = new Map(profiles.map((item) => [String(item.user), item]));
  const applicationMap = new Map();

  applicationStats.forEach((item) => {
    const studentId = String(item._id.student);
    if (!applicationMap.has(studentId)) {
      applicationMap.set(studentId, {
        total: 0,
        pending: 0,
        underReview: 0,
        accepted: 0,
        rejected: 0,
        assigned: 0,
        latestApplicationAt: null,
      });
    }

    const stats = applicationMap.get(studentId);
    const count = Number(item.count || 0);
    stats.total += count;
    if (item._id.status === "pending") stats.pending += count;
    if (item._id.status === "under-review") stats.underReview += count;
    if (item._id.status === "accepted") stats.accepted += count;
    if (item._id.status === "rejected") stats.rejected += count;
    if (item._id.status === "assigned") stats.assigned += count;

    const latest = item.latestApplicationAt ? new Date(item.latestApplicationAt) : null;
    if (latest && (!stats.latestApplicationAt || latest > stats.latestApplicationAt)) {
      stats.latestApplicationAt = latest;
    }
  });

  const items = students.map((student) => ({
    ...student,
    profile: profileMap.get(String(student._id)) || null,
    applicationStats: applicationMap.get(String(student._id)) || {
      total: 0,
      pending: 0,
      underReview: 0,
      accepted: 0,
      rejected: 0,
      assigned: 0,
      latestApplicationAt: null,
    },
  }));

  return res.status(200).json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

const listBloggersManagement = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const search = String(req.query.search || "").trim();
  const statusFilter = String(req.query.status || "all").toLowerCase();

  const query = { role: ROLES.BLOGGER };

  if (statusFilter !== "all") {
    query.status = statusFilter;
  }

  if (req.query.universityId) {
    ensureObjectId(req.query.universityId, "Invalid university id.");
    query.managedUniversity = req.query.universityId;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { username: { $regex: search, $options: "i" } },
    ];
  }

  const [total, bloggers] = await Promise.all([
    User.countDocuments(query),
    User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("managedUniversity", "name email")
      .lean(),
  ]);

  const bloggerIds = bloggers.map((item) => item._id);
  const blogStats = await BlogPost.aggregate([
    { $match: { author: { $in: bloggerIds } } },
    {
      $group: {
        _id: { author: "$author", status: "$status" },
        count: { $sum: 1 },
        views: { $sum: "$views" },
      },
    },
  ]);

  const statsMap = new Map();
  blogStats.forEach((item) => {
    const authorId = String(item._id.author);
    if (!statsMap.has(authorId)) {
      statsMap.set(authorId, {
        totalPosts: 0,
        publishedPosts: 0,
        draftPosts: 0,
        totalViews: 0,
      });
    }

    const stats = statsMap.get(authorId);
    const count = Number(item.count || 0);
    stats.totalPosts += count;
    stats.totalViews += Number(item.views || 0);
    if (item._id.status === "published") stats.publishedPosts += count;
    if (item._id.status === "draft") stats.draftPosts += count;
  });

  const items = bloggers.map((blogger) => ({
    ...blogger,
    postStats: statsMap.get(String(blogger._id)) || {
      totalPosts: 0,
      publishedPosts: 0,
      draftPosts: 0,
      totalViews: 0,
    },
  }));

  return res.status(200).json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

const deleteManagedUser = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid user id.");

  const targetUser = await User.findById(req.params.id).lean();
  if (!targetUser) {
    throw new ApiError(404, "User not found.");
  }

  if (![ROLES.STUDENT, ROLES.UNIVERSITY, ROLES.BLOGGER].includes(targetUser.role)) {
    throw new ApiError(400, "Only student, university, or blogger accounts can be deleted.");
  }

  if (String(targetUser._id) === String(req.user._id)) {
    throw new ApiError(400, "Admin cannot delete their own account.");
  }

  if (targetUser.role === ROLES.STUDENT) {
    await Promise.all([
      StudentProfile.deleteOne({ user: targetUser._id }),
      Application.deleteMany({ student: targetUser._id }),
      User.deleteOne({ _id: targetUser._id }),
    ]);
  }

  if (targetUser.role === ROLES.BLOGGER) {
    await Promise.all([
      BlogPost.deleteMany({ author: targetUser._id }),
      User.deleteOne({ _id: targetUser._id }),
    ]);
  }

  if (targetUser.role === ROLES.UNIVERSITY) {
    const dependentBloggers = await User.find({
      role: ROLES.BLOGGER,
      managedUniversity: targetUser._id,
    })
      .select("_id")
      .lean();
    const dependentBloggerIds = dependentBloggers.map((item) => item._id);

    await Promise.all([
      Application.deleteMany({ university: targetUser._id }),
      Announcement.deleteMany({ university: targetUser._id }),
      BlogPost.deleteMany({
        $or: [
          { university: targetUser._id },
          { author: { $in: dependentBloggerIds } },
        ],
      }),
      UniversityProfile.deleteOne({ university: targetUser._id }),
      UniversityForm.deleteOne({ university: targetUser._id }),
      User.deleteMany({
        $or: [
          { _id: targetUser._id },
          { role: ROLES.BLOGGER, managedUniversity: targetUser._id },
        ],
      }),
    ]);
  }
  if (targetUser.role === ROLES.UNIVERSITY) {
    invalidateUniversityPublicCache(targetUser._id);
  }

  emitDataUpdate({
    resource: "users",
    action: "deleted",
    roles: ["admin"],
    payload: {
      userId: String(targetUser._id),
      role: targetUser.role,
    },
  });

  if (targetUser.role === ROLES.UNIVERSITY) {
    emitDataUpdate({
      resource: "programs",
      action: "deleted",
      roles: ["student"],
      payload: {
        universityId: String(targetUser._id),
      },
    });
  }

  return res.status(200).json({
    success: true,
    message: `${targetUser.role} account deleted successfully.`,
    data: {
      id: String(targetUser._id),
      role: targetUser.role,
      email: targetUser.email,
    },
  });
});

module.exports = {
  getMyProfile,
  updateMyProfile,
  getDashboardStats,
  listUniversitiesForAdmin,
  reviewUniversity,
  listStudentsForAdmin,
  listBloggersForAdmin,
  updateUserStatus,
  getAdminDashboard,
  listAdminActivities,
  listUniversitiesManagement,
  listStudentsManagement,
  listBloggersManagement,
  deleteManagedUser,
};
