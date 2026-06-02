import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthSplitShell } from "../../components/shared/AuthSplitShell";
import { roleLabelMap } from "../../utils/rolePaths";

const validRoles = new Set(["student", "university", "blogger", "admin"]);

export const VerifyEmailPendingPage = () => {
  const [searchParams] = useSearchParams();
  const email = useMemo(() => String(searchParams.get("email") || "").trim(), [searchParams]);
  const roleParam = useMemo(() => String(searchParams.get("role") || "").trim(), [searchParams]);
  const role = validRoles.has(roleParam) ? roleParam : "student";

  return (
    <AuthSplitShell
      eyebrow="Email verification"
      title="Verify Your Email"
      subtitle="Complete registration from the verification link sent to your email."
      footer={
        <Link to={`/register/${role}`} className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-70">
          Back to Registration
        </Link>
      }
    >
        <p className="mt-2 text-sm text-slate-600">
          We sent a verification link to:
        </p>
        <p className="mt-1 break-words rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-900">
          {email || "your registered email"}
        </p>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Click the verification link in your email to complete registration.
        </div>

    </AuthSplitShell>
  );
};
