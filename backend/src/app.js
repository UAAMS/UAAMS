const express = require("express");
const cors = require("cors");
const compression = require("compression");
const morgan = require("morgan");
const path = require("path");
const env = require("./config/env");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/error.middleware");

const app = express();
const configuredOrigins = String(env.corsOrigin || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const allowedOrigins = new Set(configuredOrigins);

const isLocalDevOrigin = (origin) =>
  env.nodeEnv !== "production" &&
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin) || isLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
if (env.compressionEnabled) {
  app.use(
    compression({
      level: 6,
      threshold: 1024,
    }),
  );
}
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
app.use("/uploads", express.static(path.resolve(env.uploadsDir)));

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "UAAMS backend is running.",
    docs: "/api/health",
  });
});

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
