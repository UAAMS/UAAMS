const mongoose = require("mongoose");
const User = require("../models/User");
const UniversityProfile = require("../models/UniversityProfile");
const UniversityForm = require("../models/UniversityForm");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const getPagination = require("../utils/pagination");
const { getCache, setCache, invalidateCachePrefix } = require("../utils/cacheClient");
const { sendBloggerCredentialsEmail } = require("../utils/mailer");
const { emitDataUpdate } = require("../utils/socket");
const { persistMaybeDataUrl } = require("../utils/fileStorage");
const { getSystemApplicationTemplate, SYSTEM_TEMPLATE_ID } = require("../config/systemApplicationTemplate");
const {
  ROLES,
  UNIVERSITY_APPROVAL,
  USER_STATUS,
} = require("../constants/roles");

const defaultApplicationFields = [
  {
    id: "1",
    label: "Full Name",
    type: "text",
    required: true,
    placeholder: "Enter your full name",
    options: [],
    order: 1,
  },
  {
    id: "2",
    label: "Email Address",
    type: "email",
    required: true,
    placeholder: "your.email@example.com",
    options: [],
    order: 2,
  },
  {
    id: "3",
    label: "Phone Number",
    type: "tel",
    required: true,
    placeholder: "+92-300-1234567",
    options: [],
    order: 3,
  },
  {
    id: "4",
    label: "CNIC/B-Form Number",
    type: "text",
    required: true,
    placeholder: "12345-1234567-1",
    options: [],
    order: 4,
  },
  {
    id: "7",
    label: "Matric Marks",
    type: "number",
    required: true,
    placeholder: "Total marks obtained",
    options: [],
    order: 7,
  },
  {
    id: "8",
    label: "FSc/A-Level Marks",
    type: "number",
    required: true,
    placeholder: "Total marks obtained",
    options: [],
    order: 8,
  },
  {
    id: "9",
    label: "Profile Picture",
    type: "file",
    required: true,
    placeholder: "",
    options: [],
    order: 9,
  },
  {
    id: "10",
    label: "Domicile Certificate",
    type: "file",
    required: true,
    placeholder: "",
    options: [],
    order: 10,
  },
  {
    id: "11",
    label: "Matric Result",
    type: "file",
    required: true,
    placeholder: "",
    options: [],
    order: 11,
  },
  {
    id: "12",
    label: "Inter Result",
    type: "file",
    required: true,
    placeholder: "",
    options: [],
    order: 12,
  },
];

const ensureObjectId = (id, message = "Invalid resource id.") => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, message);
  }
};

const UNIVERSITIES_LIST_CACHE_PREFIX = "universities:list:";
const UNIVERSITY_DETAIL_CACHE_PREFIX = "universities:detail:";
const UNIVERSITY_FORM_CACHE_PREFIX = "universities:form:";

const buildCacheKey = (prefix, payload = {}) => `${prefix}${JSON.stringify(payload)}`;

const invalidateUniversityPublicCache = (universityId = "") => {
  invalidateCachePrefix(UNIVERSITIES_LIST_CACHE_PREFIX);
  if (universityId) {
    invalidateCachePrefix(`${UNIVERSITY_DETAIL_CACHE_PREFIX}${String(universityId)}:`);
    invalidateCachePrefix(`${UNIVERSITY_FORM_CACHE_PREFIX}${String(universityId)}:`);
  }
};

