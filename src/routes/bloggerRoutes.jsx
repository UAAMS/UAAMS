import { lazy } from "react";
import { Home, KeyRound, BookOpen, ListChecks, UserRound } from "lucide-react";

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
const BloggerProfilePage = lazyNamed(
  () => import("../pages/blogger/BloggerProfilePage"),
  "BloggerProfilePage",
);
const BloggerBlogPage = lazyNamed(
  () => import("../pages/blogger/BloggerBlogPage"),
  "BloggerBlogPage",
);
const BloggerMyPostsPage = lazyNamed(
  () => import("../pages/blogger/BloggerMyPostsPage"),
  "BloggerMyPostsPage",
);
const BloggerCreatePostPage = lazyNamed(
  () => import("../pages/blogger/BloggerCreatePostPage"),
  "BloggerCreatePostPage",
);
const BloggerEditPostPage = lazyNamed(
  () => import("../pages/blogger/BloggerEditPostPage"),
  "BloggerEditPostPage",
);
const BloggerDeletePostPage = lazyNamed(
  () => import("../pages/blogger/BloggerDeletePostPage"),
  "BloggerDeletePostPage",
);

export const bloggerNavItems = [
  { to: "/blogger", label: "Overview", icon: Home, end: true },
  { to: "/blogger/profile", label: "Profile", icon: UserRound },
  { to: "/blogger/posts", label: "My Posts", icon: ListChecks },
  { to: "/blogger/blog", label: "My Blog", icon: BookOpen },
  { to: "/blogger/password", label: "Password", icon: KeyRound },
];

export const bloggerRoutePages = [
  { index: true, element: <BloggerOverviewPage /> },
  { path: "profile", element: <BloggerProfilePage /> },
  { path: "posts", element: <BloggerMyPostsPage /> },
  { path: "blog", element: <BloggerBlogPage /> },
  { path: "posts/create", element: <BloggerCreatePostPage /> },
  { path: "posts/:postId/edit", element: <BloggerEditPostPage /> },
  { path: "posts/:postId/delete", element: <BloggerDeletePostPage /> },
  { path: "password", element: <BloggerPasswordPage /> },
];
