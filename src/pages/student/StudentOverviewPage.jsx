import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardDateFilter } from "../shared/DashboardDateFilter";
import { DashboardPageShell } from "../shared/DashboardPageShell";
import { MetricGrid } from "../shared/MetricGrid";
import {
  buildTimeSeries,
  countByStatuses,
  defaultDashboardDateFilter,
  filterItemsByDate,
} from "../shared/dashboardAnalytics";
import { onDataUpdated } from "../../lib/socketClient";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchStudentApplications } from "../../store/slices/applicationsSlice";
import { fetchStudentDashboard } from "../../store/slices/dashboardsSlice";

const applicationStatusColors = [
  "#64748b",
  "#0ea5e9",
  "#f59e0b",
  "#22c55e",
  "#ef4444",
  "#6366f1",
  "#16a34a",
];

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
  const [dateFilter, setDateFilter] = useState(defaultDashboardDateFilter);
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

  const filteredApplications = useMemo(
    () => filterItemsByDate(applications, dateFilter, ["createdAt", "appliedAt"]),
    [applications, dateFilter],
  );

  const metrics = useMemo(() => {
    const inProgress = filteredApplications.filter((item) =>
      ["pending", "under-review"].includes(item.status),
    ).length;
    const accepted = filteredApplications.filter((item) =>
      ["accepted", "assigned", "finalized"].includes(item.status),
    ).length;

    return [
      {
        label: "Applications Submitted",
        value: String(filteredApplications.length).padStart(2, "0"),
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
  }, [announcementsCount, filteredApplications, profileCompletion, recommendationsCount]);

  useEffect(() => {
    if (metrics.length > 0 && !metrics.some((item) => item.label === activeMetricLabel)) {
      setActiveMetricLabel(metrics[0].label);
    }
  }, [metrics, activeMetricLabel]);

  const statusChartData = useMemo(() => {
    const statuses = [
      "not-submitted",
      "pending",
      "under-review",
      "accepted",
      "rejected",
      "assigned",
      "finalized",
    ];
    return countByStatuses({ items: filteredApplications, statuses }).map((item) => ({
      status: item.name,
      count: item.value,
      name: item.name,
      value: item.value,
    }));
  }, [filteredApplications]);

  const timelineData = useMemo(
    () =>
      buildTimeSeries({
        items: filteredApplications,
        filter: dateFilter,
        dateFields: ["createdAt", "appliedAt"],
        labelKey: "period",
        valueKey: "submissions",
      }),
    [dateFilter, filteredApplications],
  );

  const selectedMetricChartData = useMemo(() => {
    const inProgress = filteredApplications.filter((item) =>
      ["pending", "under-review"].includes(item.status),
    ).length;
    const accepted = filteredApplications.filter((item) =>
      ["accepted", "assigned", "finalized"].includes(item.status),
    ).length;
    const rejected = filteredApplications.filter((item) => item.status === "rejected").length;

    switch (activeMetricLabel) {
      case "Applications Submitted":
        return statusChartData.map((item) => ({
          state: item.status,
          value: item.value,
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
          { state: "Applications", value: filteredApplications.length },
        ];
      case "Profile Completion":
        return [
          { state: "Completed", value: profileCompletion },
          { state: "Remaining", value: Math.max(0, 100 - profileCompletion) },
        ];
      default:
        return [];
    }
  }, [
    activeMetricLabel,
    filteredApplications,
    profileCompletion,
    recommendationsCount,
    statusChartData,
  ]);

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

      <DashboardDateFilter value={dateFilter} onChange={setDateFilter} theme="emerald" />

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
        <article className="uaams-chart-card rounded-xl p-4 sm:p-5">
          <h2 className="font-display text-lg text-slate-900">{activeMetricLabel} State Graph</h2>
          <p className="mb-4 text-xs text-slate-500">Click a metric card to switch this graph.</p>
          <div className="uaams-chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={selectedMetricChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="state" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <article className="uaams-chart-card rounded-xl p-4 sm:p-5">
          <h2 className="font-display text-lg text-slate-900">Application Status Pie</h2>
          <div className="uaams-chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius="70%"
                  label={false}
                >
                  {statusChartData.map((item, index) => (
                    <Cell
                      key={`${item.name}-${index}`}
                      fill={applicationStatusColors[index % applicationStatusColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="uaams-chart-card rounded-xl p-4 sm:p-5">
          <h2 className="font-display text-lg text-slate-900">Submission State</h2>
          <div className="uaams-chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="studentSubmissions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
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
