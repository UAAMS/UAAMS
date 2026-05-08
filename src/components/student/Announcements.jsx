import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bell, Calendar, Download, Paperclip, School, TrendingUp } from "lucide-react";
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

  const filteredAnnouncements = useMemo(
    () =>
      announcements.filter((announcement) => {
        const matchesType = selectedType === "all" || announcement.type === selectedType;
        const needle = searchTerm.trim().toLowerCase();
        const matchesSearch =
          !needle ||
          announcement.title.toLowerCase().includes(needle) ||
          announcement.university.toLowerCase().includes(needle) ||
          announcement.content.toLowerCase().includes(needle);

        return matchesType && matchesSearch;
      }),
    [announcements, selectedType, searchTerm],
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
        <h1 className="text-slate-900 mb-2">Announcements & Updates</h1>
        <p className="text-slate-600">Stay updated with the latest university announcements (real-time updates enabled)</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
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

      <div className="grid md:grid-cols-4 gap-4">
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
              <AnnouncementCard key={announcement.id} announcement={announcement} />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ icon, label, count, color }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center mb-3`}>{icon}</div>
      <div className="text-slate-600 text-sm">{label}</div>
      <div className="text-slate-900 text-2xl">{count}</div>
    </div>
  );
}

function AnnouncementCard({ announcement }) {
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
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3 flex-1">
            <div className={`w-10 h-10 ${styles.bg} rounded-lg flex items-center justify-center ${styles.text}`}>
              {styles.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <School className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-600">{announcement.university}</span>
                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                  {announcement.category}
                </span>
              </div>
              <h3 className="text-slate-900 mb-2">{announcement.title}</h3>
              <p className={`text-slate-600 text-sm ${expanded ? "" : "line-clamp-2"}`}>
                {announcement.content}
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
          <span className="text-slate-500 text-sm whitespace-nowrap ml-4">{announcement.date}</span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((previous) => !previous)}
          className="text-emerald-600 hover:text-emerald-700 text-sm mt-2"
        >
          {expanded ? "Show Less" : "Read More"} {"->"}
        </button>
      </div>
    </div>
  );
}

export { Announcements };
