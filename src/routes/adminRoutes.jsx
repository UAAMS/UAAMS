import { lazy } from "react";
import { BookOpen, Building2, Home, UserRound, Users } from "lucide-react";

const lazyNamed = (loader, exportName) =>
  lazy(() => loader().then((module) => ({ default: module[exportName] })));

const AllBloggersManagement = lazyNamed(
  () => import("../components/admin/AllBloggersManagement"),
  "AllBloggersManagement",
);
const StudentManagement = lazyNamed(
  () => import("../components/admin/StudentManagement"),
  "StudentManagement",
);
const UniversityManagement = lazyNamed(
  () => import("../components/admin/UniversityManagement"),
  "UniversityManagement",
);
const AdminOverviewPage = lazyNamed(() => import("../pages/admin/AdminOverviewPage"), "AdminOverviewPage");
const AdminProfilePage = lazyNamed(() => import("../pages/admin/AdminProfilePage"), "AdminProfilePage");

export const adminNavItems = [
  { to: "/admin", label: "Overview", icon: Home, end: true },
  { to: "/admin/profile", label: "Profile", icon: UserRound },
  { to: "/admin/universities", label: "Universities", icon: Building2 },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/bloggers", label: "Bloggers", icon: BookOpen },
];

export const adminRoutePages = [
  { index: true, element: <AdminOverviewPage /> },
  { path: "profile", element: <AdminProfilePage /> },
  { path: "universities", element: <UniversityManagement /> },
  { path: "students", element: <StudentManagement /> },
  { path: "bloggers", element: <AllBloggersManagement /> },
  
];
