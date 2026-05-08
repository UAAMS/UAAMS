const express = require("express");
const {
  listUniversities,
  getUniversityById,
  getUniversityFormByUniversityId,
  getMyProfile,
  updateMyProfile,
  getMyForm,
  upsertMyForm,
  listMyBloggers,
  createBlogger,
  updateMyBloggerStatus,
  deleteMyBlogger,
  getMyDashboard,
  getMySettings,
  updateMySettings,
  getMyPrograms,
  updateMyPrograms,
  listMyAnnouncements,
  createMyAnnouncement,
  updateMyAnnouncement,
  deleteMyAnnouncement,
  listMyBlogs,
  createMyBlog,
  updateMyBlog,
  deleteMyBlog,
  getMyBlogComments,
  deleteMyBlogComment,
  listMyRollNumbers,
  upsertMyRollNumber,
  listMyAdmissionLetters,
  upsertMyAdmissionLetter,
} = require("./university.controller");
const { protect, authorize } = require("../../middleware/auth.middleware");
const { ROLES } = require("../../constants/roles");

const router = express.Router();

router.get("/me/dashboard", protect, authorize(ROLES.UNIVERSITY), getMyDashboard);
router.get("/me/profile", protect, authorize(ROLES.UNIVERSITY), getMyProfile);
router.put("/me/profile", protect, authorize(ROLES.UNIVERSITY), updateMyProfile);
router.get("/me/settings", protect, authorize(ROLES.UNIVERSITY), getMySettings);
router.put("/me/settings", protect, authorize(ROLES.UNIVERSITY), updateMySettings);
router.get("/me/form", protect, authorize(ROLES.UNIVERSITY), getMyForm);
router.put("/me/form", protect, authorize(ROLES.UNIVERSITY), upsertMyForm);
router.get("/me/programs", protect, authorize(ROLES.UNIVERSITY), getMyPrograms);
router.put("/me/programs", protect, authorize(ROLES.UNIVERSITY), updateMyPrograms);

router.get("/me/bloggers", protect, authorize(ROLES.UNIVERSITY), listMyBloggers);
router.post("/me/bloggers", protect, authorize(ROLES.UNIVERSITY), createBlogger);
router.delete(
  "/me/bloggers/:bloggerId",
  protect,
  authorize(ROLES.UNIVERSITY),
  deleteMyBlogger
);
router.patch(
  "/me/bloggers/:bloggerId/status",
  protect,
  authorize(ROLES.UNIVERSITY),
  updateMyBloggerStatus
);

router.get("/me/announcements", protect, authorize(ROLES.UNIVERSITY), listMyAnnouncements);
router.post("/me/announcements", protect, authorize(ROLES.UNIVERSITY), createMyAnnouncement);
router.patch(
  "/me/announcements/:id",
  protect,
  authorize(ROLES.UNIVERSITY),
  updateMyAnnouncement
);
router.delete(
  "/me/announcements/:id",
  protect,
  authorize(ROLES.UNIVERSITY),
  deleteMyAnnouncement
);

router.get("/me/blogs", protect, authorize(ROLES.UNIVERSITY), listMyBlogs);
router.post("/me/blogs", protect, authorize(ROLES.UNIVERSITY), createMyBlog);
router.patch("/me/blogs/:id", protect, authorize(ROLES.UNIVERSITY), updateMyBlog);
router.delete("/me/blogs/:id", protect, authorize(ROLES.UNIVERSITY), deleteMyBlog);

router.get("/me/blogs/:blogId/comments", protect, authorize(ROLES.UNIVERSITY), getMyBlogComments);
router.delete("/me/blogs/:blogId/comments/:commentId", protect, authorize(ROLES.UNIVERSITY), deleteMyBlogComment);

router.get("/me/roll-numbers", protect, authorize(ROLES.UNIVERSITY), listMyRollNumbers);
router.patch(
  "/me/roll-numbers/:applicationId",
  protect,
  authorize(ROLES.UNIVERSITY),
  upsertMyRollNumber
);

router.get(
  "/me/admission-letters",
  protect,
  authorize(ROLES.UNIVERSITY),
  listMyAdmissionLetters
);
router.patch(
  "/me/admission-letters/:applicationId",
  protect,
  authorize(ROLES.UNIVERSITY),
  upsertMyAdmissionLetter
);

router.get("/", listUniversities);
router.get("/:id/form", getUniversityFormByUniversityId);
router.get("/:id", getUniversityById);

module.exports = router;
