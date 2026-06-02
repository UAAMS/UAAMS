import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bell, Calendar, ChevronRight, Download, Paperclip, School, TrendingUp } from "lucide-react";
import { Avatar } from "../shared/Avatar";
import { HighlightText } from "../shared/HighlightText";
import { onDataUpdated } from "../../lib/socketClient";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { fetchStudentAnnouncements } from "../../store/slices/announcementsSlice";

function Announcements() {
  const dispatch = useAppDispatch();
  const {
    items: announcements,
    loading: isLoading,
    error,
  } = useAppSelector((state) => state.announcements);
  const [selectedType, setSelectedType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    dispatch(fetchStudentAnnouncements());
    const unsubscribe = onDataUpdated((event) => {
      if (event?.resource === "announcements") {
        dispatch(fetchStudentAnnouncements());
      }
    });

    return () => {
      unsubscribe();
    };
  }, [dispatch]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const filteredAnnouncements = useMemo(
    () =>
      announcements.filter((announcement) => {
        const visibleFrom = announcement.visibleFrom
          ? new Date(announcement.visibleFrom).getTime()
          : 0;
        const expiresAt = announcement.expiresAt
          ? new Date(announcement.expiresAt).getTime()
          : Number.POSITIVE_INFINITY;
        const isVisible =
          (Number.isNaN(visibleFrom) || visibleFrom <= now) &&
          (Number.isNaN(expiresAt) || expiresAt > now);
        const matchesType = selectedType === "all" || announcement.type === selectedType;
        const needle = searchTerm.trim().toLowerCase();
        const matchesSearch =
          !needle ||
          announcement.title.toLowerCase().includes(needle) ||
          announcement.university.toLowerCase().includes(needle) ||
          announcement.content.toLowerCase().includes(needle);

        return isVisible && matchesType && matchesSearch;
      }),
    [announcements, now, selectedType, searchTerm],
  );

  const stats = useMemo(
    () => ({
      total: announcements.length,
      deadline: announcements.filter((item) => item.type === "deadline").length,
      merit: announcements.filter((item) => item.type === "merit-list").length,
      urgent: announcements.filter((item) => item.type === "urgent").length,
    }),
    [announcements],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="uaams-page-title">Announcements & Updates</h1>
        <p className="uaams-page-description">Stay updated with the latest university announcements.</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-700 mb-2 text-sm">Filter by Type</label>
            <select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Announcements</option>
              <option value="deadline">Deadlines</option>
              <option value="merit-list">Merit Lists</option>
              <option value="urgent">Urgent</option>
              <option value="general">General</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-700 mb-2 text-sm">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search announcements..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Bell className="w-5 h-5 text-blue-600" />}
          label="Total"
          count={stats.total}
          color="bg-blue-50"
        />
        <StatCard
          icon={<Calendar className="w-5 h-5 text-amber-600" />}
          label="Deadlines"
          count={stats.deadline}
          color="bg-amber-50"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          label="Merit Lists"
          count={stats.merit}
          color="bg-emerald-50"
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5 text-red-600" />}
          label="Urgent"
          count={stats.urgent}
          color="bg-red-50"
        />
      </div>

      {isLoading ? (
        <div className="bg-white rounded-lg border border-slate-200 p-10 text-center text-sm text-slate-600">
          Loading announcements...
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {!isLoading && !error ? (
        <div className="space-y-4">
          {filteredAnnouncements.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <Bell className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-slate-900 mb-2">No Announcements Found</h3>
              <p className="text-slate-600 text-sm">Try adjusting your filters or search terms.</p>
            </div>
          ) : (
            filteredAnnouncements.map((announcement) => (
              <AnnouncementCard key={announcement.id} announcement={announcement} searchTerm={searchTerm} />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ icon, label, count, color }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>{icon}</div>
      <div className="text-slate-600 text-sm">{label}</div>
      <div className="text-slate-900 text-2xl">{count}</div>
    </div>
  );
}

function AnnouncementCard({ announcement, searchTerm }) {
  const [expanded, setExpanded] = useState(false);

  const styles = useMemo(() => {
    switch (announcement.type) {
      case "deadline":
        return {
          bg: "bg-amber-50",
          text: "text-amber-700",
          icon: <Calendar className="w-5 h-5" />,
        };
      case "merit-list":
        return {
          bg: "bg-emerald-50",
          text: "text-emerald-700",
          icon: <TrendingUp className="w-5 h-5" />,
        };
      case "urgent":
        return {
          bg: "bg-red-50",
          text: "text-red-700",
          icon: <AlertCircle className="w-5 h-5" />,
        };
      default:
        return {
          bg: "bg-blue-50",
          text: "text-blue-700",
          icon: <Bell className="w-5 h-5" />,
        };
    }
  }, [announcement.type]);

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="border-l-4 border-blue-400 p-4 sm:p-6">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-1 items-start gap-3">
            {announcement.universityLogo ? (
              <Avatar
                src={announcement.universityLogo}
                name={announcement.university}
                size="md"
                className="rounded-lg bg-white"
              />
            ) : (
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${styles.bg} ${styles.text}`}>
                {styles.icon}
              </div>
            )}
            <div className="flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-emerald-600">
                  <HighlightText text={announcement.university} query={searchTerm} />
                </span>
                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                  {announcement.category}
                </span>
              </div>
              <h3 className="text-slate-900 mb-2">
                <HighlightText text={announcement.title} query={searchTerm} />
              </h3>
              <p className={`text-slate-600 text-sm ${expanded ? "" : "line-clamp-2"}`}>
                <HighlightText text={announcement.content} query={searchTerm} />
              </p>
              {announcement.attachmentUrl ? (
                <a
                  href={announcement.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                >
                  {announcement.type === "merit-list" ? (
                    <Download className="h-3.5 w-3.5" />
                  ) : (
                    <Paperclip className="h-3.5 w-3.5" />
                  )}
                  {announcement.attachmentName || "Download Attachment"}
                </a>
              ) : null}
            </div>
          </div>
          <span className="text-sm text-slate-500 sm:ml-4 sm:whitespace-nowrap">{announcement.date}</span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((previous) => !previous)}
          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 mt-2"
        >
          {expanded ? "Show Less" : "Read More"}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </article>
  );
}

export { Announcements };
