export const DASHBOARD_PERIOD_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export const defaultDashboardDateFilter = {
  period: "monthly",
  from: "",
  to: "",
};

const pad = (value) => String(value).padStart(2, "0");

export const normalizeDashboardPeriod = (period) =>
  DASHBOARD_PERIOD_OPTIONS.some((item) => item.value === period) ? period : "monthly";

export const isDateFilterActive = (filter = {}) =>
  Boolean(String(filter.from || "").trim() || String(filter.to || "").trim());

export const parseFilterDate = (value, { endOfDay = false } = {}) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
};

const getDateFromItem = (item, dateFields = ["createdAt"]) => {
  for (const field of dateFields) {
    const value = typeof field === "function" ? field(item) : item?.[field];
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
};

export const filterItemsByDate = (items = [], filter = {}, dateFields = ["createdAt"]) => {
  const start = parseFilterDate(filter.from);
  const end = parseFilterDate(filter.to, { endOfDay: true });

  if (!start && !end) {
    return items;
  }

  return items.filter((item) => {
    const date = getDateFromItem(item, dateFields);
    if (!date) return false;
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  });
};

const getBucketStart = (date, period) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (period === "monthly") {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }
  if (period === "weekly") {
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
  }
  return start;
};

const getBucketKey = (date, period) => {
  const start = getBucketStart(date, period);
  if (period === "monthly") {
    return `${start.getFullYear()}-${pad(start.getMonth() + 1)}`;
  }
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
};

const formatBucketLabel = (date, period) => {
  const start = getBucketStart(date, period);
  if (period === "daily") {
    return start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (period === "weekly") {
    return `Week of ${start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`;
  }
  return start.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

export const buildTimeSeries = ({
  items = [],
  filter = {},
  dateFields = ["createdAt"],
  valueKey = "count",
  labelKey = "period",
}) => {
  const period = normalizeDashboardPeriod(filter.period);
  const map = new Map();

  items.forEach((item) => {
    const date = getDateFromItem(item, dateFields);
    if (!date) return;
    const key = getBucketKey(date, period);
    const current = map.get(key) || {
      key,
      [labelKey]: formatBucketLabel(date, period),
      [valueKey]: 0,
    };
    map.set(key, {
      ...current,
      [valueKey]: Number(current[valueKey] || 0) + 1,
    });
  });

  return Array.from(map.values()).sort((a, b) => String(a.key).localeCompare(String(b.key)));
};

export const formatStatusLabel = (value) =>
  String(value || "unknown")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const countByStatuses = ({ items = [], statuses = [], getStatus = (item) => item?.status }) =>
  statuses.map((status) => ({
    name: formatStatusLabel(status),
    value: items.filter((item) => String(getStatus(item) || "") === status).length,
  }));
