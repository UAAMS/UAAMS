const express = require("express");
const {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  getMyDashboard,
  listMyPosts,
  createMyPost,
  updateMyPost,
  deleteMyPost,
  getMyPostComments,
  deleteMyPostComment,
} = require("./blogger.controller");
const { protect, authorize } = require("../../middleware/auth.middleware");
const { ROLES } = require("../../constants/roles");

const router = express.Router();

router.use(protect, authorize(ROLES.BLOGGER));

router.get("/me/profile", getMyProfile);
router.put("/me/profile", updateMyProfile);
router.patch("/me/password", changeMyPassword);
router.get("/me/dashboard", getMyDashboard);

router.get("/me/posts", listMyPosts);
router.post("/me/posts", createMyPost);
router.patch("/me/posts/:id", updateMyPost);
router.delete("/me/posts/:id", deleteMyPost);

router.get("/me/posts/:postId/comments", getMyPostComments);
router.delete("/me/posts/:postId/comments/:commentId", deleteMyPostComment);

module.exports = router;
