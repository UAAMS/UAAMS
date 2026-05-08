const StructuredSyncOutbox = require("../models/StructuredSyncOutbox");
const env = require("../config/env");

const queueStructuredSync = async ({ entityType, entityId, action = "upsert" }) => {
  const normalizedEntityType = String(entityType || "").trim();
  const normalizedEntityId = String(entityId || "").trim();
  const normalizedAction = action === "delete" ? "delete" : "upsert";

  if (!env.enablePsql) return;
  if (!normalizedEntityType || !normalizedEntityId) return;

  await StructuredSyncOutbox.findOneAndUpdate(
    {
      entityType: normalizedEntityType,
      entityId: normalizedEntityId,
    },
    {
      $set: {
        action: normalizedAction,
        status: "pending",
        lastError: "",
        nextRunAt: new Date(),
        lockedAt: null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

module.exports = {
  queueStructuredSync,
};
