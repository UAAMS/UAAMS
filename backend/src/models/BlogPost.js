const mongoose = require("mongoose");

const blogPostSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    university: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 240 },
    excerpt: { type: String, required: true, trim: true, maxlength: 1000 },
    content: { type: String, required: true, trim: true },
    category: { type: String, default: "General", trim: true },
    tags: { type: [String], default: [] },
    imageUrl: { type: String, default: "" },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    readTime: { type: String, default: "1 min" },
    views: { type: Number, default: 0, min: 0 },
    viewedBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    likes: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

blogPostSchema.index({ university: 1, status: 1, publishedAt: -1, createdAt: -1 });
blogPostSchema.index({ author: 1, status: 1, updatedAt: -1, createdAt: -1 });
blogPostSchema.index({ university: 1, category: 1, status: 1 });

module.exports = mongoose.model("BlogPost", blogPostSchema);