const listUniversities = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const search = String(req.query.search || "").trim();
  const type = String(req.query.type || "all").toLowerCase();
  const cacheKey = buildCacheKey(UNIVERSITIES_LIST_CACHE_PREFIX, { page, limit, search, type });
  const cachedResponse = await getCache(cacheKey);

  if (cachedResponse) {
    return res.status(200).json(cachedResponse);
  }

  const userQuery = {
    role: ROLES.UNIVERSITY,
    approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
    status: USER_STATUS.ACTIVE,
  };

  if (search) {
    userQuery.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { location: { $regex: search, $options: "i" } },
    ];
  }

  const [total, universities] = await Promise.all([
    User.countDocuments(userQuery),
    User.find(userQuery)
      .select("name email location website createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const universityIds = universities.map((item) => item._id);
  const profiles = await UniversityProfile.find({
    university: { $in: universityIds },
  })
    .select("university universityName type city email website applicationFee programs")
    .lean();
  const profileMap = new Map(profiles.map((item) => [String(item.university), item]));

  const items = universities
    .map((uni) => {
      const profile = profileMap.get(String(uni._id));
      return {
        id: uni._id,
        name: profile?.universityName || uni.name,
        type: profile?.type || "public",
        location: profile?.city || uni.location || "Pakistan",
        email: profile?.email || uni.email,
        website: profile?.website || uni.website || "",
        applicationFee: Number(profile?.applicationFee || 0),
        programs: Array.isArray(profile?.programs)
          ? profile.programs.map((program) => ({
              id: program._id,
              name: program.name,
              seats: program.seats,
              feeRange: program.feeRange,
              requiredAggregate: program.requiredAggregate,
              deadlineDate: program.deadlineDate || null,
              isAdmissionOpen: program.isAdmissionOpen !== false,
            }))
          : [],
      };
    })
    .filter((uni) => (type === "all" ? true : uni.type.toLowerCase() === type));

  const responsePayload = {
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
  };

  await setCache(cacheKey, responsePayload, env.apiCacheTtlMs);

  return res.status(200).json(responsePayload);
});

const getUniversityById = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid university id.");
  const cacheKey = buildCacheKey(`${UNIVERSITY_DETAIL_CACHE_PREFIX}${String(req.params.id)}:`, {
    includeProfile: true,
  });
  const cachedResponse = await getCache(cacheKey);
  if (cachedResponse) {
    return res.status(200).json(cachedResponse);
  }

  const user = await User.findOne({
    _id: req.params.id,
    role: ROLES.UNIVERSITY,
    approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
  })
    .select("name email location website")
    .lean();

  if (!user) {
    throw new ApiError(404, "University not found.");
  }

  const profile = await UniversityProfile.findOne({ university: user._id })
    .select(
      [
        "universityName",
        "email",
        "type",
        "city",
        "website",
        "applicationFee",
        "applicationStartDate",
        "applicationEndDate",
        "programs",
      ].join(" ")
    )
    .lean();

  const responsePayload = {
    success: true,
    data: {
      university: {
        id: user._id,
        name: profile?.universityName || user.name,
        email: profile?.email || user.email,
        type: profile?.type || "public",
        city: profile?.city || user.location || "",
        website: profile?.website || user.website || "",
        applicationFee: Number(profile?.applicationFee || 0),
        applicationStartDate: profile?.applicationStartDate || null,
        applicationEndDate: profile?.applicationEndDate || null,
        programs: Array.isArray(profile?.programs)
          ? profile.programs.map((program) => ({
              ...program,
              isAdmissionOpen: program?.isAdmissionOpen !== false,
            }))
          : [],
        profile,
      },
    },
  };

  await setCache(cacheKey, responsePayload, env.apiCacheTtlMs);

  return res.status(200).json(responsePayload);
});

