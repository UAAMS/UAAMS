import { Bell } from "lucide-react";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

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

export const PageUserHeader = ({ notifications = [], themeClasses = {} }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [isNotificationOpen, setNotificationOpen] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const handleProfileClick = () => {
    if (currentUser?.role === "student") {
      navigate("/student/profile");
    } else if (currentUser?.role === "university") {
      navigate("/university/profile");
    } else if (currentUser?.role === "blogger") {
      navigate("/blogger/profile");
    } else if (currentUser?.role === "admin") {
      navigate("/admin/profile");
    }
  };

  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="cursor-pointer hover:opacity-70 transition-opacity" onClick={handleProfileClick}>
        <h1 className="text-2xl font-bold text-slate-900">{currentUser?.name || "User"}</h1>
        <p className={`text-sm ${themeClasses.text || "text-slate-600"}`}>
          {currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : "User"}
        </p>
      </div>

      {notifications.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotificationOpen((previous) => !previous)}
            className="relative rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-100"
            aria-label="Open notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>

          {isNotificationOpen ? (
            <div className="absolute right-0 z-50 mt-2 w-screen max-w-[90vw] sm:w-80 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm text-slate-900">Notifications</div>
              </div>
              {notifications.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">No notifications yet.</p>
              ) : (
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`rounded-lg border px-3 py-2 ${
                        notification.read
                          ? "border-slate-200 bg-slate-50"
                          : "border-emerald-200 bg-emerald-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-xs text-slate-900 font-semibold">{notification.title}</div>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{notification.description}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{formatNotificationTime(notification.at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
