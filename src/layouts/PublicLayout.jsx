import { GraduationCap } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

const publicLinks = [
  { to: "/", label: "Home" },
];

export const PublicLayout = () => {
  const { pathname } = useLocation();
  const shouldHideHeader = pathname.startsWith("/login") || pathname.startsWith("/register");

  return (
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-blue-50">
      {!shouldHideHeader ? (
        <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <Link to="/" className="flex items-center gap-2 text-emerald-900">
              <GraduationCap className="h-8 w-8 text-emerald-600" />
              <span>UAAMS</span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {publicLinks.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-emerald-100 text-emerald-800"
                        : "text-slate-700 hover:bg-slate-100"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <Link
                to="/login/student"
                className="rounded-lg px-4 py-2 text-sm text-emerald-700 transition-colors hover:bg-emerald-50"
              >
                Login
              </Link>
              <Link
                to="/register/student"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white transition-colors hover:bg-emerald-700"
              >
                Register
              </Link>
            </div>
          </div>
        </header>
      ) : null}

      <main>
        <Outlet />
      </main>
    </div>
  );
};
