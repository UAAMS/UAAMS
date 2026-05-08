const mongoose = require("mongoose");

const recommendationSnapshotSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    recommendations: { type: mongoose.Schema.Types.Mixed, default: [] },
    profileBasis: { type: mongoose.Schema.Types.Mixed, default: {} },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

recommendationSnapshotSchema.index({ generatedAt: -1 });

module.exports = mongoose.model("RecommendationSnapshot", recommendationSnapshotSchema);
