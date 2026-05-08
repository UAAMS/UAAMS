import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardPageShell } from "../shared/DashboardPageShell";
import { MetricGrid } from "../shared/MetricGrid";
import { onDataUpdated } from "../../lib/socketClient";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchStudentApplications } from "../../store/slices/applicationsSlice";
import { fetchStudentDashboard } from "../../store/slices/dashboardsSlice";

const formatMonth = (value) =>
  new Date(value).toLocaleString("en-US", { month: "short", year: "2-digit" });

export const StudentOverviewPage = () => {
  const dispatch = useAppDispatch();
  const { items: applications, loading: applicationsLoading, error: applicationsError } = useAppSelector(
    (state) => state.applications.student,
  );
  const {
    data: dashboardData,
    loading: dashboardLoading,
    error: dashboardError,
  } = useAppSelector((state) => state.dashboards.student);
  const recommendationsCount = Number(dashboardData?.metrics?.recommendationsCount || 0);
  const announcementsCount = Number(dashboardData?.metrics?.announcementsCount || 0);
  const profileCompletion = Number(dashboardData?.metrics?.profileCompletion || 0);
  const [activeMetricLabel, setActiveMetricLabel] = useState("");
  const isLoading =
    (applicationsLoading || dashboardLoading) && applications.length === 0 && !dashboardData;
  const error = applicationsError || dashboardError;

  useEffect(() => {
    dispatch(fetchStudentApplications());
    dispatch(fetchStudentDashboard());
    const unsubscribe = onDataUpdated((event) => {
      if (["applications", "announcements", "merit-lists", "programs"].includes(event?.resource)) {
        dispatch(fetchStudentApplications());
        dispatch(fetchStudentDashboard());
      }
    });
    return () => unsubscribe();
  }, [dispatch]);

  const metrics = useMemo(() => {
    const inProgress = applications.filter((item) =>
      ["pending", "under-review"].includes(item.status),
    ).length;
    const accepted = applications.filter((item) =>
      ["accepted", "assigned", "finalized"].includes(item.status),
    ).length;

    return [
      {
        label: "Applications Submitted",
        value: String(applications.length).padStart(2, "0"),
        trend: `${inProgress} in review`,
      },
      {
        label: "Offers / Assigned",
        value: String(accepted).padStart(2, "0"),
        trend: "Accepted or roll-number assigned",
      },
      {
        label: "Recommendations",
        value: String(recommendationsCount),
        trend: "Based on profile match",
      },
      {
        label: "Profile Completion",
        value: `${profileCompletion}%`,
        trend: `${announcementsCount} announcements available`,
      },
    ];
  }, [applications, announcementsCount, profileCompletion, recommendationsCount]);

  useEffect(() => {
    if (metrics.length > 0 && !metrics.some((item) => item.label === activeMetricLabel)) {
      setActiveMetricLabel(metrics[0].label);
    }
  }, [metrics, activeMetricLabel]);

  const statusChartData = useMemo(() => {
    const statusMap = new Map([
      ["not-submitted", 0],
      ["pending", 0],
      ["under-review", 0],
      ["accepted", 0],
      ["rejected", 0],
      ["assigned", 0],
      ["finalized", 0],
    ]);

    applications.forEach((item) => {
      statusMap.set(item.status, (statusMap.get(item.status) || 0) + 1);
    });

    return Array.from(statusMap.entries()).map(([status, count]) => ({
      status: status.replace("-", " "),
      count,
    }));
  }, [applications]);

  const timelineData = useMemo(() => {
    const map = new Map();
    applications.forEach((item) => {
      const date = new Date(item.createdAt || item.appliedAt || Date.now());
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const current = map.get(key) || { month: formatMonth(date), submissions: 0 };
      map.set(key, { ...current, submissions: current.submissions + 1 });
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([, value]) => value);
  }, [applications]);

  const selectedMetricChartData = useMemo(() => {
    const inProgress = applications.filter((item) =>
      ["pending", "under-review"].includes(item.status),
    ).length;
    const accepted = applications.filter((item) =>
      ["accepted", "assigned", "finalized"].includes(item.status),
    ).length;
    const rejected = applications.filter((item) => item.status === "rejected").length;

    switch (activeMetricLabel) {
      case "Applications Submitted":
        return statusChartData.map((item) => ({
          state: item.status,
          value: item.count,
        }));
      case "Offers / Assigned":
        return [
          { state: "Accepted/Assigned", value: accepted },
          { state: "In Review", value: inProgress },
          { state: "Rejected", value: rejected },
        ];
      case "Recommendations":
        return [
          { state: "Recommendations", value: recommendationsCount },
          { state: "Applications", value: applications.length },
        ];
      case "Profile Completion":
        return [
          { state: "Completed", value: profileCompletion },
          { state: "Remaining", value: Math.max(0, 100 - profileCompletion) },
        ];
      default:
        return [];
    }
  }, [activeMetricLabel, applications, profileCompletion, recommendationsCount, statusChartData]);

  return (
    <DashboardPageShell
      title="Student Command Center"
      subtitle="One dashboard to manage profile completion, applications, deadlines, and merit insights."
    >
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          Loading dashboard metrics...
        </div>
      ) : (
        <MetricGrid
          metrics={metrics}
          activeMetricLabel={activeMetricLabel}
          onMetricClick={(metric) => setActiveMetricLabel(metric.label)}
        />
      )}

      {!isLoading && selectedMetricChartData.length > 0 ? (
        <article className="uaams-chart-card rounded-xl p-5">
          <h2 className="font-display text-lg text-slate-900">{activeMetricLabel} State Graph</h2>
          <p className="mb-4 text-xs text-slate-500">Click a metric card to switch this graph.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={selectedMetricChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="state" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <article className="uaams-chart-card rounded-xl p-5">
          <h2 className="font-display text-lg text-slate-900">Application Status (Realtime)</h2>
          <p className="mb-4 text-xs text-slate-500">Auto-refreshes when status changes.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="uaams-chart-card rounded-xl p-5">
          <h2 className="font-display text-lg text-slate-900">Submission Timeline</h2>
          <p className="mb-4 text-xs text-slate-500">Monthly application draft/submission activity.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="studentSubmissions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="submissions"
                  stroke="#22c55e"
                  fill="url(#studentSubmissions)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      
    </DashboardPageShell>
  );
};
