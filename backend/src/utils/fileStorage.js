const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const env = require("../config/env");

let S3Client = null;
let PutObjectCommand = null;
try {
  ({ S3Client, PutObjectCommand } = require("@aws-sdk/client-s3"));
} catch {
  S3Client = null;
  PutObjectCommand = null;
}

const DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/i;

const MIME_EXTENSION_MAP = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/zip": "zip",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

const isPlainObject = (value) => Object.prototype.toString.call(value) === "[object Object]";

const sanitizePathSegment = (value, fallback = "file") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
};

const sanitizeFolderPath = (folder = "misc") => {
  const raw = String(folder || "").trim();
  if (!raw) {
    return "";
  }

  return raw
    .split(/[\\/]+/)
    .map((segment) => sanitizePathSegment(segment, "segment"))
    .filter(Boolean)
    .join("/");
};

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

const toPosixPath = (value) => String(value || "").replace(/\\/g, "/");

const isDataUrl = (value) => DATA_URL_PATTERN.test(String(value || ""));

const parseDataUrl = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(DATA_URL_PATTERN);
  if (!match) {
    return null;
  }

  const mimeType = String(match[1] || "").toLowerCase();
  const base64Payload = String(match[2] || "");

  try {
    const bytes = Buffer.from(base64Payload, "base64");
    return {
      mimeType: mimeType || "application/octet-stream",
      bytes,
    };
  } catch {
    return null;
  }
};

const inferExtension = (mimeType, preferredName = "") => {
  const preferredExtension = path.extname(String(preferredName || "")).replace(".", "").toLowerCase();
  if (preferredExtension) {
    return preferredExtension;
  }
  return MIME_EXTENSION_MAP[String(mimeType || "").toLowerCase()] || "bin";
};

const buildFileName = ({ preferredName = "", mimeType = "application/octet-stream" }) => {
  const extension = inferExtension(mimeType, preferredName);
  const preferredStem = path.basename(String(preferredName || ""), path.extname(String(preferredName || "")));
  const stem = sanitizePathSegment(preferredStem || "file");
  const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  return `${stem}-${suffix}.${extension}`;
};

const resolveLocalPublicUrl = (fileKey) => {
  const normalizedFileKey = toPosixPath(fileKey).replace(/^\/+/, "");
  const base = trimTrailingSlash(env.uploadsPublicBaseUrl);
  if (base) {
    return `${base}/uploads/${normalizedFileKey}`;
  }
  return `/uploads/${normalizedFileKey}`;
};

let s3Client = null;
const getS3Client = () => {
  if (s3Client) {
    return s3Client;
  }

  if (!S3Client || !PutObjectCommand) {
    throw new Error("S3 storage driver requested but AWS SDK is not installed.");
  }

  if (!env.s3Bucket || !env.s3Region) {
    throw new Error("S3 storage is enabled but S3_BUCKET or S3_REGION is missing.");
  }

  const options = {
    region: env.s3Region,
  };

  if (env.s3Endpoint) {
    options.endpoint = env.s3Endpoint;
  }

  if (env.s3AccessKeyId && env.s3SecretAccessKey) {
    options.credentials = {
      accessKeyId: env.s3AccessKeyId,
      secretAccessKey: env.s3SecretAccessKey,
    };
  }

  if (env.s3ForcePathStyle) {
    options.forcePathStyle = true;
  }

  s3Client = new S3Client(options);
  return s3Client;
};

const resolveS3PublicUrl = (key) => {
  const normalizedKey = String(key || "").replace(/^\/+/, "");

  if (env.s3PublicBaseUrl) {
    return `${trimTrailingSlash(env.s3PublicBaseUrl)}/${normalizedKey}`;
  }

  if (env.s3Endpoint && env.s3ForcePathStyle) {
    return `${trimTrailingSlash(env.s3Endpoint)}/${env.s3Bucket}/${normalizedKey}`;
  }

  const encodedKey = normalizedKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://${env.s3Bucket}.s3.${env.s3Region}.amazonaws.com/${encodedKey}`;
};

const persistToLocalStorage = async ({ bytes, folder, preferredName, mimeType }) => {
  const normalizedFolder = sanitizeFolderPath(folder || "misc") || "misc";
  const fileName = buildFileName({ preferredName, mimeType });
  const relativeKey = toPosixPath(path.posix.join(normalizedFolder, fileName));
  const absoluteDir = path.resolve(env.uploadsDir, normalizedFolder);
  const absoluteFilePath = path.resolve(absoluteDir, fileName);

  await fs.mkdir(absoluteDir, { recursive: true });
  await fs.writeFile(absoluteFilePath, bytes);

  return resolveLocalPublicUrl(relativeKey);
};

const persistToS3Storage = async ({ bytes, folder, preferredName, mimeType }) => {
  const normalizedFolder = sanitizeFolderPath(folder || "misc") || "misc";
  const fileName = buildFileName({ preferredName, mimeType });
  const key = [sanitizeFolderPath(env.s3KeyPrefix || ""), normalizedFolder, fileName]
    .filter(Boolean)
    .join("/");

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
      Body: bytes,
      ContentType: mimeType,
    })
  );

  return resolveS3PublicUrl(key);
};

const persistDataUrl = async ({ dataUrl, folder = "misc", preferredName = "" } = {}) => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed || !parsed.bytes || parsed.bytes.length === 0) {
    throw new Error("Invalid or empty data URL.");
  }

  if (env.fileStorageDriver === "s3") {
    return persistToS3Storage({
      bytes: parsed.bytes,
      folder,
      preferredName,
      mimeType: parsed.mimeType,
    });
  }

  return persistToLocalStorage({
    bytes: parsed.bytes,
    folder,
    preferredName,
    mimeType: parsed.mimeType,
  });
};

const persistMaybeDataUrl = async ({ value, folder = "misc", preferredName = "" } = {}) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = String(value).trim();
  if (!isDataUrl(trimmedValue)) {
    return trimmedValue;
  }

  return persistDataUrl({
    dataUrl: trimmedValue,
    folder,
    preferredName,
  });
};

const persistDataUrlsInValue = async (
  value,
  { folder = "misc", preferredNamePrefix = "file" } = {},
  pathParts = []
) => {
  if (typeof value === "string" && isDataUrl(value)) {
    const preferredName = [preferredNamePrefix, ...pathParts]
      .map((part) => sanitizePathSegment(part, "field"))
      .join("-");
    const persisted = await persistDataUrl({ dataUrl: value, folder, preferredName });
    return { value: persisted, convertedCount: 1 };
  }

  if (Array.isArray(value)) {
    const updatedItems = [];
    let convertedCount = 0;

    for (let index = 0; index < value.length; index += 1) {
      const result = await persistDataUrlsInValue(
        value[index],
        { folder, preferredNamePrefix },
        [...pathParts, String(index)]
      );
      updatedItems.push(result.value);
      convertedCount += result.convertedCount;
    }

    return { value: updatedItems, convertedCount };
  }

  if (isPlainObject(value)) {
    const updatedObject = {};
    let convertedCount = 0;
    const entries = Object.entries(value);

    for (const [entryKey, entryValue] of entries) {
      const result = await persistDataUrlsInValue(
        entryValue,
        { folder, preferredNamePrefix },
        [...pathParts, entryKey]
      );
      updatedObject[entryKey] = result.value;
      convertedCount += result.convertedCount;
    }

    return { value: updatedObject, convertedCount };
  }

  return { value, convertedCount: 0 };
};

module.exports = {
  isDataUrl,
  persistDataUrl,
  persistMaybeDataUrl,
  persistDataUrlsInValue,
};
