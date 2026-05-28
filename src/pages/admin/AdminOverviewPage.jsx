import { useEffect, useMemo, useState } from "react";
import {
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
import { defaultDashboardDateFilter } from "../shared/dashboardAnalytics";
import { onDataUpdated } from "../../lib/socketClient";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchAdminDashboard } from "../../store/slices/dashboardsSlice";

const applicationPieColors = ["#f59e0b", "#22c55e", "#ef4444"];

export const AdminOverviewPage = () => {
  const dispatch = useAppDispatch();
  const {
    data: stats,
    loading: dashboardLoading,
    error,
  } = useAppSelector((state) => state.dashboards.admin);
  const [activeMetricLabel, setActiveMetricLabel] = useState("");
  const [dateFilter, setDateFilter] = useState(defaultDashboardDateFilter);
  const isLoading = dashboardLoading && !stats;

  useEffect(() => {
    dispatch(fetchAdminDashboard(dateFilter));
    const unsubscribe = onDataUpdated((event) => {
      if (
        ["applications", "announcements", "blogs", "bloggers", "programs", "universities"].includes(
          event?.resource,
        )
      ) {
        dispatch(fetchAdminDashboard(dateFilter));
      }
    });
    return () => unsubscribe();
  }, [dateFilter, dispatch]);

  const metrics = useMemo(() => {
    if (!stats) {
      return [];
    }

    return [
      {
        label: "Pending University Approvals",
        value: String(stats.universities?.pendingApprovals || 0).padStart(2, "0"),
        trend: `${stats.universities?.total || 0} total universities`,
      },
      {
        label: "Active Students",
        value: Number(stats.users?.students || 0).toLocaleString(),
        trend: `${Number(stats.users?.bloggers || 0).toLocaleString()} bloggers`,
      },
      {
        label: "Applications in Review",
        value: Number(stats.applications?.inReview || 0).toLocaleString(),
        trend: `${Number(stats.applications?.total || 0).toLocaleString()} total applications`,
      },
      {
        label: "Published Content",
        value: Number(
          (stats.content?.blogPosts || 0) + (stats.content?.announcements || 0),
        ).toLocaleString(),
        trend: `${stats.content?.announcements || 0} announcements live`,
      },
    ];
  }, [stats]);

  useEffect(() => {
    if (metrics.length > 0 && !metrics.some((item) => item.label === activeMetricLabel)) {
      setActiveMetricLabel(metrics[0].label);
    }
  }, [metrics, activeMetricLabel]);

  const applicationChart = useMemo(
    () => [
      { name: "In Review", value: Number(stats?.applications?.inReview || 0) },
      { name: "Accepted", value: Number(stats?.applications?.accepted || 0) },
      { name: "Rejected", value: Number(stats?.applications?.rejected || 0) },
    ],
    [stats],
  );

  const activityTimeline = useMemo(
    () => (Array.isArray(stats?.timeline?.activity) ? stats.timeline.activity : []),
    [stats?.timeline?.activity],
  );

  const userChart = useMemo(
    () => [
      { name: "Students", count: Number(stats?.users?.students || 0) },
      { name: "Bloggers", count: Number(stats?.users?.bloggers || 0) },
      { name: "Universities", count: Number(stats?.universities?.total || 0) },
    ],
    [stats],
  );

  const selectedMetricChartData = useMemo(() => {
    switch (activeMetricLabel) {
      case "Pending University Approvals":
        return [
          { state: "Pending", value: Number(stats?.universities?.pendingApprovals || 0) },
          { state: "Approved", value: Number(stats?.universities?.approved || 0) },
          { state: "Rejected", value: Number(stats?.universities?.rejected || 0) },
        ];
      case "Active Students":
        return [
          { state: "Students", value: Number(stats?.users?.students || 0) },
          { state: "Bloggers", value: Number(stats?.users?.bloggers || 0) },
          { state: "Universities", value: Number(stats?.universities?.total || 0) },
        ];
      case "Applications in Review":
        return [
          { state: "In Review", value: Number(stats?.applications?.inReview || 0) },
          { state: "Accepted", value: Number(stats?.applications?.accepted || 0) },
          { state: "Rejected", value: Number(stats?.applications?.rejected || 0) },
        ];
      case "Published Content":
        return [
          { state: "Blog Posts", value: Number(stats?.content?.blogPosts || 0) },
          { state: "Announcements", value: Number(stats?.content?.announcements || 0) },
        ];
      default:
        return [];
    }
  }, [activeMetricLabel, stats]);

  return (
    <DashboardPageShell
      title="System Administration"
      subtitle="Centralized governance for approvals, user management, and platform operations."
    >
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <DashboardDateFilter value={dateFilter} onChange={setDateFilter} theme="indigo" />

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          Loading admin metrics...
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
          <h3 className="font-display mb-2 text-slate-900">{activeMetricLabel} State Graph</h3>
          <p className="mb-4 text-xs text-slate-500">Click a metric card to switch this graph.</p>
          <div className="uaams-chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={selectedMetricChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="state" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      ) : null}

      {!isLoading && stats ? (
        <>
          <div className="grid gap-6 xl:grid-cols-3">
            <article className="uaams-chart-card rounded-xl p-4 sm:p-5">
              <h3 className="font-display mb-4 text-slate-900">Application Decisions</h3>
              <div className="uaams-chart-frame uaams-chart-frame--tall">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={applicationChart}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius="70%"
                      label={false}
                    >
                      {applicationChart.map((item, index) => (
                        <Cell
                          key={`${item.name}-${index}`}
                          fill={applicationPieColors[index % applicationPieColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="uaams-chart-card rounded-xl p-4 sm:p-5">
              <h3 className="font-display mb-4 text-slate-900">User Distribution</h3>
              <div className="uaams-chart-frame uaams-chart-frame--tall">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={userChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="uaams-chart-card rounded-xl p-4 sm:p-5">
              <h3 className="font-display mb-4 text-slate-900">Platform State</h3>
              <div className="uaams-chart-frame uaams-chart-frame--tall">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityTimeline} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="applications" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="students" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="blogs" fill="#f97316" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <StatPanel
              title="Universities"
              rows={[
                { label: "Total", value: stats.universities?.total || 0 },
                { label: "Pending", value: stats.universities?.pendingApprovals || 0 },
                { label: "Approved", value: stats.universities?.approved || 0 },
                { label: "Rejected", value: stats.universities?.rejected || 0 },
              ]}
            />
            <StatPanel
              title="Applications"
              rows={[
                { label: "Total", value: stats.applications?.total || 0 },
                { label: "In Review", value: stats.applications?.inReview || 0 },
                { label: "Accepted", value: stats.applications?.accepted || 0 },
                { label: "Rejected", value: stats.applications?.rejected || 0 },
              ]}
            />
            <StatPanel
              title="Content"
              rows={[
                { label: "Blog Posts", value: stats.content?.blogPosts || 0 },
                { label: "Announcements", value: stats.content?.announcements || 0 },
                { label: "Students", value: stats.users?.students || 0 },
                { label: "Bloggers", value: stats.users?.bloggers || 0 },
              ]}
            />
          </div>
        </>
      ) : null}
    </DashboardPageShell>
  );
};

function StatPanel({ title, rows }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-display mb-4 text-slate-900">{title}</h3>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <span className="text-slate-600">{row.label}</span>
            <span className="text-slate-900">{Number(row.value || 0).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
