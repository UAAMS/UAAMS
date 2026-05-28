import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { PublicLayout } from "../layouts/PublicLayout";
import { resolveRolePath } from "../utils/rolePaths";
import { ProtectedRoute } from "./ProtectedRoute";
import { RoleRoute } from "./RoleRoute";
import { adminNavItems, adminRoutePages } from "./adminRoutes";
import { bloggerNavItems, bloggerRoutePages } from "./bloggerRoutes";
import { studentNavItems, studentRoutePages } from "./studentRoutes";
import { universityNavItems, universityRoutePages } from "./universityRoutes";

const lazyNamed = (loader, exportName) =>
  lazy(() => loader().then((module) => ({ default: module[exportName] })));

const ForgotPasswordOtpPage = lazyNamed(
  () => import("../pages/auth/ForgotPasswordOtpPage"),
  "ForgotPasswordOtpPage",
);
const ForgotPasswordPage = lazyNamed(() => import("../pages/auth/ForgotPasswordPage"), "ForgotPasswordPage");
const LoginPage = lazyNamed(() => import("../pages/auth/LoginPage"), "LoginPage");
const RegisterPage = lazyNamed(() => import("../pages/auth/RegisterPage"), "RegisterPage");
const ResetPasswordPage = lazyNamed(() => import("../pages/auth/ResetPasswordPage"), "ResetPasswordPage");
const VerifyEmailPage = lazyNamed(() => import("../pages/auth/VerifyEmailPage"), "VerifyEmailPage");
const VerifyEmailPendingPage = lazyNamed(
  () => import("../pages/auth/VerifyEmailPendingPage"),
  "VerifyEmailPendingPage",
);
const HomePage = lazyNamed(() => import("../pages/public/HomePage"), "HomePage");
const NotFoundPage = lazyNamed(() => import("../pages/shared/NotFoundPage"), "NotFoundPage");
const UnauthorizedPage = lazyNamed(() => import("../pages/shared/UnauthorizedPage"), "UnauthorizedPage");

const RouteLoadingFallback = () => (
  <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
    Loading...
  </div>
);

const withRouteSuspense = (element) => (
  <Suspense fallback={<RouteLoadingFallback />}>{element}</Suspense>
);

const mapRolePages = (pages, prefix) =>
  pages.map((page) => {
    if (page.index) {
      return <Route key={`${prefix}-index`} index element={withRouteSuspense(page.element)} />;
    }

    return <Route key={`${prefix}-${page.path}`} path={page.path} element={withRouteSuspense(page.element)} />;
  });

const RoleRedirect = () => {
  const { currentUser } = useAuth();

  if (!currentUser?.role) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={resolveRolePath(currentUser.role)} replace />;
};

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout />}>
        <Route index element={withRouteSuspense(<HomePage />)} />
        <Route path="login" element={<Navigate to="/login/student" replace />} />
        <Route path="login/:role" element={withRouteSuspense(<LoginPage />)} />
        <Route path="register" element={<Navigate to="/register/student" replace />} />
        <Route path="register/:role" element={withRouteSuspense(<RegisterPage />)} />
        <Route path="forgot-password" element={withRouteSuspense(<ForgotPasswordPage />)} />
        <Route path="forgot-password/verify" element={withRouteSuspense(<ForgotPasswordOtpPage />)} />
        <Route path="forgot-password/reset" element={withRouteSuspense(<ResetPasswordPage />)} />
        <Route path="verify-email" element={withRouteSuspense(<VerifyEmailPage />)} />
        <Route path="verify-email/pending" element={withRouteSuspense(<VerifyEmailPendingPage />)} />
        <Route path="unauthorized" element={withRouteSuspense(<UnauthorizedPage />)} />
      </Route>

      <Route path="/dashboard" element={<RoleRedirect />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute allowedRoles={["student"]} />}>
          <Route
            path="/student"
            element={
              <DashboardLayout
                title="Student Portal"
                navItems={studentNavItems}
                theme="emerald"
              />
            }
          >
            {mapRolePages(studentRoutePages, "student")}
          </Route>
        </Route>

        <Route element={<RoleRoute allowedRoles={["university"]} />}>
          <Route
            path="/university"
            element={
              <DashboardLayout
                title="University Portal"
                navItems={universityNavItems}
                theme="blue"
              />
            }
          >
            {mapRolePages(universityRoutePages, "university")}
          </Route>
        </Route>

        <Route element={<RoleRoute allowedRoles={["blogger"]} />}>
          <Route
            path="/blogger"
            element={
              <DashboardLayout
                title="Blogger Dashboard"
                navItems={bloggerNavItems}
                theme="purple"
              />
            }
          >
            {mapRolePages(bloggerRoutePages, "blogger")}
          </Route>
        </Route>

        <Route element={<RoleRoute allowedRoles={["admin"]} />}>
          <Route
            path="/admin"
            element={
              <DashboardLayout
                title="Admin Dashboard"
                navItems={adminNavItems}
                theme="indigo"
              />
            }
          >
            {mapRolePages(adminRoutePages, "admin")}
          </Route>
        </Route>
      </Route>

      <Route path="*" element={withRouteSuspense(<NotFoundPage />)} />
    </Routes>
  );
};
