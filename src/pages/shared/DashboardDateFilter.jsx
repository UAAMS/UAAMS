import { RotateCcw } from "lucide-react";
import {
  DASHBOARD_PERIOD_OPTIONS,
  defaultDashboardDateFilter,
  isDateFilterActive,
} from "./dashboardAnalytics";

const focusRingByTheme = {
  emerald: "focus:ring-emerald-500",
  blue: "focus:ring-blue-500",
  indigo: "focus:ring-indigo-500",
  purple: "focus:ring-purple-500",
};

export function DashboardDateFilter({ value, onChange, theme = "emerald" }) {
  const filter = { ...defaultDashboardDateFilter, ...(value || {}) };
  const focusRing = focusRingByTheme[theme] || focusRingByTheme.emerald;
  const hasRange = isDateFilterActive(filter);

  const updateFilter = (updates) => {
    onChange?.({ ...filter, ...updates });
  };

  const resetRange = () => {
    updateFilter({ from: "", to: "" });
  };

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            State Period
          </span>
          <select
            value={filter.period}
            onChange={(event) => updateFilter({ period: event.target.value })}
            className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 ${focusRing}`}
          >
            {DASHBOARD_PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            From Date
          </span>
          <input
            type="date"
            value={filter.from}
            onChange={(event) => updateFilter({ from: event.target.value })}
            className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 ${focusRing}`}
          />
        </label>

        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            To Date
          </span>
          <input
            type="date"
            value={filter.to}
            min={filter.from || undefined}
            onChange={(event) => updateFilter({ to: event.target.value })}
            className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 ${focusRing}`}
          />
        </label>

        <button
          type="button"
          onClick={resetRange}
          disabled={!hasRange}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
          title="Reset date range"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      </div>
    </section>
  );
}
