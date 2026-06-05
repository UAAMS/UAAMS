import { lazy } from "react";
import {Award,Bell,BookOpen,FileText,Home,TrendingUp,User,} from "lucide-react";

const lazyNamed = (loader, exportName) =>
  lazy(() => loader().then((module) => ({ default: module[exportName] })));

const Announcements = lazyNamed(() => import("../components/student/Announcements"), "Announcements");
const MeritLists = lazyNamed(() => import("../components/student/MeritLists"), "MeritLists");
const MyApplications = lazyNamed(() => import("../components/student/MyApplications"), "MyApplications");
const StudentBlog = lazyNamed(() => import("../components/student/StudentBlog"), "StudentBlog");
const UniversityRecommendations = lazyNamed(
  () => import("../components/student/UniversityRecommendations"),
  "UniversityRecommendations",
);
const StudentOverviewPage = lazyNamed(() => import("../pages/student/StudentOverviewPage"), "StudentOverviewPage");
const StudentProfilePage = lazyNamed(() => import("../pages/student/StudentProfilePage"), "StudentProfilePage");
const StudentApplicationFormPage = lazyNamed(
  () => import("../pages/student/StudentApplicationFormPage"),
  "StudentApplicationFormPage",
);
const StudentApplicationPaymentPage = lazyNamed(
  () => import("../pages/student/StudentApplicationPaymentPage"),
  "StudentApplicationPaymentPage",
);
const StudentPaymentSuccessPage = lazyNamed(
  () => import("../pages/student/StudentPaymentSuccessPage"),
  "StudentPaymentSuccessPage",
);

export const studentNavItems = [
  { to: "/student", label: "Overview", icon: Home, end: true },
  { to: "/student/profile", label: "Profile", icon: User },
  {
    to: "/student/recommendations",
    label: "Recommendations",
    icon: TrendingUp,
    activePaths: ["/student/apply", "/student/payment"],
  },
  { to: "/student/applications", label: "Applications", icon: FileText },
  { to: "/student/merit-lists", label: "Merit Lists", icon: Award },
  { to: "/student/announcements", label: "Announcements", icon: Bell },
  { to: "/student/blog", label: "Blog", icon: BookOpen },
];

export const studentRoutePages = [
  { index: true, element: <StudentOverviewPage /> },
  { path: "profile", element: <StudentProfilePage /> },
  { path: "recommendations", element: <UniversityRecommendations /> },
  { path: "apply/:universityId", element: <StudentApplicationFormPage /> },
  { path: "payment-success/:applicationId", element: <StudentPaymentSuccessPage /> },
  { path: "payment/:applicationId", element: <StudentApplicationPaymentPage /> },
  { path: "apply/:universityId/payment/:applicationId", element: <StudentApplicationPaymentPage /> },
  { path: "applications", element: <MyApplications /> },
  { path: "merit-lists", element: <MeritLists /> },
  { path: "announcements", element: <Announcements /> },
  { path: "blog", element: <StudentBlog /> },
];
