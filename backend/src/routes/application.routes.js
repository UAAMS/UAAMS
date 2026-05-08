const express = require("express");
const {
  createApplication,
  getMyApplications,
  getApplicationById,
  payApplicationFee,
  updateMyDraftApplication,
  deleteMyDraftApplication,
  getUniversityApplications,
  updateApplicationStatus,
  assignRollNumber,
  uploadAdmissionLetter,
  downloadApplicationTemplatePdf,
  downloadApplicationArchive,
} = require("../controllers/application.controller");
const { protect, authorize } = require("../middleware/auth.middleware");
const { ROLES } = require("../constants/roles");

const router = express.Router();

router.use(protect);

router.post("/", authorize(ROLES.STUDENT), createApplication);
router.get("/me", authorize(ROLES.STUDENT), getMyApplications);
router.patch("/:id", authorize(ROLES.STUDENT), updateMyDraftApplication);
router.delete("/:id", authorize(ROLES.STUDENT), deleteMyDraftApplication);
router.patch("/:id/payment", authorize(ROLES.STUDENT), payApplicationFee);

router.get(
  "/university/me",
  authorize(ROLES.UNIVERSITY, ROLES.ADMIN),
  getUniversityApplications
);
router.patch(
  "/:id/status",
  authorize(ROLES.UNIVERSITY, ROLES.ADMIN),
  updateApplicationStatus
);
router.patch(
  "/:id/roll-number",
  authorize(ROLES.UNIVERSITY, ROLES.ADMIN),
  assignRollNumber
);
router.patch(
  "/:id/admission-letter",
  authorize(ROLES.UNIVERSITY, ROLES.ADMIN),
  uploadAdmissionLetter
);
router.get(
  "/:id/template-pdf",
  authorize(ROLES.STUDENT, ROLES.UNIVERSITY, ROLES.ADMIN),
  downloadApplicationTemplatePdf
);
router.get(
  "/:id/archive",
  authorize(ROLES.UNIVERSITY, ROLES.ADMIN),
  downloadApplicationArchive
);

router.get("/:id", getApplicationById);

module.exports = router;