const getUniversityFormByUniversityId = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid university id.");
  const cacheKey = buildCacheKey(`${UNIVERSITY_FORM_CACHE_PREFIX}${String(req.params.id)}:`, {
    defaultFieldsVersion: 1,
    systemTemplateId: SYSTEM_TEMPLATE_ID,
  });
  const cachedResponse = await getCache(cacheKey);
  if (cachedResponse) {
    return res.status(200).json(cachedResponse);
  }

  const university = await User.findOne({
    _id: req.params.id,
    role: ROLES.UNIVERSITY,
    approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
  })
    .select("_id")
    .lean();

  if (!university) {
    throw new ApiError(404, "University not found.");
  }

  const form = await UniversityForm.findOne({ university: req.params.id })
    .select("fields version updatedAt")
    .lean();
  const activeTemplate = getSystemApplicationTemplate();

  const responsePayload = {
    success: true,
    data: {
      universityId: req.params.id,
      fields: form?.fields?.length ? form.fields : defaultApplicationFields,
      templates: [activeTemplate],
      activeTemplateId: SYSTEM_TEMPLATE_ID,
      activeTemplate,
      version: form?.version || 1,
      updatedAt: form?.updatedAt || null,
    },
  };

  await setCache(cacheKey, responsePayload, env.apiCacheTtlMs);

  return res.status(200).json(responsePayload);
});

const getMyProfile = asyncHandler(async (req, res) => {
  let profile = await UniversityProfile.findOne({ university: req.user._id });

  if (!profile) {
    profile = await UniversityProfile.create({
      university: req.user._id,
      universityName: req.user.name,
      email: req.user.email,
      city: req.user.location || "",
      website: req.user.website || "",
      representativeName: req.user.representativeName || "",
      established: req.user.establishedYear || "",
      totalStudents: req.user.studentCount || "",
    });
  }

  return res.status(200).json({
    success: true,
    data: { profile },
  });
});

const updateMyProfile = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  delete payload.university;
  delete payload._id;
  if (Object.prototype.hasOwnProperty.call(payload, "logo")) {
    payload.logo = await persistMaybeDataUrl({
      value: payload.logo,
      folder: `university-profiles/${String(req.user._id)}`,
      preferredName: payload.shortName || payload.universityName || "university-logo",
    });
  }

  const profile = await UniversityProfile.findOneAndUpdate(
    { university: req.user._id },
    { $set: payload, $setOnInsert: { university: req.user._id, universityName: req.user.name } },
    { new: true, upsert: true, runValidators: true }
  );

  await User.findByIdAndUpdate(req.user._id, {
    $set: {
      name: profile.universityName || req.user.name,
      location: profile.city || req.user.location,
      website: profile.website || req.user.website,
      representativeName: profile.representativeName || req.user.representativeName,
      phone: profile.phone || req.user.phone,
    },
  });
  invalidateUniversityPublicCache(req.user._id);

  return res.status(200).json({
    success: true,
    message: "University profile updated successfully.",
    data: { profile },
  });
});

const getMyForm = asyncHandler(async (req, res) => {
  const form = await UniversityForm.findOne({ university: req.user._id }).lean();
  const activeTemplate = getSystemApplicationTemplate();

  return res.status(200).json({
    success: true,
    data: {
      fields: form?.fields?.length ? form.fields : defaultApplicationFields,
      templates: [activeTemplate],
      activeTemplateId: SYSTEM_TEMPLATE_ID,
      activeTemplate,
      version: form?.version || 1,
      updatedAt: form?.updatedAt || null,
    },
  });
});

const upsertMyForm = asyncHandler(async (req, res) => {
  const { fields } = req.body;

  if (!Array.isArray(fields) || fields.length === 0) {
    throw new ApiError(400, "At least one form field is required.");
  }

  const normalizedFields = fields.map((field, index) => ({
    id: String(field.id || index + 1),
    label: String(field.label || "").trim(),
    type: String(field.type || "text"),
    required: Boolean(field.required),
    placeholder: String(field.placeholder || ""),
    options: Array.isArray(field.options) ? field.options.map(String) : [],
    order: Number(field.order || index + 1),
  }));

  if (normalizedFields.some((field) => !field.label)) {
    throw new ApiError(400, "Every form field must have a label.");
  }

  const existing = await UniversityForm.findOne({ university: req.user._id });

  const form = await UniversityForm.findOneAndUpdate(
    { university: req.user._id },
    {
      $set: {
        fields: normalizedFields,
        updatedBy: req.user._id,
        version: existing ? existing.version + 1 : 1,
      },
    },
    { upsert: true, new: true, runValidators: true }
  );
  invalidateUniversityPublicCache(req.user._id);

  return res.status(200).json({
    success: true,
    message: "Application form saved successfully.",
    data: { form },
  });
});

