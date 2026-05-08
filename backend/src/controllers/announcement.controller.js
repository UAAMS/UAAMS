const mongoose = require("mongoose");
const Announcement = require("../models/Announcement");
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

const listAnnouncements = asyncHandler(async (req, res) => {
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
    const search = String(req.query.search).trim();
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { content: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
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

const listAnnouncementsByUniversity = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.universityId, "Invalid university id.");

  const universityExists = await User.findById(req.params.universityId).lean();
  if (!universityExists) {
    throw new ApiError(404, "University not found.");
  }

  const query = { university: req.params.universityId };
  const isOwnerOrAdmin =
    req.user &&
    (req.user.role === ROLES.ADMIN ||
      String(req.user._id) === String(req.params.universityId));

  if (!isOwnerOrAdmin) {
    query.status = "published";
  }

  const announcements = await Announcement.find(query)
    .sort({ createdAt: -1 })
    .populate("university", "name")
    .lean();

  return res.status(200).json({
    success: true,
    data: { announcements },
  });
});

const createAnnouncement = asyncHandler(async (req, res) => {
  const { title, content, type, category, status, attachmentUrl, attachmentName } = req.body;

  if (!title || !content) {
    throw new ApiError(400, "Title and content are required.");
  }

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
    status: String(status || "draft"),
    publishedAt: status === "published" ? new Date() : null,
  });

  return res.status(201).json({
    success: true,
    message: "Announcement created successfully.",
    data: { announcement },
  });
});

const updateAnnouncement = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid announcement id.");

  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) {
    throw new ApiError(404, "Announcement not found.");
  }

  const isOwner = String(announcement.university) === String(req.user._id);
  const isAdmin = req.user.role === ROLES.ADMIN;
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You do not have permission to update this announcement.");
  }

  const updates = { ...req.body };
  delete updates._id;
  delete updates.university;
  delete updates.createdBy;

  if (Object.prototype.hasOwnProperty.call(updates, "attachmentUrl")) {
    updates.attachmentUrl = await persistMaybeDataUrl({
      value: updates.attachmentUrl,
      folder: `announcements/${String(announcement.university)}`,
      preferredName: updates.attachmentName || updates.title || announcement.title || "announcement-attachment",
    });
    updates.attachmentUrl = String(updates.attachmentUrl || "").trim();
  }
  if (Object.prototype.hasOwnProperty.call(updates, "attachmentName")) {
    updates.attachmentName = String(updates.attachmentName || "").trim();
  }

  if (updates.status === "published" && !announcement.publishedAt) {
    updates.publishedAt = new Date();
  }

  const updated = await Announcement.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  return res.status(200).json({
    success: true,
    message: "Announcement updated successfully.",
    data: { announcement: updated },
  });
});

const deleteAnnouncement = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid announcement id.");

  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) {
    throw new ApiError(404, "Announcement not found.");
  }

  const isOwner = String(announcement.university) === String(req.user._id);
  const isAdmin = req.user.role === ROLES.ADMIN;
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, "You do not have permission to delete this announcement.");
  }

  await Announcement.findByIdAndDelete(req.params.id);

  return res.status(200).json({
    success: true,
    message: "Announcement deleted successfully.",
  });
});

module.exports = {
  listAnnouncements,
  listAnnouncementsByUniversity,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};
