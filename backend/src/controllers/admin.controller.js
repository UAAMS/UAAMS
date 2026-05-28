const mongoose = require("mongoose");
const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const UniversityProfile = require("../models/UniversityProfile");
const Application = require("../models/Application");
const BlogPost = require("../models/BlogPost");
const Announcement = require("../models/Announcement");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const getPagination = require("../utils/pagination");
const { invalidateUniversityPublicCache } = require("./university.controller");
const {
  ROLES,
  UNIVERSITY_APPROVAL,
  USER_STATUS,
} = require("../constants/roles");

const ensureObjectId = (id, message = "Invalid resource id.") => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, message);
  }
};

const DASHBOARD_PERIODS = new Set(["daily", "weekly", "monthly"]);

const normalizeDashboardPeriod = (value) =>
  DASHBOARD_PERIODS.has(String(value || "").toLowerCase())
    ? String(value).toLowerCase()
    : "monthly";

const parseDashboardDate = (value, { endOfDay = false } = {}) => {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
};

const buildDashboardDateQuery = (query = {}) => {
  const from = parseDashboardDate(query.from);
  const to = parseDashboardDate(query.to, { endOfDay: true });
  const createdAt = {};

  if (from) createdAt.$gte = from;
  if (to) createdAt.$lte = to;

  return {
    createdAt,
    from,
    to,
    isActive: Boolean(Object.keys(createdAt).length),
  };
};

const withCreatedAtFilter = (query, createdAt, isActive) =>
  isActive ? { ...query, createdAt } : query;

const getPeriodGroupId = (period) => {
  if (period === "daily") {
    return {
      year: { $year: "$createdAt" },
      month: { $month: "$createdAt" },
      day: { $dayOfMonth: "$createdAt" },
    };
  }

  if (period === "weekly") {
    return {
      year: { $isoWeekYear: "$createdAt" },
      week: { $isoWeek: "$createdAt" },
    };
  }

  return {
    year: { $year: "$createdAt" },
    month: { $month: "$createdAt" },
  };
};

const pad = (value) => String(value).padStart(2, "0");

const getBucketKey = (bucket = {}, period = "monthly") => {
  if (period === "daily") {
    return `${bucket.year}-${pad(bucket.month)}-${pad(bucket.day)}`;
  }

  if (period === "weekly") {
    return `${bucket.year}-W${pad(bucket.week)}`;
  }

  return `${bucket.year}-${pad(bucket.month)}`;
};

const getBucketLabel = (bucket = {}, period = "monthly") => {
  if (period === "daily") {
    return new Date(bucket.year, Number(bucket.month || 1) - 1, bucket.day || 1).toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric" },
    );
  }

  if (period === "weekly") {
    return `Week ${Number(bucket.week || 0)}, ${bucket.year || ""}`;
  }

  return new Date(bucket.year, Number(bucket.month || 1) - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
};

const buildAdminActivitySeries = async ({ period, createdAt, isDateFilterActive }) => {
  const periodGroupId = getPeriodGroupId(period);
  const [userRows, applicationRows, blogRows, announcementRows] = await Promise.all([
    User.aggregate([
      {
        $match: withCreatedAtFilter(
          { role: { $in: [ROLES.STUDENT, ROLES.UNIVERSITY, ROLES.BLOGGER] } },
          createdAt,
          isDateFilterActive,
        ),
      },
      {
        $group: {
          _id: { ...periodGroupId, role: "$role" },
          count: { $sum: 1 },
        },
      },
    ]),
    Application.aggregate([
      { $match: withCreatedAtFilter({}, createdAt, isDateFilterActive) },
      { $group: { _id: periodGroupId, count: { $sum: 1 } } },
    ]),
    BlogPost.aggregate([
      { $match: withCreatedAtFilter({}, createdAt, isDateFilterActive) },
      { $group: { _id: periodGroupId, count: { $sum: 1 } } },
    ]),
    Announcement.aggregate([
      { $match: withCreatedAtFilter({}, createdAt, isDateFilterActive) },
      { $group: { _id: periodGroupId, count: { $sum: 1 } } },
    ]),
  ]);

  const seriesMap = new Map();
  const ensureEntry = (bucket) => {
    const key = getBucketKey(bucket, period);
    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        key,
        period: getBucketLabel(bucket, period),
        students: 0,
        universities: 0,
        bloggers: 0,
        applications: 0,
        blogs: 0,
        announcements: 0,
      });
    }
    return seriesMap.get(key);
  };

  userRows.forEach((row) => {
    const { role, ...bucket } = row._id || {};
    const entry = ensureEntry(bucket);
    if (role === ROLES.STUDENT) entry.students += Number(row.count || 0);
    if (role === ROLES.UNIVERSITY) entry.universities += Number(row.count || 0);
    if (role === ROLES.BLOGGER) entry.bloggers += Number(row.count || 0);
  });

  applicationRows.forEach((row) => {
    ensureEntry(row._id).applications += Number(row.count || 0);
  });
  blogRows.forEach((row) => {
    ensureEntry(row._id).blogs += Number(row.count || 0);
  });
  announcementRows.forEach((row) => {
    ensureEntry(row._id).announcements += Number(row.count || 0);
  });

  return Array.from(seriesMap.values()).sort((a, b) => a.key.localeCompare(b.key));
};

