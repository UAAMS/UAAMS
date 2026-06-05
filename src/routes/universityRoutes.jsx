import { lazy } from "react";
import {Bell,BookOpen,FileEdit,Hash,Home,PenTool,ScrollText,Settings,Users,} from "lucide-react";

const lazyNamed = (loader, exportName) =>
  lazy(() => loader().then((module) => ({ default: module[exportName] })));

const AdmissionLetterManagement = lazyNamed(
  () => import("../components/university/AdmissionLetterManagement"),
  "AdmissionLetterManagement",
);
const FormConfiguration = lazyNamed(
  () => import("../components/university/FormConfiguration"),
  "FormConfiguration",
);
const RollNumberManagement = lazyNamed(
  () => import("../components/university/RollNumberManagement"),
  "RollNumberManagement",
);
const UniversityAnnouncements = lazyNamed(
  () => import("../components/university/UniversityAnnouncements"),
  "UniversityAnnouncements",
);
const UniversityBlog = lazyNamed(() => import("../components/university/UniversityBlog"), "UniversityBlog");
const UniversityBlogView = lazyNamed(() => import("../components/university/UniversityBlogView"), "UniversityBlogView");
const UniversitySettings = lazyNamed(
  () => import("../components/university/UniversitySettings"),
  "UniversitySettings",
);
const UniversityApplicationsPage = lazyNamed(
  () => import("../pages/university/UniversityApplicationsPage"),
  "UniversityApplicationsPage",
);
const UniversityBloggerManagementPage = lazyNamed(
  () => import("../pages/university/UniversityBloggerManagementPage"),
  "UniversityBloggerManagementPage",
);
const UniversityBlogViewPage = lazyNamed(
  () => import("../pages/university/UniversityBlogViewPage"),
  "UniversityBlogViewPage",
);
const UniversityOverviewPage = lazyNamed(
  () => import("../pages/university/UniversityOverviewPage"),
  "UniversityOverviewPage",
);

export const universityNavItems = [
  { to: "/university", label: "Overview", icon: Home, end: true },
  { to: "/university/applications", label: "Applications", icon: Users },
  { to: "/university/form-builder", label: "Form & Programs", icon: FileEdit },
  { to: "/university/announcements", label: "Announcements", icon: Bell },
  { to: "/university/blog-manage", label: "Manage Blog", icon: BookOpen },
  { to: "/university/blog", label: "View Blog", icon: BookOpen },
  { to: "/university/bloggers", label: "Bloggers", icon: PenTool },
  { to: "/university/roll-numbers", label: "Roll Numbers", icon: Hash },
  { to: "/university/admission-letters", label: "Admission Letters", icon: ScrollText },
  { to: "/university/settings", label: "Profile & Settings", icon: Settings },

];

export const universityRoutePages = [
  { index: true, element: <UniversityOverviewPage /> },
  { path: "applications", element: <UniversityApplicationsPage /> },
  { path: "form-builder", element: <FormConfiguration /> },
  { path: "form-config", element: <FormConfiguration /> },
  { path: "announcements", element: <UniversityAnnouncements /> },
  { path: "blog-manage", element: <UniversityBlog /> },
  { path: "blog", element: <UniversityBlogViewPage /> },
  { path: "bloggers", element: <UniversityBloggerManagementPage /> },
  { path: "roll-numbers", element: <RollNumberManagement /> },
  { path: "admission-letters", element: <AdmissionLetterManagement /> },
  { path: "profile", element: <UniversitySettings /> },
  { path: "settings", element: <UniversitySettings /> },
];
