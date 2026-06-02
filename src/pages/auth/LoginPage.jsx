import { useEffect, useMemo, useState } from "react";
import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AuthSplitShell, authInputClass } from "../../components/shared/AuthSplitShell";
import { PasswordField } from "../../components/shared/PasswordField";
import { useAuth } from "../../context/AuthContext";
import { emailPattern, isValidEmail } from "../../lib/validation";
import { resolveRolePath, roleLabelMap } from "../../utils/rolePaths";

const roleOptions = ["student", "university", "blogger", "admin"];
const selfRegisterRoles = new Set(["student", "university"]);

export const LoginPage = () => {
  const { role: roleParam } = useParams();
  const role = roleOptions.includes(roleParam) ? roleParam : "student";

  const location = useLocation();
  const navigate = useNavigate();
  const { login, currentUser } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fromLocation = useMemo(
    () => location.state?.from?.pathname,
    [location.state],
  );

  useEffect(() => {
    if (currentUser?.role) {
      navigate(resolveRolePath(currentUser.role), { replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    if (!roleOptions.includes(roleParam || "")) {
      navigate("/login/student", { replace: true });
    }
  }, [navigate, roleParam]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (role !== "blogger" && !isValidEmail(identifier)) {
      setMessage("Enter a valid email address.");
      return;
    }
    setIsSubmitting(true);

    const result = await login({ identifier, password, role, rememberMe });

    if (!result.ok) {
      setMessage(result.message);
      setIsSubmitting(false);
      return;
    }

    setMessage("");
    const destination = fromLocation || resolveRolePath(result.user.role);
    navigate(destination, { replace: true });
    setIsSubmitting(false);
  };

  return (
    <AuthSplitShell
      eyebrow="Portal access"
      title={`${roleLabelMap[role]} Login`}
      subtitle={`Sign in with your UAAMS ${roleLabelMap[role].toLowerCase()} account.`}
      footer={
        selfRegisterRoles.has(role) ? (
          <p>
            Don&apos;t have an account?{" "}
            <Link to={`/register/${role}`} className="font-semibold text-emerald-700 hover:text-emerald-800">
              Create one
            </Link>
          </p>
        ) : (
          <p>
            {role === "blogger"
              ? "Blogger accounts are created by university representatives."
              : "Admin accounts are created by the system owner."}
          </p>
        )
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
        <div>
          <label className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-emerald-700">
            {role === "blogger" ? <UserRound className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            {role === "blogger" ? "Email or Username" : "Email"}
          </label>
          <input
            type={role === "blogger" ? "text" : "email"}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder={role === "blogger" ? "campus_writer" : "you@example.com"}
            pattern={role === "blogger" ? undefined : emailPattern.source}
            title={role === "blogger" ? undefined : "Enter a valid email address."}
            className={authInputClass}
            required
          />
        </div>

        <div>
          <label className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-emerald-700">
            <LockKeyhole className="h-4 w-4" />
            Password
          </label>
          <PasswordField
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            className={authInputClass}
            toggleClassName="text-emerald-600 hover:text-emerald-700"
            required
            autoComplete="current-password"
          />
        </div>

        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 rounded border-emerald-100 accent-emerald-600"
            />
            Remember me
          </label>
          <Link
            to={`/forgot-password?role=${encodeURIComponent(role)}`}
            className="w-fit text-emerald-700 hover:text-emerald-800"
          >
            Forgot password?
          </Link>
        </div>

        {message ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold uppercase text-white transition-colors hover:bg-emerald-700 disabled:opacity-70"
        >
          {isSubmitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </AuthSplitShell>
  );
};
