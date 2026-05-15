import { useEffect, useMemo, useState } from "react";
import { Building2, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AuthSplitShell, authInputClass } from "../../components/shared/AuthSplitShell";
import { PasswordField } from "../../components/shared/PasswordField";
import { useAuth } from "../../context/AuthContext";
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
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSubmitting(true);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
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
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <AuthField
                icon={isUniversity ? <Building2 className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                label={isUniversity ? "University Name" : "Full Name"}
                value={formData.name}
                onChange={(value) => updateField("name", value)}
                placeholder={isUniversity ? "Enter university name" : "Enter your full name"}
                required
              />

              <AuthField
                icon={<Mail className="h-4 w-4" />}
                label="Email"
                type="email"
                value={formData.email}
                onChange={(value) => updateField("email", value)}
                placeholder="your.email@example.com"
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
                    required
                  />
                  <AuthField
                    icon={<Phone className="h-4 w-4" />}
                    label="Phone"
                    value={formData.phone}
                    onChange={(value) => updateField("phone", value)}
                    placeholder="+92-300-1234567"
                    required
                  />
                  <AuthField
                    icon={<Building2 className="h-4 w-4" />}
                    label="Location"
                    value={formData.location}
                    onChange={(value) => updateField("location", value)}
                    placeholder="City, Province"
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
                    required
                  />
                  <AuthField
                    label="Students"
                    type="number"
                    value={formData.studentCount}
                    onChange={(value) => updateField("studentCount", value)}
                    placeholder="e.g., 5000"
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
                    className={`${authInputClass} min-h-24 resize-y rounded-none`}
                    required
                  />
                </div>
              </>
            ) : null}

            <SectionLabel>Security</SectionLabel>
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
              </div>
            </div>

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
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-emerald-700">
        {icon}
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={authInputClass}
        required={required}
      />
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
