import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useNavigate } from "react-router-dom";
import { DashboardDateFilter } from "../../pages/shared/DashboardDateFilter";
import { DashboardPageShell } from "../../pages/shared/DashboardPageShell";
import { MetricGrid } from "../../pages/shared/MetricGrid";
import {
  buildTimeSeries,
  defaultDashboardDateFilter,
  filterItemsByDate,
} from "../../pages/shared/dashboardAnalytics";
import { onDataUpdated } from "../../lib/socketClient";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchBloggerDashboard } from "../../store/slices/dashboardsSlice";
import { fetchBloggerPosts } from "../../store/slices/bloggerPostsSlice";

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const postStatusColors = ["#22c55e", "#f97316"];

function BloggerDashboard() {
  const dispatch = useAppDispatch();
  const {
    data: dashboardData,
    loading: dashboardLoading,
    error: dashboardError,
  } = useAppSelector((state) => state.dashboards.blogger);
  const {
    items: posts,
    loading: postsLoading,
    error: postsError,
    mutationError,
  } = useAppSelector((state) => state.bloggerPosts);

  const managedUniversity = dashboardData?.managedUniversity || null;
  const isLoading = (dashboardLoading || postsLoading) && !dashboardData && posts.length === 0;
  const error = mutationError || postsError || dashboardError;
  const [activeMetricLabel, setActiveMetricLabel] = useState("");
  const [dateFilter, setDateFilter] = useState(defaultDashboardDateFilter);
  const navigate = useNavigate();

  const loadData = useCallback(
    async () => {
      await Promise.all([
        dispatch(fetchBloggerDashboard()).unwrap(),
        dispatch(fetchBloggerPosts()).unwrap(),
      ]);
    },
    [dispatch],
  );

  useEffect(() => {
    loadData().catch(() => {
      // Errors are surfaced from Redux state.
    });
    const unsubscribe = onDataUpdated((event) => {
      if (event?.resource === "blogs" || event?.resource === "blog-interactions") {
        loadData().catch(() => {
          // Errors are surfaced from Redux state.
        });
      }
    });
    return () => unsubscribe();
  }, [loadData]);

  const filteredPosts = useMemo(
    () => filterItemsByDate(posts, dateFilter, ["publishedAt", "createdAt", "updatedAt"]),
    [dateFilter, posts],
  );

  const filteredMetrics = useMemo(
    () => ({
      totalPosts: filteredPosts.length,
      publishedPosts: filteredPosts.filter((post) => post.status === "published").length,
      draftPosts: filteredPosts.filter((post) => post.status === "draft").length,
      totalViews: filteredPosts.reduce((sum, post) => sum + Number(post.views || 0), 0),
      totalPostLikes: filteredPosts.reduce((sum, post) => sum + Number(post.likesCount || 0), 0),
      totalComments: filteredPosts.reduce((sum, post) => sum + Number(post.commentsCount || 0), 0),
      totalReplies: filteredPosts.reduce((sum, post) => sum + Number(post.repliesCount || 0), 0),
    }),
    [filteredPosts],
  );

  const dashboardMetrics = useMemo(
    () => [
      { label: "Total Posts", value: String(filteredMetrics.totalPosts || 0), trend: "All drafts and published posts" },
      { label: "Published", value: String(filteredMetrics.publishedPosts || 0), trend: "Visible to students" },
      { label: "Drafts", value: String(filteredMetrics.draftPosts || 0), trend: "Pending final publish" },
      {
        label: "Total Views",
        value: Number(filteredMetrics.totalViews || 0).toLocaleString(),
        trend: managedUniversity?.name ? `For ${managedUniversity.name}` : "Across your content",
      },
      {
        label: "Post Likes",
        value: Number(filteredMetrics.totalPostLikes || 0).toLocaleString(),
        trend: "Student likes on your posts",
      },
      {
        label: "Comments",
        value: Number(filteredMetrics.totalComments || 0).toLocaleString(),
        trend: "Top-level discussion threads",
      },
      {
        label: "Replies",
        value: Number(filteredMetrics.totalReplies || 0).toLocaleString(),
        trend: "Replies inside discussions",
      },
    ],
    [filteredMetrics, managedUniversity?.name],
  );

  useEffect(() => {
    if (
      dashboardMetrics.length > 0 &&
      !dashboardMetrics.some((item) => item.label === activeMetricLabel)
    ) {
      setActiveMetricLabel(dashboardMetrics[0].label);
    }
  }, [dashboardMetrics, activeMetricLabel]);

  const statusChartData = useMemo(
    () => [
      { status: "Published", count: Number(filteredMetrics.publishedPosts || 0), value: Number(filteredMetrics.publishedPosts || 0) },
      { status: "Draft", count: Number(filteredMetrics.draftPosts || 0), value: Number(filteredMetrics.draftPosts || 0) },
    ],
    [filteredMetrics.draftPosts, filteredMetrics.publishedPosts],
  );

  const monthlyPosts = useMemo(
    () =>
      buildTimeSeries({
        items: filteredPosts,
        filter: dateFilter,
        dateFields: ["publishedAt", "createdAt", "updatedAt"],
        labelKey: "period",
        valueKey: "posts",
      }),
    [dateFilter, filteredPosts],
  );

  const selectedMetricChartData = useMemo(() => {
    switch (activeMetricLabel) {
      case "Total Posts":
        return [
          { state: "Published", value: Number(filteredMetrics.publishedPosts || 0) },
          { state: "Drafts", value: Number(filteredMetrics.draftPosts || 0) },
        ];
      case "Published":
        return [
          { state: "Published", value: Number(filteredMetrics.publishedPosts || 0) },
          { state: "Unpublished", value: Math.max(0, Number(filteredMetrics.totalPosts || 0) - Number(filteredMetrics.publishedPosts || 0)) },
        ];
      case "Drafts":
        return [
          { state: "Drafts", value: Number(filteredMetrics.draftPosts || 0) },
          { state: "Published", value: Number(filteredMetrics.publishedPosts || 0) },
        ];
      case "Total Views":
        return filteredPosts.slice(0, 8).map((item) => ({
          state: item.title.slice(0, 18) || "Post",
          value: Number(item.views || 0),
        }));
      case "Post Likes":
        return filteredPosts.slice(0, 8).map((item) => ({
          state: item.title.slice(0, 18) || "Post",
          value: Number(item.likesCount || 0),
        }));
      case "Comments":
        return filteredPosts.slice(0, 8).map((item) => ({
          state: item.title.slice(0, 18) || "Post",
          value: Number(item.commentsCount || 0),
        }));
      case "Replies":
        return filteredPosts.slice(0, 8).map((item) => ({
          state: item.title.slice(0, 18) || "Post",
          value: Number(item.repliesCount || 0),
        }));
      default:
        return [];
    }
  }, [activeMetricLabel, filteredMetrics, filteredPosts]);

  return (
    <DashboardPageShell
      title="Blogger Dashboard"
      subtitle={
        managedUniversity?.name
          ? `Writing for ${managedUniversity.name}`
          : "Manage your university blog posts and audience growth."
      }
    >
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <DashboardDateFilter value={dateFilter} onChange={setDateFilter} theme="blue" />

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Loading dashboard...
        </div>
      ) : (
        <MetricGrid
          metrics={dashboardMetrics}
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
                <Bar dataKey="value" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <article className="uaams-chart-card rounded-xl p-4 sm:p-5">
          <h3 className="font-display mb-4 text-slate-900">Post Status Pie</h3>
          <div className="uaams-chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChartData}
                  dataKey="value"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius="70%"
                  label={false}
                >
                  {statusChartData.map((item, index) => (
                    <Cell
                      key={`${item.status}-${index}`}
                      fill={postStatusColors[index % postStatusColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="uaams-chart-card rounded-xl p-4 sm:p-5">
          <h3 className="font-display mb-4 text-slate-900">Publishing Timeline</h3>
          <div className="uaams-chart-frame">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyPosts} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="blogPostsArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="posts"
                  stroke="#0ea5e9"
                  fill="url(#blogPostsArea)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

    </DashboardPageShell>
  );
}

export { BloggerDashboard };
