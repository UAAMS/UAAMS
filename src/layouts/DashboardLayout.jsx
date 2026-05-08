import { Bell, LogOut, Menu, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import { onDataUpdated } from "../lib/socketClient";
import "../styles/dashboard-layout.css";

const STUDENT_NOTIFICATION_KEY = "uaams_student_notifications";
const MAX_NOTIFICATIONS = 40;

const loadStudentNotifications = () => {
  try {
    const raw = localStorage.getItem(STUDENT_NOTIFICATION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
};

const saveStudentNotifications = (notifications) => {
  try {
    localStorage.setItem(STUDENT_NOTIFICATION_KEY, JSON.stringify(notifications));
  } catch {
    // ignore storage errors
  }
};

const formatStatus = (value) =>
  String(value || "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const mapStudentNotificationFromEvent = (event) => {
  const resource = String(event?.resource || "").toLowerCase();
  const action = String(event?.action || "").toLowerCase();
  const at = event?.at || new Date().toISOString();

  if (resource === "blogs") {
    return {
      id: `${resource}-${action}-${at}`,
      title: action === "created" ? "New Blog Post" : "Blog Post Updated",
      description: "A university blog post was added or updated.",
      at,
      read: false,
    };
  }

  if (resource === "announcements") {
    return {
      id: `${resource}-${action}-${at}`,
      title: action === "created" ? "New Announcement" : "Announcement Updated",
      description: "University announcements were updated.",
      at,
      read: false,
    };
  }

  if (resource === "programs") {
    return {
      id: `${resource}-${action}-${at}`,
      title: "Program Admission Updated",
      description: "Program admission status, fee, or deadline details changed.",
      at,
      read: false,
    };
  }

  if (resource === "merit-lists") {
    return {
      id: `${resource}-${action}-${at}`,
      title: "Merit List / Roll Number Updated",
      description: "A merit list or roll number update is available.",
      at,
      read: false,
    };
  }

  if (resource === "applications") {
    if (event?.letterIssued) {
      return {
        id: `${resource}-letter-${at}`,
        title: "Admission Letter Uploaded",
        description: "Your university uploaded an admission letter.",
        at,
        read: false,
      };
    }

    if (event?.status) {
      return {
        id: `${resource}-status-${at}`,
        title: "Application Status Updated",
        description: `Current status: ${formatStatus(event.status)}.`,
        at,
        read: false,
      };
    }

    return {
      id: `${resource}-${action}-${at}`,
      title: "Application Updated",
      description: "Your application record has changed.",
      at,
      read: false,
    };
  }

  return null;
};

const formatNotificationTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const DashboardLayout = ({ title, navItems, theme = "emerald" }) => {
  const [isNotificationOpen, setNotificationOpen] = useState(false);
  const [studentNotifications, setStudentNotifications] = useState([]);
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const { layout, setLayoutValue } = useUI();
  const isSidebarOpen = Boolean(layout?.dashboardSidebarOpen);

  const themeClasses = useMemo(() => {
    const palettes = {
      emerald: {
        badge: "bg-emerald-100 text-emerald-700",
        active: "bg-emerald-600 text-white",
        hover: "hover:bg-emerald-50",
        ring: "ring-emerald-100",
      },
      blue: {
        badge: "bg-blue-100 text-blue-700",
        active: "bg-blue-600 text-white",
        hover: "hover:bg-blue-50",
        ring: "ring-blue-100",
      },
      purple: {
        badge: "bg-purple-100 text-purple-700",
        active: "bg-purple-600 text-white",
        hover: "hover:bg-purple-50",
        ring: "ring-purple-100",
      },
      indigo: {
        badge: "bg-indigo-100 text-indigo-700",
        active: "bg-indigo-600 text-white",
        hover: "hover:bg-indigo-50",
        ring: "ring-indigo-100",
      },
    };

    return palettes[theme] || palettes.emerald;
  }, [theme]);

  useEffect(() => {
    if (currentUser?.role === "student") {
      setStudentNotifications(loadStudentNotifications());
      return;
    }

    setStudentNotifications([]);
    setNotificationOpen(false);
  }, [currentUser?.role]);

  useEffect(() => {
    setNotificationOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (currentUser?.role !== "student") {
      return () => {};
    }

    const unsubscribe = onDataUpdated((event) => {
      const notification = mapStudentNotificationFromEvent(event);
      if (!notification) return;

      setStudentNotifications((previous) => {
        const next = [notification, ...previous].slice(0, MAX_NOTIFICATIONS);
        saveStudentNotifications(next);
        return next;
      });
    });

    return unsubscribe;
  }, [currentUser?.role]);

  const unreadCount = useMemo(
    () => studentNotifications.filter((notification) => !notification.read).length,
    [studentNotifications],
  );

  const markAllNotificationsRead = () => {
    setStudentNotifications((previous) => {
      const next = previous.map((notification) => ({
        ...notification,
        read: true,
      }));
      saveStudentNotifications(next);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="dashboard-shell">
        <aside className={`dashboard-sidebar ${isSidebarOpen ? "open" : ""}`}>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-slate-900">UAAMS</div>
              <div className="text-sm text-slate-500">{title}</div>
            </div>
            <button
              onClick={() => setLayoutValue("dashboardSidebarOpen", false)}
              className="dashboard-close-button rounded-md p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setLayoutValue("dashboardSidebarOpen", false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? `${themeClasses.active} shadow-sm`
                        : `text-slate-700 ${themeClasses.hover}`
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <div className="dashboard-main flex min-h-screen flex-col">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setLayoutValue("dashboardSidebarOpen", true)}
                  className="dashboard-menu-button rounded-md p-2 text-slate-600 hover:bg-slate-100"
                  aria-label="Open menu"
                >
                  <Menu className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                {currentUser?.role === "student" ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setNotificationOpen((previous) => !previous)}
                      className="relative rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-100"
                      aria-label="Open notifications"
                    >
                      <Bell className="h-4 w-4" />
                      {unreadCount > 0 ? (
                        <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      ) : null}
                    </button>

                    {isNotificationOpen ? (
                      <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-sm text-slate-900">Notifications</div>
                          <button
                            type="button"
                            onClick={markAllNotificationsRead}
                            className="text-xs text-emerald-700 hover:text-emerald-800"
                          >
                            Mark all read
                          </button>
                        </div>
                        {studentNotifications.length === 0 ? (
                          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                            No notifications yet.
                          </p>
                        ) : (
                          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                            {studentNotifications.map((notification) => (
                              <article
                                key={notification.id}
                                className={`rounded-lg border px-3 py-2 ${
                                  notification.read
                                    ? "border-slate-200 bg-slate-50"
                                    : "border-emerald-200 bg-emerald-50"
                                }`}
                              >
                                <div className="text-xs text-slate-900">{notification.title}</div>
                                <p className="mt-1 text-xs text-slate-600">
                                  {notification.description}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-500">
                                  {formatNotificationTime(notification.at)}
                                </p>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div
                  className={`rounded-full px-3 py-1 text-xs ring-1 ${themeClasses.badge} ${themeClasses.ring}`}
                >
                  {currentUser?.name || "User"}
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>

      {isSidebarOpen && (
        <button
          className="dashboard-overlay"
          onClick={() => setLayoutValue("dashboardSidebarOpen", false)}
          aria-label="Close menu"
        />
      )}
    </div>
  );
};
