const StructuredSyncOutbox = require("../models/StructuredSyncOutbox");
const { getStructuredStore } = require("./store");
const { syncStructuredEntity } = require("./syncService");

const DEFAULT_INTERVAL_MS = 10 * 1000;
const DEFAULT_BATCH_SIZE = 25;

const workerState = {
  running: false,
  timer: null,
  processing: false,
  lastRunAt: null,
  lastError: "",
};

const calculateBackoffMs = (attempts) => {
  const step = Math.max(1, Number(attempts || 1));
  return Math.min(10 * 60 * 1000, step * 15 * 1000);
};

const claimEvent = async (eventId) =>
  StructuredSyncOutbox.findOneAndUpdate(
    {
      _id: eventId,
      status: { $in: ["pending", "failed"] },
      $or: [{ lockedAt: null }, { lockedAt: { $exists: false } }],
    },
    {
      $set: {
        status: "processing",
        lockedAt: new Date(),
      },
    },
    { new: true }
  );

const releaseFailedEvent = async (event, error) => {
  const nextAttempts = Number(event.attempts || 0) + 1;
  const nextRunAt = new Date(Date.now() + calculateBackoffMs(nextAttempts));
  await StructuredSyncOutbox.findByIdAndUpdate(event._id, {
    $set: {
      status: "failed",
      attempts: nextAttempts,
      nextRunAt,
      lastError: error?.message || "Structured sync failed",
      lockedAt: null,
    },
  });
};

const processBatch = async () => {
  const store = getStructuredStore();
  if (!store.enabled || !store.ready || !store.models) return;
  if (workerState.processing) return;

  workerState.processing = true;
  workerState.lastError = "";
  workerState.lastRunAt = new Date();

  try {
    const now = new Date();
    const candidates = await StructuredSyncOutbox.find({
      status: { $in: ["pending", "failed"] },
      nextRunAt: { $lte: now },
    })
      .sort({ updatedAt: 1 })
      .limit(DEFAULT_BATCH_SIZE)
      .lean();

    for (const candidate of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const claimed = await claimEvent(candidate._id);
      if (!claimed) continue;

      try {
        // eslint-disable-next-line no-await-in-loop
        await syncStructuredEntity({
          entityType: claimed.entityType,
          entityId: claimed.entityId,
          action: claimed.action,
        });
        // eslint-disable-next-line no-await-in-loop
        await StructuredSyncOutbox.deleteOne({ _id: claimed._id });
      } catch (error) {
        // eslint-disable-next-line no-await-in-loop
        await releaseFailedEvent(claimed, error);
      }
    }
  } catch (error) {
    workerState.lastError = error?.message || "Structured sync worker failed";
  } finally {
    workerState.processing = false;
  }
};

const startStructuredSyncWorker = () => {
  if (workerState.running) return;
  workerState.running = true;
  workerState.timer = setInterval(processBatch, DEFAULT_INTERVAL_MS);
  workerState.timer.unref?.();
  void processBatch();
};

const stopStructuredSyncWorker = () => {
  workerState.running = false;
  if (workerState.timer) {
    clearInterval(workerState.timer);
    workerState.timer = null;
  }
};

const getStructuredWorkerState = () => ({ ...workerState });

module.exports = {
  startStructuredSyncWorker,
  stopStructuredSyncWorker,
  getStructuredWorkerState,
  processBatch,
};
