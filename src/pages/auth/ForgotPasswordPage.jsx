import { useState } from "react";
import { Mail } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthSplitShell, authInputClass } from "../../components/shared/AuthSplitShell";
import { useAuth } from "../../context/AuthContext";
import { emailPattern, isValidEmail } from "../../lib/validation";

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { requestPasswordResetOtp } = useAuth();
  const role = String(searchParams.get("role") || "student").trim() || "student";

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    if (!isValidEmail(email)) {
      setError("Enter a valid registered email address.");
      setIsSubmitting(false);
      return;
    }

    const result = await requestPasswordResetOtp(email);
    if (!result.ok) {
      setError(result.message || "We could not send the reset code right now. Please try again.");
      setIsSubmitting(false);
      return;
    }

    navigate(
      `/forgot-password/verify?email=${encodeURIComponent(email.trim())}&role=${encodeURIComponent(role)}`,
      {
        replace: true,
      },
    );
    setIsSubmitting(false);
  };

  return (
    <AuthSplitShell
      eyebrow="Account recovery"
      title="Forgot Password"
      subtitle="Enter your registered email and we will send a reset code if the account exists."
    >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-emerald-700">
              <Mail className="h-4 w-4" />
              Registered Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              pattern={emailPattern.source}
              title="Enter a valid registered email address."
              className={authInputClass}
              required
            />
          </div>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-70"
          >
            {isSubmitting ? "Sending OTP..." : "Send OTP"}
          </button>
          <Link to={`/login/${role}`} className="w-full rounded-lg text-emerald-600 px-4 py-3 text-sm font-semibold  transition-colors hover:underline hover:underline-offset-6 disabled:opacity-70 text-center border border-emerald-600">
            Back to login
          </Link>
        </form>
    </AuthSplitShell>
  );
};
