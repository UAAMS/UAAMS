const express = require("express");
const {
  ensureStudentRole,
  getMyProfile,
  updateMyProfile,
  getRecommendations,
  getMyDashboard,
  listMyAnnouncements,
  listMyMeritLists,
  listMyBlogs,
  recordBlogPostView,
  getBlogComments,
  createBlogComment,
  toggleBlogPostLike,
  toggleBlogCommentLike,
} = require("./student.controller");
const { protect, authorize } = require("../../middleware/auth.middleware");
const { ROLES } = require("../../constants/roles");

const router = express.Router();

router.use(protect, authorize(ROLES.STUDENT), ensureStudentRole);

router.get("/me/dashboard", getMyDashboard);
router.get("/me/profile", getMyProfile);
router.put("/me/profile", updateMyProfile);
router.get("/recommendations", getRecommendations);
router.get("/me/announcements", listMyAnnouncements);
router.get("/me/merit-lists", listMyMeritLists);
router.get("/me/blogs", listMyBlogs);
router.patch("/blogs/:postId/view", recordBlogPostView);
router.patch("/blogs/:postId/like", toggleBlogPostLike);
router.get("/blogs/:postId/comments", getBlogComments);
router.post("/blogs/:postId/comments", createBlogComment);
router.patch("/blog-comments/:commentId/like", toggleBlogCommentLike);

module.exports = router;
