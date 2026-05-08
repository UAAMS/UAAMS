const mongoose = require("mongoose");
const StructuredSyncOutbox = require("../models/StructuredSyncOutbox");
const env = require("../config/env");
const { getStructuredStore } = require("../structured/store");
const { getStructuredWorkerState } = require("../structured/worker");

const getHealth = async (_req, res) => {
  try {
    const store = getStructuredStore();
    const worker = getStructuredWorkerState();
    const [outboxPending, outboxFailed] = await Promise.all([
      StructuredSyncOutbox.countDocuments({ status: "pending" }),
      StructuredSyncOutbox.countDocuments({ status: "failed" }),
    ]);

    const mongodb = {
      readyState: mongoose.connection.readyState,
      database: mongoose.connection.name || "",
    };

    const postgresql = {
      enabled: env.enablePsql,
      ready: Boolean(store.ready),
      lastError: store.lastError || "",
    };

    const outbox = {
      pending: outboxPending,
      failed: outboxFailed,
      workerRunning: Boolean(worker.running),
      workerLastRunAt: worker.lastRunAt || null,
      workerLastError: worker.lastError || "",
    };

    const isHealthy =
      mongodb.readyState === 1 &&
      (!env.enablePsql || (store.ready && outboxFailed === 0));

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      message: isHealthy
        ? "UAAMS backend is healthy."
        : "UAAMS backend is running with data sync issues.",
      data: {
        uptimeSeconds: process.uptime(),
        timestamp: new Date().toISOString(),
        mongodb,
        postgresql,
        outbox,
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: "Health check failed.",
      data: {
        uptimeSeconds: process.uptime(),
        timestamp: new Date().toISOString(),
        error: error?.message || "Unknown health error",
      },
    });
  }
};

module.exports = {
  getHealth,
};
