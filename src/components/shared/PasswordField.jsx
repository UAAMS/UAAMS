import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export const PasswordField = ({
  value,
  onChange,
  placeholder = "",
  className = "",
  required = false,
  disabled = false,
  name,
  id,
  autoComplete,
  toggleClassName = "text-slate-500 hover:text-slate-700",
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${className} pr-10`}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShowPassword((previous) => !previous)}
        className={`absolute inset-y-0 right-0 inline-flex items-center px-3 ${toggleClassName}`}
        tabIndex={-1}
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};
