import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { PasswordField } from "../shared/PasswordField";
import { DashboardPageShell } from "../../pages/shared/DashboardPageShell";
import { isStrongPassword } from "../../lib/validation";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  changeBloggerPassword,
  clearBloggerPasswordMessages,
} from "../../store/slices/bloggerAccountSlice";

const initialPasswordState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function BloggerPasswordSettings() {
  const dispatch = useAppDispatch();
  const {
    changingPassword: isSaving,
    passwordError: error,
    passwordMessage: message,
  } = useAppSelector((state) => state.bloggerAccount);

  const [passwordData, setPasswordData] = useState(initialPasswordState);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    dispatch(clearBloggerPasswordMessages());
    return () => {
      dispatch(clearBloggerPasswordMessages());
    };
  }, [dispatch]);

  const handleChange = (field, value) => {
    setPasswordData((previous) => ({ ...previous, [field]: value }));
    if (error || message) {
      dispatch(clearBloggerPasswordMessages());
    }
    setLocalError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    dispatch(clearBloggerPasswordMessages());
    setLocalError("");

    if (!isStrongPassword(passwordData.newPassword)) {
      setLocalError(
        "New password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
      );
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setLocalError("New password and confirmation do not match.");
      return;
    }

    try {
      await dispatch(changeBloggerPassword(passwordData)).unwrap();
      setPasswordData(initialPasswordState);
    } catch {}
  };

  return (
    <DashboardPageShell
      title="Change Password"
      subtitle="Update your blogger account password."
    >
      <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-slate-700">Current Password</label>
            <PasswordField
              value={passwordData.currentPassword}
              onChange={(event) => handleChange("currentPassword", event.target.value)}
              placeholder="Enter current password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-700">New Password</label>
            <PasswordField
              value={passwordData.newPassword}
              onChange={(event) => handleChange("newPassword", event.target.value)}
              placeholder="Enter new password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-700">Confirm New Password</label>
            <PasswordField
              value={passwordData.confirmPassword}
              onChange={(event) => handleChange("confirmPassword", event.target.value)}
              placeholder="Re-enter new password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
              autoComplete="new-password"
            />
          </div>

          {localError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {localError}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-70"
          >
            <KeyRound className="h-4 w-4" />
            {isSaving ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </DashboardPageShell>
  );
}

export { BloggerPasswordSettings };
