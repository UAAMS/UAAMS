const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    university: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    type: {
      type: String,
      enum: ["general", "deadline", "merit-list", "urgent"],
      default: "general",
      index: true,
    },
    category: { type: String, default: "General", trim: true },
    attachmentUrl: { type: String, default: "", trim: true },
    attachmentName: { type: String, default: "", trim: true },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    publishedAt: { type: Date, default: null },
    visibleFrom: { type: Date, default: null, index: true },
    expiresAt: { type: Date, default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

announcementSchema.index({ university: 1, status: 1, createdAt: -1 });
announcementSchema.index({ status: 1, publishedAt: -1, createdAt: -1 });
announcementSchema.index({ university: 1, type: 1, status: 1 });
announcementSchema.index({ status: 1, visibleFrom: 1, expiresAt: 1 });

module.exports = mongoose.model("Announcement", announcementSchema);
