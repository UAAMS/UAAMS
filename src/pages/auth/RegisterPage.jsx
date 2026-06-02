import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AuthSplitShell, authInputClass } from "../../components/shared/AuthSplitShell";
import { PasswordField } from "../../components/shared/PasswordField";
import { useAuth } from "../../context/AuthContext";
import {
  alphabeticNameInputPattern,
  emailPattern,
  getPasswordChecks,
  getPasswordStrength,
  isNumberInRange,
  isStrongPassword,
  isValidEmail,
  isValidName,
  isValidPhone,
  sanitizeAlphabeticNameInput,
} from "../../lib/validation";
import { roleLabelMap } from "../../utils/rolePaths";

const roleOptions = ["student", "university", "blogger", "admin"];

const defaultForm = {
  name: "",
  representativeName: "",
  email: "",
  username: "",
  password: "",
  confirmPassword: "",
  phone: "",
  location: "",
  website: "",
  establishedYear: "",
  studentCount: "",
  programsOffered: "",
};

export const RegisterPage = () => {
  const { role: roleParam } = useParams();
  const role = roleOptions.includes(roleParam) ? roleParam : "student";

  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState(defaultForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isUniversity = useMemo(() => role === "university", [role]);
  const isSelfRegistrationAllowed = role === "student" || role === "university";

  useEffect(() => {
    if (!roleOptions.includes(roleParam || "")) {
      navigate("/register/student", { replace: true });
    }
  }, [navigate, roleParam]);

  const updateField = (field, value) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
    setFieldErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const validateRegistration = () => {
    const nextErrors = {};

    if (isUniversity) {
      if (formData.name.trim().length < 3) {
        nextErrors.name = "Enter a valid university name.";
      }
      if (!isValidName(formData.representativeName)) {
        nextErrors.representativeName = "Use alphabetic letters and spaces only.";
      }
      if (!isValidPhone(formData.phone)) {
        nextErrors.phone = "Enter a valid Pakistani mobile number, for example +92-300-1234567.";
      }
      if (formData.location.trim().length < 2) {
        nextErrors.location = "Enter the university city or location.";
      }
      if (!isNumberInRange(formData.establishedYear, 1800, new Date().getFullYear())) {
        nextErrors.establishedYear = "Enter a valid established year.";
      }
      if (!isNumberInRange(formData.studentCount, 1, 1000000)) {
        nextErrors.studentCount = "Enter a valid student count.";
      }
    } else if (!isValidName(formData.name)) {
      nextErrors.name = "Use alphabetic letters and spaces only.";
    }

    if (!isValidEmail(formData.email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!isStrongPassword(formData.password)) {
      nextErrors.password = "Password must meet all listed requirements.";
    }

    if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setFieldErrors({});
    setIsSubmitting(true);

    const validationErrors = validateRegistration();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError("Please correct the highlighted fields.");
      setIsSubmitting(false);
      return;
    }

    const result = await register({ ...formData, role });

    if (!result.ok) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    setMessage(result.message);

    if (result?.data?.verificationRequired) {
      navigate(
        `/verify-email/pending?email=${encodeURIComponent(
          result?.data?.email || formData.email,
        )}&role=${encodeURIComponent(result?.data?.role || role)}`,
      );
      setIsSubmitting(false);
      return;
    }

    setTimeout(() => {
      navigate(`/login/${role}`);
    }, 1000);
    setIsSubmitting(false);
  };

  return (
    <AuthSplitShell
      eyebrow="Create account"
      title={`${roleLabelMap[role]} Registration`}
      subtitle={`Create your UAAMS ${roleLabelMap[role].toLowerCase()} portal account.`}
      panelSize="wide"
      footer={
        <p>
          Already have an account?{" "}
          <Link to={`/login/${role}`} className="font-semibold text-emerald-700 hover:text-emerald-800">
            Sign in
          </Link>
        </p>
      }
    >
      <div>
        {!isSelfRegistrationAllowed ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {role === "blogger"
              ? "Blogger accounts are created by university representatives from their dashboard."
              : "Admin registration is restricted and managed by system owner."}
            <div className="mt-3">
              <Link to={`/login/${role}`} className="font-semibold text-amber-900 underline">
                Go to {roleLabelMap[role]} Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <AuthField
                icon={isUniversity ? <Building2 className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                label={isUniversity ? "University Name" : "Full Name"}
                value={formData.name}
                onChange={(value) => updateField("name", value)}
                placeholder={isUniversity ? "Enter university name" : "Enter your full name"}
                error={fieldErrors.name}
                alphaOnly={!isUniversity}
                required
              />

              <AuthField
                icon={<Mail className="h-4 w-4" />}
                label="Email"
                type="email"
                value={formData.email}
                onChange={(value) => updateField("email", value)}
                placeholder="your.email@example.com"
                error={fieldErrors.email}
                required
              />
            </div>

            {isUniversity ? (
              <>
                <SectionLabel>University Representative</SectionLabel>
                <div className="grid gap-4 md:grid-cols-2">
                  <AuthField
                    icon={<UserRound className="h-4 w-4" />}
                    label="Representative Name"
                    value={formData.representativeName}
                    onChange={(value) => updateField("representativeName", value)}
                    placeholder="Enter representative's full name"
                    error={fieldErrors.representativeName}
                    alphaOnly
                    required
                  />
                  <AuthField
                    icon={<Phone className="h-4 w-4" />}
                    label="Phone"
                    value={formData.phone}
                    onChange={(value) => updateField("phone", value)}
                    placeholder="+92-300-1234567"
                    error={fieldErrors.phone}
                    required
                  />
                  <AuthField
                    icon={<Building2 className="h-4 w-4" />}
                    label="Location"
                    value={formData.location}
                    onChange={(value) => updateField("location", value)}
                    placeholder="City, Province"
                    error={fieldErrors.location}
                    required
                  />
                </div>

                <SectionLabel>University Profile</SectionLabel>
                <div className="grid gap-4 md:grid-cols-3">
                  <AuthField
                    label="Website"
                    type="url"
                    value={formData.website}
                    onChange={(value) => updateField("website", value)}
                    placeholder="https://www.university.edu"
                  />
                  <AuthField
                    label="Established Year"
                    type="number"
                    value={formData.establishedYear}
                    onChange={(value) => updateField("establishedYear", value)}
                    placeholder="e.g., 1990"
                    error={fieldErrors.establishedYear}
                    required
                  />
                  <AuthField
                    label="Students"
                    type="number"
                    value={formData.studentCount}
                    onChange={(value) => updateField("studentCount", value)}
                    placeholder="e.g., 5000"
                    error={fieldErrors.studentCount}
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-emerald-700">
                    Programs Offered
                  </label>
                  <textarea
                    rows={3}
                    value={formData.programsOffered}
                    onChange={(event) => updateField("programsOffered", event.target.value)}
                    placeholder="List programs offered"
                    className={`${authInputClass} min-h-24 resize-y`}
                    required
                  />
                </div>
              </>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-emerald-700">
                  <LockKeyhole className="h-4 w-4" />
                  Password
                </label>
                <PasswordField
                  value={formData.password}
                  onChange={(event) => updateField("password", event.target.value)}
                  placeholder="Create a strong password"
                  className={authInputClass}
                  toggleClassName="text-emerald-600 hover:text-emerald-700"
                  required
                  autoComplete="new-password"
                />

              </div>
              <div>
                <label className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-emerald-700">
                  <LockKeyhole className="h-4 w-4" />
                  Confirm Password
                </label>
                <PasswordField
                  value={formData.confirmPassword}
                  onChange={(event) => updateField("confirmPassword", event.target.value)}
                  placeholder="Re-enter your password"
                  className={authInputClass}
                  toggleClassName="text-emerald-600 hover:text-emerald-700"
                  required
                  autoComplete="new-password"
                />
                {fieldErrors.confirmPassword ? (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p>
                ) : null}
              </div>
            </div>

            <PasswordStrength value={formData.password} />

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            {message ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-100 px-3 py-2 text-sm text-emerald-700">
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold uppercase text-white transition-colors hover:bg-emerald-700 disabled:opacity-70"
            >
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </button>
          </form>
        )}
      </div>
    </AuthSplitShell>
  );
};

function AuthField({
  icon = null,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  error = "",
  alphaOnly = false,
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-emerald-700">
        {icon}
        <span className="min-w-0 break-words">{label}</span>
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(alphaOnly ? sanitizeAlphabeticNameInput(event.target.value) : event.target.value)
        }
        placeholder={placeholder}
        pattern={type === "email" ? emailPattern.source : alphaOnly ? alphabeticNameInputPattern.source : undefined}
        title={
          type === "email"
            ? "Enter a valid email address."
            : alphaOnly
              ? "Use alphabetic letters and spaces only."
              : undefined
        }
        className={authInputClass}
        required={required}
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function PasswordStrength({ value }) {
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
          <div
            key={rule.key}
            className={rule.met ? "flex items-center gap-2 text-emerald-700" : "flex items-center gap-2"}
          >
            <CheckCircle2 className={`h-3.5 w-3.5 ${rule.met ? "text-emerald-600" : "text-slate-300"}`} />
            {rule.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="border-t border-emerald-100 pt-5">
      <p className="text-xs font-semibold uppercase text-emerald-700">{children}</p>
    </div>
  );
}
