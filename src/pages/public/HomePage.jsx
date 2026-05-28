import { ArrowRight, Building2, GraduationCap, PenSquare, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const roleCards = [
  {
    title: "Student Portal",
    description: "Discover universities, complete your profile, and track applications from one place.",
    icon: GraduationCap,
    color: "bg-emerald-50 text-emerald-700",
    to: "/login/student",
  },
  {
    title: "University Portal",
    description: "Manage form builder, applications, merit lists, and official announcements.",
    icon: Building2,
    color: "bg-blue-50 text-blue-700",
    to: "/login/university",
  },
  {
    title: "Blogger Portal",
    description: "Publish trusted admission content and improve campus visibility.",
    icon: PenSquare,
    color: "bg-orange-50 text-orange-700",
    to: "/login/blogger",
  },
  {
    title: "Admin Portal",
    description: "Approve institutions, monitor workflows, and secure platform operations.",
    icon: ShieldCheck,
    color: "bg-indigo-50 text-indigo-700",
    to: "/login/admin",
  },
];

export const HomePage = () => {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-emerald-100 bg-white p-8 shadow-sm lg:p-12">
        <div className="inline-flex w-fit items-center gap-3 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase text-emerald-700">
          <GraduationCap className="h-4 w-4" />
          UAAMS Portal
        </div>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl lg:text-5xl">
          University Admission Management System with Role-Based Workflows
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
          A modern multi-role React frontend built with JSX, React Router, protected routing,
          and dashboard-first UX for students, universities, bloggers, and admins.
        </p>

      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {roleCards.map((roleCard) => {
          const Icon = roleCard.icon;

          return (
            <article
              key={roleCard.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
            <Link
                to={roleCard.to}
                className="block h-full rounded-lg transition-shadow"
              >
              <div className={`mb-4 inline-flex rounded-lg p-3 gap-4 ${roleCard.color}`}>
                <Icon className="h-5 w-5" />
              <h2 className={`text-sm font-semibold ${roleCard.color}`}>{roleCard.title}</h2>
              </div>
              <p className="mt-2 text-sm text-slate-600">{roleCard.description}</p>
              </Link>
            </article>
          );
        })}
      </section>
    </div>
  );
};