const getDashboardStats = asyncHandler(async (req, res) => {
  const period = normalizeDashboardPeriod(req.query.period);
  const { createdAt, from, to, isActive: isDateFilterActive } = buildDashboardDateQuery(req.query);

  const [
    totalUniversities,
    pendingApprovals,
    approvedUniversities,
    rejectedUniversities,
    totalStudents,
    totalBloggers,
    totalApplications,
    pendingApplications,
    acceptedApplications,
    rejectedApplications,
    totalBlogs,
    totalAnnouncements,
    activitySeries,
  ] = await Promise.all([
    User.countDocuments(withCreatedAtFilter({ role: ROLES.UNIVERSITY }, createdAt, isDateFilterActive)),
    User.countDocuments(
      withCreatedAtFilter(
        {
          role: ROLES.UNIVERSITY,
          approvalStatus: UNIVERSITY_APPROVAL.PENDING,
        },
        createdAt,
        isDateFilterActive,
      ),
    ),
    User.countDocuments(
      withCreatedAtFilter(
        {
          role: ROLES.UNIVERSITY,
          approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
        },
        createdAt,
        isDateFilterActive,
      ),
    ),
    User.countDocuments(
      withCreatedAtFilter(
        {
          role: ROLES.UNIVERSITY,
          approvalStatus: UNIVERSITY_APPROVAL.REJECTED,
        },
        createdAt,
        isDateFilterActive,
      ),
    ),
    User.countDocuments(withCreatedAtFilter({ role: ROLES.STUDENT }, createdAt, isDateFilterActive)),
    User.countDocuments(withCreatedAtFilter({ role: ROLES.BLOGGER }, createdAt, isDateFilterActive)),
    Application.countDocuments(withCreatedAtFilter({}, createdAt, isDateFilterActive)),
    Application.countDocuments(
      withCreatedAtFilter(
        { status: { $in: ["pending", "under-review"] } },
        createdAt,
        isDateFilterActive,
      ),
    ),
    Application.countDocuments(
      withCreatedAtFilter({ status: "accepted" }, createdAt, isDateFilterActive),
    ),
    Application.countDocuments(
      withCreatedAtFilter({ status: "rejected" }, createdAt, isDateFilterActive),
    ),
    BlogPost.countDocuments(withCreatedAtFilter({}, createdAt, isDateFilterActive)),
    Announcement.countDocuments(withCreatedAtFilter({}, createdAt, isDateFilterActive)),
    buildAdminActivitySeries({ period, createdAt, isDateFilterActive }),
  ]);

  return res.status(200).json({
    success: true,
    data: {
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
        inReview: pendingApplications,
        accepted: acceptedApplications,
        rejected: rejectedApplications,
      },
      content: {
        blogPosts: totalBlogs,
        announcements: totalAnnouncements,
      },
      timeline: {
        period,
        from: from ? from.toISOString() : "",
        to: to ? to.toISOString() : "",
        isFiltered: isDateFilterActive,
        activity: activitySeries,
      },
    },
  });
});

const listUniversitiesForAdmin = asyncHandler(async (req, res) => {
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

  const universityIds = universities.map((uni) => uni._id);
  const profiles = await UniversityProfile.find({
    university: { $in: universityIds },
  }).lean();
  const profileMap = new Map(profiles.map((profile) => [String(profile.university), profile]));

  const items = universities.map((uni) => ({
    ...uni,
    profile: profileMap.get(String(uni._id)) || null,
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

const reviewUniversity = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid university id.");

  const { approvalStatus } = req.body;
  if (![UNIVERSITY_APPROVAL.APPROVED, UNIVERSITY_APPROVAL.REJECTED].includes(approvalStatus)) {
    throw new ApiError(400, "approvalStatus must be 'approved' or 'rejected'.");
  }

  const university = await User.findOne({
    _id: req.params.id,
    role: ROLES.UNIVERSITY,
  });

  if (!university) {
    throw new ApiError(404, "University account not found.");
  }

  university.approvalStatus = approvalStatus;
  await university.save();
  invalidateUniversityPublicCache(university._id);

  return res.status(200).json({
    success: true,
    message: `University has been ${approvalStatus}.`,
    data: {
      university: university.toSafeObject(),
    },
  });
});

const listStudentsForAdmin = asyncHandler(async (req, res) => {
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
  const profiles = await StudentProfile.find({
    user: { $in: studentIds },
  }).lean();
  const profileMap = new Map(profiles.map((profile) => [String(profile.user), profile]));

  const items = students.map((student) => ({
    ...student,
    profile: profileMap.get(String(student._id)) || null,
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

const listBloggersForAdmin = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const search = String(req.query.search || "").trim();
  const statusFilter = String(req.query.status || "all").toLowerCase();

  const query = { role: ROLES.BLOGGER };

  if (statusFilter !== "all") {
    query.status = statusFilter;
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

  return res.status(200).json({
    success: true,
    data: {
      items: bloggers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

const updateUserStatus = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid user id.");

  const { status } = req.body;
  if (![USER_STATUS.ACTIVE, USER_STATUS.INACTIVE].includes(status)) {
    throw new ApiError(400, "Status must be 'active' or 'inactive'.");
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  user.status = status;
  await user.save();
  if (user.role === ROLES.UNIVERSITY) {
    invalidateUniversityPublicCache(user._id);
  }

  return res.status(200).json({
    success: true,
    message: "User status updated successfully.",
    data: { user: user.toSafeObject() },
  });
});

module.exports = {
  getDashboardStats,
  listUniversitiesForAdmin,
  reviewUniversity,
  listStudentsForAdmin,
  listBloggersForAdmin,
  updateUserStatus,
};
