const mongoose = require("mongoose");

const blogCommentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlogPost",
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlogComment",
      default: null,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    likes: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
  },
  { timestamps: true }
);

blogCommentSchema.index({ post: 1, createdAt: 1 });
blogCommentSchema.index({ post: 1, parentComment: 1, createdAt: 1 });
blogCommentSchema.index({ student: 1, createdAt: -1 });

module.exports = mongoose.model("BlogComment", blogCommentSchema);
