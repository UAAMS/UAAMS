import { Bell, LogOut, Menu, X, GraduationCap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Avatar } from "../components/shared/Avatar";
import { ConfirmDialog } from "../components/shared/ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import { onDataUpdated } from "../lib/socketClient";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { fetchAdminProfile } from "../store/slices/adminAccountSlice";
import { fetchBloggerProfile } from "../store/slices/bloggerAccountSlice";
import { fetchStudentProfile } from "../store/slices/studentProfileSlice";
import { fetchUniversitySettings } from "../store/slices/universityAccountSlice";
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
  const dispatch = useAppDispatch();
  const [isNotificationOpen, setNotificationOpen] = useState(false);
  const [studentNotifications, setStudentNotifications] = useState([]);
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const adminProfileState = useAppSelector((state) => state.adminAccount);
  const studentProfileState = useAppSelector((state) => state.studentProfile);
  const universitySettingsState = useAppSelector((state) => state.universityAccount.settings);
  const bloggerProfileState = useAppSelector((state) => state.bloggerAccount);
  // mobile drawer state (desktop sidebar remains persistent)
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [hasRequestedUniversitySettings, setHasRequestedUniversitySettings] = useState(false);

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

  const brandClasses = useMemo(() => {
    const map = {
      emerald: { text: "text-emerald-700", circleBg: "bg-emerald-600" },
      blue: { text: "text-blue-700", circleBg: "bg-blue-600" },
      purple: { text: "text-purple-700", circleBg: "bg-purple-600" },
      indigo: { text: "text-indigo-700", circleBg: "bg-indigo-600" },
    };

    return map[theme] || map.emerald;
  }, [theme]);

  useEffect(() => {
    if (currentUser?.role === "student") {
      setStudentNotifications(loadStudentNotifications());
      setHasRequestedUniversitySettings(false);
      if (!studentProfileState.loaded && !studentProfileState.loading) {
        dispatch(fetchStudentProfile());
      }
      return;
    }

    if (currentUser?.role === "university" && !hasRequestedUniversitySettings) {
      setHasRequestedUniversitySettings(true);
      dispatch(fetchUniversitySettings());
    }

    if (currentUser?.role !== "university" && hasRequestedUniversitySettings) {
      setHasRequestedUniversitySettings(false);
    }

    if (
      currentUser?.role === "blogger" &&
      !bloggerProfileState.profileLoaded &&
      !bloggerProfileState.profileLoading
    ) {
      dispatch(fetchBloggerProfile());
    }

    if (currentUser?.role === "admin" && !adminProfileState.loaded && !adminProfileState.loading) {
      dispatch(fetchAdminProfile());
    }

    setStudentNotifications([]);
    setNotificationOpen(false);
  }, [
    adminProfileState.loaded,
    adminProfileState.loading,
    bloggerProfileState.profileLoaded,
    bloggerProfileState.profileLoading,
    currentUser?.role,
    dispatch,
    hasRequestedUniversitySettings,
    studentProfileState.loaded,
    studentProfileState.loading,
  ]);

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

  const [isLogoutDialogOpen, setLogoutDialogOpen] = useState(false);

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

  const markNotificationRead = (notificationId) => {
    setStudentNotifications((previous) => {
      const next = previous.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification,
      );
      saveStudentNotifications(next);
      return next;
    });
  };

  const clearNotification = (notificationId) => {
    setStudentNotifications((previous) => {
      const next = previous.filter((notification) => notification.id !== notificationId);
      saveStudentNotifications(next);
      return next;
    });
  };

  const headerProfileImage = useMemo(() => {
    if (currentUser?.role === "student") {
      return studentProfileState.profile?.profilePicture || currentUser?.profilePicture || "";
    }

    if (currentUser?.role === "university") {
      return (
        universitySettingsState.data?.representativeProfilePicture ||
        currentUser?.representativeProfilePicture ||
        universitySettingsState.data?.logo ||
        currentUser?.logo ||
        currentUser?.profilePicture ||
        ""
      );
    }

    if (currentUser?.role === "blogger") {
      return bloggerProfileState.profile?.profilePicture || currentUser?.profilePicture || "";
    }

    if (currentUser?.role === "admin") {
      return adminProfileState.profile?.profilePicture || currentUser?.profilePicture || "";
    }

    return currentUser?.profilePicture || "";
  }, [
    adminProfileState.profile?.profilePicture,
    bloggerProfileState.profile?.profilePicture,
    currentUser,
    studentProfileState.profile?.profilePicture,
    universitySettingsState.data?.logo,
    universitySettingsState.data?.representativeProfilePicture,
  ]);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="dashboard-shell">
        <aside className={`dashboard-sidebar ${isMobileSidebarOpen ? "open-mobile" : ""}`}>
          <div className="flex min-h-full flex-col">
            <div className="mb-6 flex flex-col  justify-between">
              <div className="flex-1 flex flex-col items-start">
                <div to="/" className={`inline-flex items-center gap-3 text-xs font-semibold uppercase ${brandClasses.text} transition-colors`}>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${brandClasses.circleBg} text-white`}>
                    <GraduationCap className="h-7 w-7" />
                  </div>
                  <p className={`text-lg font-semibold uppercase sidebar-label ${brandClasses.text}`}>UAAMS</p>
                </div>
              </div>
            <div className="flex-1 flex flex-col items-center">

                            <div className={`mt-3 text-md text-center sidebar-label ${brandClasses.text} font-semibold`}>{title}</div>
            </div>
                          {/* Mobile close control */}
                          <div className="lg:hidden mt-2">
                            <button
                              onClick={() => setMobileSidebarOpen(false)}
                              className="dashboard-close-button rounded-md p-2 text-slate-500 hover:bg-slate-100"
                              aria-label="Close menu"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
              
            </div>

            <nav className="flex-1 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={({ isActive }) => {
                      const isCustomActive = item.activePaths?.some((path) =>
                        location.pathname.startsWith(path),
                      );

                      return `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        isActive || isCustomActive
                          ? `${themeClasses.active} shadow-sm`
                          : `text-slate-700 ${themeClasses.hover}`
                      }`;
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="sidebar-label">{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-6 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setLogoutDialogOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-red-600 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                <span className="sidebar-label">Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile open button */}
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="dashboard-open-button lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="dashboard-main flex min-h-screen flex-col">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur-sm sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileSidebarOpen(true)}
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
                                onClick={() => markNotificationRead(notification.id)}
                                className={`rounded-lg border px-3 py-2 ${
                                  notification.read
                                    ? "border-slate-200 bg-slate-50"
                                    : "cursor-pointer border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      markNotificationRead(notification.id);
                                    }}
                                    className="flex-1 text-left"
                                  >
                                    <span className="block text-xs text-slate-900">
                                      {notification.title}
                                    </span>
                                    <span className="mt-1 block text-xs text-slate-600">
                                      {notification.description}
                                    </span>
                                    <span className="mt-1 block text-[11px] text-slate-500">
                                      {formatNotificationTime(notification.at)}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      clearNotification(notification.id);
                                    }}
                                    className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-red-600"
                                    aria-label={`Clear ${notification.title}`}
                                    title="Clear notification"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div
                  className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs ring-1 ${themeClasses.badge} ${themeClasses.ring}`}
                >
                  <Avatar
                    src={headerProfileImage}
                    name={currentUser?.name || "User"}
                    size="sm"
                    className="bg-white/80"
                  />
                  {currentUser?.name || "User"}
                </div>
                
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>

      {isMobileSidebarOpen && (
        <button
          className="dashboard-overlay"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close menu"
        />
      )}

      <ConfirmDialog
        open={isLogoutDialogOpen}
        title="Log out?"
        description="Your current session will close and you will return to the login page."
        confirmLabel="Log out"
        tone="danger"
        onConfirm={logout}
        onCancel={() => setLogoutDialogOpen(false)}
      />
    </div>
  );
};
