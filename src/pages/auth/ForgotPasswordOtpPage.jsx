import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthSplitShell, authInputClass } from "../../components/shared/AuthSplitShell";
import { useAuth } from "../../context/AuthContext";

export const ForgotPasswordOtpPage = () => {
  const navigate = useNavigate();
  const { verifyPasswordResetOtp, requestPasswordResetOtp } = useAuth();
  const [searchParams] = useSearchParams();

  const email = useMemo(() => String(searchParams.get("email") || "").trim(), [searchParams]);
  const role = useMemo(() => String(searchParams.get("role") || "student").trim(), [searchParams]);

  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleVerify = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Enter the 6-digit OTP sent to your email.");
      setIsSubmitting(false);
      return;
    }

    const result = await verifyPasswordResetOtp({ email, otp });
    if (!result.ok) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    navigate(
      `/forgot-password/reset?email=${encodeURIComponent(email)}&otp=${encodeURIComponent(
        otp.trim(),
      )}&role=${encodeURIComponent(role)}`,
      { replace: true },
    );
    setIsSubmitting(false);
  };

  const handleResend = async () => {
    setError("");
    setMessage("");
    setIsResending(true);
    const result = await requestPasswordResetOtp(email);
    if (!result.ok) {
      setError("We could not send a new code right now. Please try again.");
      setIsResending(false);
      return;
    }
    setMessage(result.message);
    setIsResending(false);
  };

  if (!email) {
    return (
      <AuthSplitShell
        eyebrow="Account recovery"
        title="Verify OTP"
        subtitle="The reset link is missing an email address."
      >
          <p className="text-sm text-red-700">Missing email. Please start from forgot password page.</p>
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
      title="Verify OTP"
      subtitle={`Enter the reset code sent to ${email}.`}
      footer={
        <Link to={`/login/${role}`} className="font-semibold text-emerald-700 hover:text-emerald-800">
          Back to login
        </Link>
      }
    >
        <form onSubmit={handleVerify} className="space-y-5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-emerald-700">Enter OTP</label>
            <input
              type="text"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit OTP"
              className={authInputClass}
              required
            />
          </div>

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
            {isSubmitting ? "Verifying..." : "Verify OTP"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleResend}
          disabled={isResending}
          className="mt-3 text-sm font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-70"
        >
          {isResending ? "Resending OTP..." : "Resend OTP"}
        </button>
    </AuthSplitShell>
  );
};
