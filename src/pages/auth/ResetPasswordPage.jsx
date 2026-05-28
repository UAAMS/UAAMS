import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthSplitShell, authInputClass } from "../../components/shared/AuthSplitShell";
import { PasswordField } from "../../components/shared/PasswordField";
import { useAuth } from "../../context/AuthContext";
import { getPasswordChecks, getPasswordStrength, isStrongPassword } from "../../lib/validation";

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { resetPasswordWithOtp } = useAuth();
  const [searchParams] = useSearchParams();

  const email = useMemo(() => String(searchParams.get("email") || "").trim(), [searchParams]);
  const otp = useMemo(() => String(searchParams.get("otp") || "").trim(), [searchParams]);
  const role = useMemo(() => String(searchParams.get("role") || "student").trim(), [searchParams]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    if (!isStrongPassword(newPassword)) {
      setError("Password must meet all listed requirements.");
      setIsSubmitting(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      setIsSubmitting(false);
      return;
    }

    const result = await resetPasswordWithOtp({
      email,
      otp,
      newPassword,
      confirmPassword,
    });

    if (!result.ok) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    setMessage(result.message);
    setTimeout(() => {
      navigate(`/login/${role}`, { replace: true });
    }, 1000);
    setIsSubmitting(false);
  };

  if (!email || !otp) {
    return (
      <AuthSplitShell
        eyebrow="Account recovery"
        title="Set New Password"
        subtitle="The reset link is missing its verification context."
      >
          <p className="text-sm text-red-700">Missing reset context. Please verify OTP first.</p>
          <button
            type="button"
            onClick={() => navigate(`/forgot-password?role=${encodeURIComponent(role)}`, { replace: true })}
            className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 sm:w-auto"
          >
            Go to Forgot Password
          </button>
      </AuthSplitShell>
    );
  }

  return (
    <AuthSplitShell
      eyebrow="Account recovery"
      title="Set New Password"
      subtitle={`Create a new password for ${email}.`}
    >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-emerald-700">
              New Password
            </label>
            <PasswordField
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Enter new password"
              className={authInputClass}
              required
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-emerald-700">
              Confirm New Password
            </label>
            <PasswordField
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter new password"
              className={authInputClass}
              required
              autoComplete="new-password"
            />
          </div>

          <ResetPasswordStrength value={newPassword} />

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          {message ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-70"
          >
            {isSubmitting ? "Updating Password..." : "Update Password"}
          </button>
        </form>
    </AuthSplitShell>
  );
};

function ResetPasswordStrength({ value }) {
  const checks = getPasswordChecks(value);
  const strength = getPasswordStrength(value);

  return (
    <div className="rounded-lg border border-emerald-100 bg-white/65 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase text-slate-600">
        <span>Password strength</span>
        <span className="text-emerald-700">{strength.label}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${strength.className}`}
          style={{ width: `${strength.percent}%` }}
        />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
        {checks.map((rule) => (
          <div key={rule.key} className={rule.met ? "text-emerald-700" : ""}>
            {rule.label}
          </div>
        ))}
      </div>
    </div>
  );
}
