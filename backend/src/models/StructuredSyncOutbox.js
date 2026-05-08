const mongoose = require("mongoose");

const structuredSyncOutboxSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ["user", "studentProfile", "universityProfile", "application"],
      required: true,
      index: true,
    },
    entityId: { type: String, required: true, index: true },
    action: {
      type: String,
      enum: ["upsert", "delete"],
      default: "upsert",
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "failed"],
      default: "pending",
      index: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    lastError: { type: String, default: "" },
    nextRunAt: { type: Date, default: Date.now, index: true },
    lockedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

structuredSyncOutboxSchema.index({ entityType: 1, entityId: 1 }, { unique: true });
structuredSyncOutboxSchema.index({ status: 1, nextRunAt: 1, updatedAt: 1 });
structuredSyncOutboxSchema.index({ status: 1, lockedAt: 1 });

module.exports = mongoose.model("StructuredSyncOutbox", structuredSyncOutboxSchema);
