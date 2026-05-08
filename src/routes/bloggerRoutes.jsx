import { lazy } from "react";
import { Home, KeyRound, BookOpen } from "lucide-react";

const lazyNamed = (loader, exportName) =>
  lazy(() => loader().then((module) => ({ default: module[exportName] })));

const BloggerOverviewPage = lazyNamed(
  () => import("../pages/blogger/BloggerOverviewPage"),
  "BloggerOverviewPage",
);
const BloggerPasswordPage = lazyNamed(
  () => import("../pages/blogger/BloggerPasswordPage"),
  "BloggerPasswordPage",
);
const BloggerBlogPage = lazyNamed(
  () => import("../pages/blogger/BloggerBlogPage"),
  "BloggerBlogPage",
);

export const bloggerNavItems = [
  { to: "/blogger", label: "Overview", icon: Home, end: true },
  { to: "/blogger/blog", label: "My Blog", icon: BookOpen },
  { to: "/blogger/password", label: "Password", icon: KeyRound },
];

export const bloggerRoutePages = [
  { index: true, element: <BloggerOverviewPage /> },
  { path: "blog", element: <BloggerBlogPage /> },
  { path: "password", element: <BloggerPasswordPage /> },
];
