const env = require("../config/env");
const {
  getCache: getMemoryCache,
  setCache: setMemoryCache,
  deleteCache: deleteMemoryCache,
  invalidateCachePrefix: invalidateMemoryCachePrefix,
  clearCache: clearMemoryCache,
} = require("./memoryCache");

let Redis = null;
try {
  // eslint-disable-next-line global-require
  Redis = require("ioredis");
} catch {
  Redis = null;
}

const isRedisConfigured = Boolean(Redis && env.redisUrl && env.redisEnabled);
let redisClient = null;
let hasLoggedRedisIssue = false;

const normalizeTtl = (ttlMs) => {
  const parsed = Number(ttlMs);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.floor(parsed);
};

const buildRedisKey = (key) => `${String(env.redisPrefix || "")}${String(key || "")}`;

const getRedisClient = () => {
  if (!isRedisConfigured) {
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  const options = {
    lazyConnect: false,
    enableAutoPipelining: true,
    maxRetriesPerRequest: 1,
  };

  if (env.redisTls) {
    options.tls = {};
  }

  if (env.redisConnectionTimeoutMs > 0) {
    options.connectTimeout = env.redisConnectionTimeoutMs;
  }

  redisClient = new Redis(env.redisUrl, options);

  redisClient.on("error", (error) => {
    if (hasLoggedRedisIssue && env.nodeEnv === "production") {
      return;
    }

    hasLoggedRedisIssue = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[cache] Redis command failed. Falling back to in-memory cache.",
      error?.message || error
    );
  });

  redisClient.on("ready", () => {
    hasLoggedRedisIssue = false;
  });

  return redisClient;
};

const withRedis = async (operation, fallbackValue = null) => {
  const client = getRedisClient();
  if (!client) {
    return fallbackValue;
  }

  try {
    return await operation(client);
  } catch (error) {
    if (!hasLoggedRedisIssue || env.nodeEnv !== "production") {
      hasLoggedRedisIssue = true;
      // eslint-disable-next-line no-console
      console.warn(
        "[cache] Redis command failed. Falling back to in-memory cache.",
        error?.message || error
      );
    }
    return fallbackValue;
  }
};

const safeParseJson = (rawValue) => {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
};

const getCache = async (key) => {
  const memoryValue = getMemoryCache(key);
  if (memoryValue !== null && memoryValue !== undefined) {
    return memoryValue;
  }

  const rawValue = await withRedis((client) => client.get(buildRedisKey(key)), null);
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const parsedValue = safeParseJson(rawValue);
  if (parsedValue === null || parsedValue === undefined) {
    return null;
  }

  setMemoryCache(key, parsedValue, env.apiCacheTtlMs);
  return parsedValue;
};

const setCache = async (key, value, ttlMs = 0) => {
  const ttl = normalizeTtl(ttlMs);
  setMemoryCache(key, value, ttl);

  await withRedis(async (client) => {
    const serialized = JSON.stringify(value);
    if (ttl > 0) {
      await client.set(buildRedisKey(key), serialized, "PX", ttl);
      return;
    }
    await client.set(buildRedisKey(key), serialized);
  });

  return value;
};

const deleteCache = (key) => {
  deleteMemoryCache(key);
  void withRedis((client) => client.del(buildRedisKey(key)));
};

const deleteRedisByPattern = async (client, pattern) => {
  let cursor = "0";
  do {
    const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
    if (Array.isArray(keys) && keys.length > 0) {
      await client.del(...keys);
    }
    cursor = String(nextCursor || "0");
  } while (cursor !== "0");
};

const invalidateCachePrefix = (prefix) => {
  const normalizedPrefix = String(prefix || "");
  if (!normalizedPrefix) {
    return;
  }

  invalidateMemoryCachePrefix(normalizedPrefix);
  const redisPattern = `${String(env.redisPrefix || "")}${normalizedPrefix}*`;

  void withRedis((client) => deleteRedisByPattern(client, redisPattern));
};

const clearCache = () => {
  clearMemoryCache();
  const redisPattern = `${String(env.redisPrefix || "")}*`;
  void withRedis((client) => deleteRedisByPattern(client, redisPattern));
};

module.exports = {
  getCache,
  setCache,
  deleteCache,
  invalidateCachePrefix,
  clearCache,
};
