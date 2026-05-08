const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const normalizeSmtpPassword = (rawValue, host) => {
  const value = String(rawValue || "");
  if (typeof host === "string" && host.toLowerCase().includes("smtp.gmail.com")) {
    const trimmed = value.replace(/\s+/g, "");
    if (trimmed.length === 16) {
      return trimmed;
    }
  }
  return value;
};

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/uaams",
  jwtSecret: process.env.JWT_SECRET || "uaams-dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigin:
    process.env.CORS_ORIGIN ||
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: normalizeSmtpPassword(process.env.SMTP_PASS, process.env.SMTP_HOST),
  smtpFrom: process.env.SMTP_FROM || "",
  frontendUrl: process.env.FRONTEND_URL || "",
  enablePsql: String(process.env.ENABLE_PSQL || "false").toLowerCase() === "true",
  pgHost: process.env.PG_HOST || "127.0.0.1",
  pgPort: Number(process.env.PG_PORT || 5432),
  pgDatabase: process.env.PG_DATABASE || "uaams",
  pgUser: process.env.PG_USER || "postgres",
  pgPassword: process.env.PG_PASSWORD || "",
  pgSsl: String(process.env.PG_SSL || "false").toLowerCase() === "true",
  psqlSyncSchema: String(process.env.PSQL_SYNC_SCHEMA || "true").toLowerCase() === "true",
  psqlLogQueries: String(process.env.PSQL_LOG_QUERIES || "false").toLowerCase() === "true",
  compressionEnabled: String(process.env.COMPRESSION_ENABLED || "true").toLowerCase() === "true",
  apiCacheTtlMs: Number(process.env.API_CACHE_TTL_MS || 60 * 1000),
  recommendationsCacheTtlMs: Number(process.env.RECOMMENDATIONS_CACHE_TTL_MS || 5 * 60 * 1000),
  redisUrl: process.env.REDIS_URL || "",
  redisEnabled:
    String(
      process.env.REDIS_ENABLED ||
        (process.env.REDIS_URL ? "true" : "false")
    ).toLowerCase() === "true",
  redisPrefix: process.env.REDIS_PREFIX || "uaams:",
  redisTls: String(process.env.REDIS_TLS || "false").toLowerCase() === "true",
  redisConnectionTimeoutMs: Number(process.env.REDIS_CONNECTION_TIMEOUT_MS || 5000),
  fileStorageDriver: String(process.env.FILE_STORAGE_DRIVER || "local").toLowerCase(),
  uploadsDir: path.resolve(process.cwd(), process.env.UPLOADS_DIR || "uploads"),
  uploadsPublicBaseUrl:
    process.env.UPLOADS_PUBLIC_BASE_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    `http://localhost:${Number(process.env.PORT || 5000)}`,
  s3Region: process.env.S3_REGION || "",
  s3Bucket: process.env.S3_BUCKET || "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  s3Endpoint: process.env.S3_ENDPOINT || "",
  s3ForcePathStyle: String(process.env.S3_FORCE_PATH_STYLE || "false").toLowerCase() === "true",
  s3PublicBaseUrl: process.env.S3_PUBLIC_BASE_URL || "",
  s3KeyPrefix: process.env.S3_KEY_PREFIX || "",
};

if (!["local", "s3"].includes(env.fileStorageDriver)) {
  env.fileStorageDriver = "local";
}

module.exports = env;
