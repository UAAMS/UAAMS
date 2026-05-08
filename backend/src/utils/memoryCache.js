const cacheStore = new Map();

const normalizeTtl = (ttlMs) => {
  const parsed = Number(ttlMs);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed;
};

const getCache = (key) => {
  const entry = cacheStore.get(String(key));
  if (!entry) return null;

  if (entry.expiresAt > 0 && entry.expiresAt <= Date.now()) {
    cacheStore.delete(String(key));
    return null;
  }

  return entry.value;
};

const setCache = (key, value, ttlMs = 0) => {
  const ttl = normalizeTtl(ttlMs);
  cacheStore.set(String(key), {
    value,
    expiresAt: ttl > 0 ? Date.now() + ttl : 0,
  });
  return value;
};

const deleteCache = (key) => {
  cacheStore.delete(String(key));
};

const invalidateCachePrefix = (prefix) => {
  const normalizedPrefix = String(prefix || "");
  if (!normalizedPrefix) return;

  for (const key of cacheStore.keys()) {
    if (key.startsWith(normalizedPrefix)) {
      cacheStore.delete(key);
    }
  }
};

const clearCache = () => {
  cacheStore.clear();
};

module.exports = {
  getCache,
  setCache,
  deleteCache,
  invalidateCachePrefix,
  clearCache,
};