const listMyBloggers = asyncHandler(async (req, res) => {
  const bloggers = await User.find({
    role: ROLES.BLOGGER,
    managedUniversity: req.user._id,
  })
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json({
    success: true,
    data: { bloggers },
  });
});

const createBlogger = asyncHandler(async (req, res) => {
  const { name, email, password, phone, username } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, "Name, email, and password are required to create a blogger.");
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedUsername = username
    ? String(username).trim().toLowerCase()
    : `blogger_${String(name).trim().toLowerCase().replace(/\s+/g, "_")}`;

  const existing = await User.findOne({
    $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
  });

  if (existing) {
    throw new ApiError(409, "A user with this email or username already exists.");
  }

  const blogger = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    username: normalizedUsername,
    password: String(password),
    role: ROLES.BLOGGER,
    managedUniversity: req.user._id,
    phone: phone ? String(phone).trim() : "",
    approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
    status: USER_STATUS.ACTIVE,
  });

  let emailDelivery = {
    sent: false,
    reason: "Credential email was not attempted.",
  };

  try {
    emailDelivery = await sendBloggerCredentialsEmail({
      to: blogger.email,
      bloggerName: blogger.name,
      username: blogger.username,
      email: blogger.email,
      password: String(password),
      universityName: req.user?.name || "University",
    });
  } catch (emailError) {
    emailDelivery = {
      sent: false,
      reason: emailError?.message || "Failed to send credential email.",
    };
  }

  emitDataUpdate({
    resource: "bloggers",
    action: "created",
    userIds: [String(req.user._id)],
    payload: {
      bloggerId: String(blogger._id),
    },
  });

  return res.status(201).json({
    success: true,
    message: emailDelivery.sent
      ? "Blogger created successfully and credential email sent."
      : "Blogger created successfully.",
    data: {
      blogger: blogger.toSafeObject(),
      credentials: {
        username: blogger.username,
        email: blogger.email,
        password: String(password),
      },
      emailDelivery,
    },
  });
});

const updateMyBloggerStatus = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.bloggerId, "Invalid blogger id.");

  const status = String(req.body.status || "").toLowerCase();
  if (![USER_STATUS.ACTIVE, USER_STATUS.INACTIVE].includes(status)) {
    throw new ApiError(400, "Invalid status. Allowed: active, inactive.");
  }

  const blogger = await User.findOne({
    _id: req.params.bloggerId,
    role: ROLES.BLOGGER,
    managedUniversity: req.user._id,
  });

  if (!blogger) {
    throw new ApiError(404, "Blogger not found for this university.");
  }

  blogger.status = status;
  await blogger.save();

  emitDataUpdate({
    resource: "bloggers",
    action: "updated",
    userIds: [String(req.user._id)],
    payload: {
      bloggerId: String(blogger._id),
      status: blogger.status,
    },
  });

  return res.status(200).json({
    success: true,
    message: "Blogger status updated successfully.",
    data: { blogger: blogger.toSafeObject() },
  });
});

const deleteMyBlogger = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.bloggerId, "Invalid blogger id.");

  const deleted = await User.findOneAndDelete({
    _id: req.params.bloggerId,
    role: ROLES.BLOGGER,
    managedUniversity: req.user._id,
  });

  if (!deleted) {
    throw new ApiError(404, "Blogger not found for this university.");
  }

  emitDataUpdate({
    resource: "bloggers",
    action: "deleted",
    userIds: [String(req.user._id)],
    payload: {
      bloggerId: String(req.params.bloggerId),
    },
  });

  return res.status(200).json({
    success: true,
    message: "Blogger account deleted successfully.",
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
  defaultApplicationFields,
  invalidateUniversityPublicCache,
};
