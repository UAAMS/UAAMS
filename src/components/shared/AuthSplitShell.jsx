import { ArrowLeft, BookOpen, CheckCircle2, GraduationCap, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import authStudyBackground from "../../assets/auth-study-background.jpg";

const authHeroStyle = {
  backgroundImage: `linear-gradient(90deg, rgba(236,253,245,0.68), rgba(255,255,255,0.16)), url(${authStudyBackground})`,
};

export const authInputClass =
  "w-full rounded-lg border border-emerald-100 bg-white/70 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100";

export const AuthSplitShell = ({
  title,
  subtitle,
  eyebrow,
  children,
  footer,
  panelSize = "default",
}) => {
  const panelClass = panelSize === "wide" ? "max-w-3xl" : "max-w-md";

  return (
    <div className="relative min-h-screen overflow-hidden bg-cover bg-center pl-30" style={authHeroStyle}>
      <div className="absolute inset-0 bg-emerald-950/10" />
      <div className="relative z-10 grid  min-h-screen gap-6 px-4 sm:px-8 lg:grid-cols-[minmax(360px,0.95fr)_1.05fr] lg:px-12">
        <section className="flex min-h-screen  items-center">
          <div
            className={`w-full ${panelClass} h-screen  border border-white/70 bg-white/80 p-6 text-slate-900 shadow-2xl ring-1 ring-emerald-100 backdrop-blur-md sm:p-8`}
          >
            <Link
              to="/"
              className="mb-8 inline-flex items-center gap-2 text-xs font-semibold uppercase text-emerald-700 transition-colors hover:text-emerald-900"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-700 text-emerald-700">
                <GraduationCap className="h-8 w-8" />
              </div>
              <p className="text-lg font-semibold uppercase text-emerald-700">UAAMS</p>
            </Link>

            <div className="mb-7 border-b border-emerald-100 pb-5">

              <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
              <p className="mt-2 max-w-md text-sm text-slate-600">{subtitle}</p>
            </div>

            {children}

            {footer ? <div className="mt-6 text-sm text-slate-600">{footer}</div> : null}
          </div>
        </section>

        <aside className="hidden items-start justify-end pt-16 text-right lg:flex">
          <div className="max-w-xl rounded-2xl border border-white/60 bg-white/45 p-8 text-slate-900 shadow-xl ring-1 ring-emerald-100 backdrop-blur-sm">
            <p className="text-sm font-semibold uppercase text-emerald-700">University Admissions</p>
            <h2 className="mt-4 text-5xl font-bold leading-tight text-emerald-600">
              APPLY SMARTER
              <span className="block text-slate-900">AT YOUR OWN PACE</span>
            </h2>
            <div className="ml-auto mt-8 h-0.5 w-full max-w-lg bg-emerald-600" />
            <div className="ml-auto mt-6 max-w-lg space-y-3 text-base text-slate-800">
              <p className="font-semibold text-slate-900">What is in store for you:</p>
              <p>Personalized program recommendations</p>
              <p>Online application and document submission</p>
              <p>Real-time updates from universities</p>
            </div>

            <div className="ml-auto mt-10 grid max-w-lg gap-3 text-left sm:grid-cols-2">
              <FeaturePill icon={<ShieldCheck className="h-4 w-4" />} text="Secure portals" />
              <FeaturePill icon={<BookOpen className="h-4 w-4" />} text="Program discovery" />
              <FeaturePill icon={<CheckCircle2 className="h-4 w-4" />} text="Application tracking" />
              <FeaturePill icon={<GraduationCap className="h-4 w-4" />} text="University managed" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

function FeaturePill({ icon, text }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white/80 px-3 py-2 text-sm text-slate-800 shadow-sm backdrop-blur-sm">
      <span className="text-emerald-600">{icon}</span>
      {text}
    </div>
  );
}
