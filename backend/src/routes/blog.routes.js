const express = require("express");
const {
  listBlogPosts,
  getBlogPostById,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  deleteBlogComment,
} = require("../controllers/blog.controller");
const { protect, optionalProtect, authorize } = require("../middleware/auth.middleware");
const { ROLES } = require("../constants/roles");

const router = express.Router();

router.get("/", listBlogPosts);
router.get("/:id", optionalProtect, getBlogPostById);

router.post("/", protect, authorize(ROLES.UNIVERSITY, ROLES.BLOGGER), createBlogPost);
router.patch("/:id", protect, authorize(ROLES.UNIVERSITY, ROLES.BLOGGER, ROLES.ADMIN), updateBlogPost);
router.delete("/:id", protect, authorize(ROLES.UNIVERSITY, ROLES.BLOGGER, ROLES.ADMIN), deleteBlogPost);
router.delete(
  "/:id/comments/:commentId",
  protect,
  authorize(ROLES.UNIVERSITY, ROLES.BLOGGER, ROLES.ADMIN),
  deleteBlogComment
);

module.exports = router;
