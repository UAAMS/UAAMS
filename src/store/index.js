import { configureStore } from "@reduxjs/toolkit";
import applicationsReducer from "./slices/applicationsSlice";
import adminUsersManagementReducer from "./slices/adminUsersManagementSlice";
import adminUniversityManagementReducer from "./slices/adminUniversityManagementSlice";
import announcementsReducer from "./slices/announcementsSlice";
import bloggerAccountReducer from "./slices/bloggerAccountSlice";
import bloggerPostsReducer from "./slices/bloggerPostsSlice";
import blogCommentsReducer from "./slices/blogCommentsSlice";
import blogsReducer from "./slices/blogsSlice";
import dashboardsReducer from "./slices/dashboardsSlice";
import meritListsReducer from "./slices/meritListsSlice";
import paymentsReducer from "./slices/paymentsSlice";
import recommendationsReducer from "./slices/recommendationsSlice";
import studentApplicationFormReducer from "./slices/studentApplicationFormSlice";
import studentProfileReducer from "./slices/studentProfileSlice";
import universityAccountReducer from "./slices/universityAccountSlice";
import universityAnnouncementsManagementReducer from "./slices/universityAnnouncementsManagementSlice";
import universityApplicationRecordsReducer from "./slices/universityApplicationRecordsSlice";
import universityBloggersManagementReducer from "./slices/universityBloggersManagementSlice";
import universityBlogManagementReducer from "./slices/universityBlogManagementSlice";
import universityFormSetupReducer from "./slices/universityFormSetupSlice";
import universitiesReducer from "./slices/universitiesSlice";

export const store = configureStore({
  reducer: {
    studentProfile: studentProfileReducer,
    applications: applicationsReducer,
    announcements: announcementsReducer,
    meritLists: meritListsReducer,
    universities: universitiesReducer,
    recommendations: recommendationsReducer,
    dashboards: dashboardsReducer,
    blogs: blogsReducer,
    payments: paymentsReducer,
    universityFormSetup: universityFormSetupReducer,
    adminUniversityManagement: adminUniversityManagementReducer,
    bloggerPosts: bloggerPostsReducer,
    blogComments: blogCommentsReducer,
    universityAnnouncementsManagement: universityAnnouncementsManagementReducer,
    universityBlogManagement: universityBlogManagementReducer,
    universityApplicationRecords: universityApplicationRecordsReducer,
    adminUsersManagement: adminUsersManagementReducer,
    universityAccount: universityAccountReducer,
    universityBloggersManagement: universityBloggersManagementReducer,
    bloggerAccount: bloggerAccountReducer,
    studentApplicationForm: studentApplicationFormReducer,
  },
  devTools: import.meta.env.DEV,
});
