const express = require("express");
const {
  getDashboardStats,
  listUniversitiesForAdmin,
  reviewUniversity,
  listStudentsForAdmin,
  listBloggersForAdmin,
  updateUserStatus,
  getAdminDashboard,
  listAdminActivities,
  listUniversitiesManagement,
  listStudentsManagement,
  listBloggersManagement,
  deleteManagedUser,
  getMyProfile,
  updateMyProfile,
} = require("./admin.controller");
const { protect, authorize } = require("../../middleware/auth.middleware");
const { ROLES } = require("../../constants/roles");

const router = express.Router();

router.use(protect, authorize(ROLES.ADMIN));

router.get("/me/profile", getMyProfile);
router.put("/me/profile", updateMyProfile);

router.get("/stats", getDashboardStats);
router.get("/dashboard", getAdminDashboard);
router.get("/activities", listAdminActivities);

router.get("/universities", listUniversitiesForAdmin);
router.get("/universities/management", listUniversitiesManagement);
router.patch("/universities/:id/review", reviewUniversity);

router.get("/students", listStudentsForAdmin);
router.get("/students/management", listStudentsManagement);

router.get("/bloggers", listBloggersForAdmin);
router.get("/bloggers/management", listBloggersManagement);

router.patch("/users/:id/status", updateUserStatus);
router.delete("/users/:id", deleteManagedUser);

module.exports = router;
