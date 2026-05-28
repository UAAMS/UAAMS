import { UserRound } from "lucide-react";

const getInitials = (name = "") => {
  const words = String(name || "User")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word.charAt(0).toUpperCase());
  return initials.join("") || "U";
};

export function Avatar({
  src = "",
  name = "User",
  size = "md",
  className = "",
  imageClassName = "",
}) {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
    xl: "h-24 w-24 text-xl",
  };

  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 font-semibold text-slate-600 ring-1 ring-slate-200 ${
        sizeClasses[size] || sizeClasses.md
      } ${className}`}
      title={name}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          className={`h-full w-full object-cover ${imageClassName}`}
        />
      ) : name ? (
        <span>{getInitials(name)}</span>
      ) : (
        <UserRound className="h-1/2 w-1/2" />
      )}
    </div>
  );
}
