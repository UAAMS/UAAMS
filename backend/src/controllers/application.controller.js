const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");
const Application = require("../models/Application");
const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const UniversityProfile = require("../models/UniversityProfile");
const UniversityForm = require("../models/UniversityForm");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const env = require("../config/env");
const getPagination = require("../utils/pagination");
const { emitDataUpdate } = require("../utils/socket");
const { persistMaybeDataUrl, persistDataUrlsInValue } = require("../utils/fileStorage");
const { generateApplicationTemplatePdf } = require("../utils/applicationTemplatePdf");
const { normalizePaymentMethods } = require("../utils/paymentMethods");
const { createZipArchive } = require("../utils/zipArchive");
const { getSystemApplicationTemplate } = require("../config/systemApplicationTemplate");
const {
  sendRollNumberAssignedEmail,
  sendAdmissionLetterIssuedEmail,
} = require("../utils/mailer");
const { ROLES, UNIVERSITY_APPROVAL } = require("../constants/roles");

const ensureObjectId = (id, message = "Invalid resource id.") => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, message);
  }
};

const resolveIdValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
  }
  return String(value);
};

const canAccessApplication = (application, user) => {
  if (user.role === ROLES.ADMIN) return true;
  if (user.role === ROLES.STUDENT && resolveIdValue(application.student) === String(user._id)) {
    return true;
  }
  if (
    user.role === ROLES.UNIVERSITY &&
    resolveIdValue(application.university) === String(user._id)
  ) {
    return true;
  }
  return false;
};

const sanitizeDownloadFileName = (value) =>
  String(value || "application-template")
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();

const findProgramByName = (profile, programName) => {
  const normalizedProgramName = String(programName || "").trim().toLowerCase();
  if (!normalizedProgramName) return null;

  const programs = Array.isArray(profile?.programs) ? profile.programs : [];
  return (
    programs.find(
      (program) =>
        String(program?.name || "").trim().toLowerCase() === normalizedProgramName
    ) || null
  );
};

const resolveEffectiveDeadline = (profile, matchedProgram) => {
  if (matchedProgram?.deadlineDate) {
    return matchedProgram.deadlineDate;
  }
  return profile?.applicationEndDate || null;
};

const hasDeadlinePassed = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  date.setHours(23, 59, 59, 999);
  return date.getTime() < Date.now();
};

const ensureProgramAcceptingApplications = ({ profile, programName }) => {
  if (profile?.acceptApplicationsThroughUaams === false) {
    throw new ApiError(400, "This university is not accepting applications through UAAMS.");
  }

  const allPrograms = Array.isArray(profile?.programs) ? profile.programs : [];
  const matchedProgram = findProgramByName(profile, programName);

  if (allPrograms.length > 0 && !matchedProgram) {
    throw new ApiError(400, "Selected program is no longer available.");
  }

  if (matchedProgram && matchedProgram.isAdmissionOpen === false) {
    throw new ApiError(400, "Admission is currently closed for this program.");
  }

  const effectiveDeadline = resolveEffectiveDeadline(profile, matchedProgram);
  if (hasDeadlinePassed(effectiveDeadline)) {
    throw new ApiError(400, "Application deadline has passed for this program.");
  }
};

const nextStatusesByCurrent = {
  "not-submitted": [],
  pending: ["under-review", "rejected"],
  "under-review": ["accepted", "rejected"],
  accepted: ["assigned"],
  assigned: ["finalized"],
  finalized: [],
  rejected: [],
};

const canTransitionStatus = ({ currentStatus, nextStatus }) => {
  const allowed = nextStatusesByCurrent[String(currentStatus)] || [];
  return allowed.includes(String(nextStatus));
};

const APPLICATION_LIST_PROJECTION = [
  "applicationCode",
  "student",
  "university",
  "studentName",
  "email",
  "cnic",
  "program",
  "aggregate",
  "matricMarks",
  "interMarks",
  "testScore",
  "status",
  "payment",
  "rollNumber",
  "admissionLetter",
  "eligibleForAdmissionLetter",
  "meritPosition",
  "meritListNumber",
  "appliedAt",
  "createdAt",
  "updatedAt",
].join(" ");

const normalizeApplicationFormData = async (formData, userId) => {
  const fallbackPayload =
    formData && typeof formData === "object" && !Array.isArray(formData) ? formData : {};
  const result = await persistDataUrlsInValue(fallbackPayload, {
    folder: `applications/${String(userId)}/form-data`,
    preferredNamePrefix: "form-field",
  });
  return result.value;
};

const DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/i;
const HTTP_URL_PATTERN = /^https?:\/\//i;

const inferMimeTypeByExtension = (fileName = "") => {
  const extension = path.extname(String(fileName || "")).toLowerCase();
  if ([".jpg", ".jpeg"].includes(extension)) return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".doc") return "application/msword";
  if (extension === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
};

const inferExtension = ({ mimeType = "", source = "", fallback = "bin" } = {}) => {
  const sourceExtension = path.extname(String(source || "").split("?")[0].split("#")[0])
    .replace(".", "")
    .toLowerCase();
  if (sourceExtension) return sourceExtension;

  const normalizedMime = String(mimeType || "").toLowerCase();
  const extensionByMime = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  };
  return extensionByMime[normalizedMime] || fallback;
};

const sanitizeZipName = (value, fallback = "file") =>
  String(value || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || fallback;

const parseDataUrl = (value = "") => {
  const match = String(value || "").match(DATA_URL_PATTERN);
  if (!match) return null;
  try {
    return {
      mimeType: String(match[1] || "").toLowerCase(),
      bytes: Buffer.from(String(match[2] || ""), "base64"),
    };
  } catch {
    return null;
  }
};

const extractFileNameFromUrl = (value = "") => {
  const cleanValue = String(value || "").split("#")[0].split("?")[0];
  const name = cleanValue.split(/[\\/]/).filter(Boolean).pop();
  return name ? decodeURIComponent(name) : "";
};

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

const readDownloadableFile = async (source) => {
  const value = String(source || "").trim();
  if (!value) {
    throw new Error("File source is missing.");
  }

  if (DATA_URL_PATTERN.test(value)) {
    const parsed = parseDataUrl(value);
    if (!parsed?.bytes?.length) {
      throw new Error("File data is invalid.");
    }
    return {
      bytes: parsed.bytes,
      mimeType: parsed.mimeType,
      sourceName: `upload.${inferExtension({ mimeType: parsed.mimeType })}`,
    };
  }

  const normalizedUploadsBase = trimTrailingSlash(env.uploadsPublicBaseUrl);
  if (value.startsWith("/uploads/")) {
    const relativePath = value.replace(/^\/uploads\//, "");
    const absolutePath = path.resolve(env.uploadsDir, relativePath);
    return {
      bytes: await fs.readFile(absolutePath),
      mimeType: inferMimeTypeByExtension(absolutePath),
      sourceName: extractFileNameFromUrl(value),
    };
  }

  if (normalizedUploadsBase && value.startsWith(`${normalizedUploadsBase}/uploads/`)) {
    const relativePath = value.slice(`${normalizedUploadsBase}/uploads/`.length);
    const absolutePath = path.resolve(env.uploadsDir, relativePath);
    return {
      bytes: await fs.readFile(absolutePath),
      mimeType: inferMimeTypeByExtension(absolutePath),
      sourceName: extractFileNameFromUrl(value),
    };
  }

  if (HTTP_URL_PATTERN.test(value)) {
    const response = await fetch(value);
    if (!response.ok) {
      throw new Error(`Unable to fetch uploaded file (${response.status}).`);
    }
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      mimeType: String(response.headers.get("content-type") || "").toLowerCase(),
      sourceName: extractFileNameFromUrl(value),
    };
  }

  const absolutePath = path.isAbsolute(value)
    ? value
    : path.resolve(env.uploadsDir, value.replace(/^\/+/, ""));
  return {
    bytes: await fs.readFile(absolutePath),
    mimeType: inferMimeTypeByExtension(absolutePath),
    sourceName: path.basename(absolutePath),
  };
};

const valueLooksLikeUploadedFile = (value) => {
  const text = String(value || "").trim();
  if (!text) return false;
  if (DATA_URL_PATTERN.test(text)) return true;
  if (text.startsWith("/uploads/") || HTTP_URL_PATTERN.test(text)) return true;
  return /\.(pdf|png|jpe?g|webp|gif|docx?|txt)(\?|#|$)/i.test(text);
};

const buildFormFieldLookup = (formFields = []) => {
  const lookup = new Map();
  if (!Array.isArray(formFields)) return lookup;
  formFields.forEach((field) => {
    const id = String(field?.id || "").trim();
    if (!id) return;
    lookup.set(id, {
      label: String(field?.label || `Field ${id}`).trim(),
      type: String(field?.type || "").toLowerCase(),
    });
  });
  return lookup;
};

const defaultUploadedFieldLabels = {
  "9": "Profile Picture",
  "10": "Domicile Certificate",
  "11": "Matric Result",
  "12": "Inter Result",
  "uaams-doc-profile-picture": "Profile Picture",
  "uaams-doc-domicile": "Domicile Certificate",
  "uaams-doc-matric-result": "Matric Result",
  "uaams-doc-inter-result": "Inter Result",
};

const collectUploadedFilesFromValue = ({
  value,
  fieldPath,
  label,
  fieldType,
  results,
}) => {
  if (typeof value === "string") {
    if (fieldType === "file" || valueLooksLikeUploadedFile(value)) {
      results.push({
        source: value,
        label,
        fieldPath,
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectUploadedFilesFromValue({
        value: item,
        fieldPath: `${fieldPath}-${index + 1}`,
        label: `${label} ${index + 1}`,
        fieldType,
        results,
      });
    });
    return;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      collectUploadedFilesFromValue({
        value: item,
        fieldPath: `${fieldPath}-${key}`,
        label: `${label} ${key}`,
        fieldType,
        results,
      });
    });
  }
};

const collectApplicationUploadedFiles = ({ application, formFields }) => {
  const formData = application?.formData && typeof application.formData === "object"
    ? application.formData
    : {};
  const fieldLookup = buildFormFieldLookup(formFields);
  const results = [];

  Object.entries(formData).forEach(([fieldId, value]) => {
    const field = fieldLookup.get(String(fieldId)) || {};
    collectUploadedFilesFromValue({
      value,
      fieldPath: String(fieldId),
      label: field.label || defaultUploadedFieldLabels[String(fieldId)] || `Field ${fieldId}`,
      fieldType: field.type || "",
      results,
    });
  });

  return results;
};

const buildApplicationPdfBuffer = async ({ application, universityForm, universityProfile }) => {
  const universityId = resolveIdValue(application.university);
  const studentId = resolveIdValue(application.student);
  const [universityUser, studentUser, studentProfile] = await Promise.all([
    User.findById(universityId).select("name email phone location").lean(),
    User.findById(studentId).select("name email").lean(),
    StudentProfile.findOne({ user: studentId }).lean(),
  ]);

  return generateApplicationTemplatePdf({
    template: getSystemApplicationTemplate(),
    application,
    universityProfile,
    universityUser,
    studentUser,
    studentProfile,
    formFields: Array.isArray(universityForm?.fields) ? universityForm.fields : [],
  });
};

const createApplication = asyncHandler(async (req, res) => {
  const { universityId, program, formData: incomingFormData = {}, payment } = req.body;
  const formData = await normalizeApplicationFormData(incomingFormData, req.user._id);

  ensureObjectId(universityId, "Invalid university id.");

  if (!program) {
    throw new ApiError(400, "Program is required.");
  }

  const university = await User.findOne({
    _id: universityId,
    role: ROLES.UNIVERSITY,
    approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
  })
    .select("_id")
    .lean();

  if (!university) {
    throw new ApiError(404, "University is not available for application.");
  }

  const profile = await UniversityProfile.findOne({ university: university._id })
    .select("acceptApplicationsThroughUaams applicationEndDate programs applicationFee")
    .lean();
  ensureProgramAcceptingApplications({ profile, programName: program });
  const applicationFee = Number(profile?.applicationFee || 0);

  const matricMarks = Number(formData["7"] || formData.matric || 0);
  const interMarks = Number(formData["8"] || formData.fsc || 0);
  const aggregate =
    Number(formData.aggregate || 0) ||
    (matricMarks > 0 && interMarks > 0 ? Number((((matricMarks + interMarks) / 2200) * 100).toFixed(2)) : 0);

  const paymentPayload = {
    status: "unpaid",
    amount: applicationFee,
    method: String(payment?.method || "card"),
    accountLast4: "",
    transactionReference: "",
    paidAt: null,
  };

  let status = "not-submitted";

  if (payment?.transactionReference) {
    paymentPayload.status = "paid";
    paymentPayload.transactionReference = String(payment.transactionReference).trim();
    paymentPayload.accountLast4 = String(payment.accountNumber || "").slice(-4);
    paymentPayload.paidAt = new Date();
    status = "pending";
  }

  const application = await Application.create({
    student: req.user._id,
    university: university._id,
    studentName: String(formData["1"] || req.user.name || "Student"),
    email: String(formData["2"] || req.user.email || "").toLowerCase(),
    cnic: String(formData["4"] || formData.cnic || ""),
    program: String(program),
    formData,
    aggregate,
    matricMarks,
    interMarks,
    testScore: Number(formData.testScore || 0),
    payment: paymentPayload,
    status,
  });

  emitDataUpdate({
    resource: "applications",
    action: "created",
    userIds: [String(req.user._id), String(university._id)],
    payload: {
      applicationId: String(application._id),
      universityId: String(university._id),
      status: application.status,
    },
  });

  return res.status(201).json({
    success: true,
    message:
      status === "pending"
        ? "Application created and payment marked as completed."
        : "Application draft created. Complete payment to submit.",
    data: { application },
  });
});

const getMyApplications = asyncHandler(async (req, res) => {
  const query = { student: req.user._id };

  if (req.query.status) {
    query.status = String(req.query.status);
  }

  const applications = await Application.find(query)
    .select(APPLICATION_LIST_PROJECTION)
    .sort({ createdAt: -1 })
    .populate("university", "name")
    .lean();

  return res.status(200).json({
    success: true,
    data: { applications },
  });
});

const getApplicationById = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid application id.");

  const application = await Application.findById(req.params.id)
    .populate("student", "name email")
    .populate("university", "name email")
    .lean();

  if (!application) {
    throw new ApiError(404, "Application not found.");
  }

  if (!canAccessApplication(application, req.user)) {
    throw new ApiError(403, "You do not have permission to view this application.");
  }

  const universityProfile = await UniversityProfile.findOne({
    university: resolveIdValue(application.university),
  })
    .select("paymentMethods")
    .lean();

  return res.status(200).json({
    success: true,
    data: {
      application: {
        ...application,
        paymentMethods: normalizePaymentMethods(universityProfile?.paymentMethods).filter(
          (method) => method.isActive,
        ),
      },
    },
  });
});

const downloadApplicationTemplatePdf = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid application id.");

  const application = await Application.findById(req.params.id).lean();
  if (!application) {
    throw new ApiError(404, "Application not found.");
  }

  if (!canAccessApplication(application, req.user)) {
    throw new ApiError(403, "You do not have permission to download this application.");
  }

  const universityId = resolveIdValue(application.university);
  const [universityForm, universityProfile] = await Promise.all([
    UniversityForm.findOne({ university: universityId }).select("fields").lean(),
    UniversityProfile.findOne({ university: universityId }).lean(),
  ]);

  const pdfBuffer = await buildApplicationPdfBuffer({
    application,
    universityForm,
    universityProfile,
  });

  const fileName = `${sanitizeDownloadFileName(application.applicationCode || application._id)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
  return res.status(200).send(pdfBuffer);
});

const addUniqueZipEntry = (entries, usedNames, entry) => {
  const normalizedName = String(entry.name || "file.bin");
  let candidate = normalizedName;
  const extension = path.extname(normalizedName);
  const stem = extension ? normalizedName.slice(0, -extension.length) : normalizedName;
  let counter = 2;

  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${stem}-${counter}${extension}`;
    counter += 1;
  }

  usedNames.add(candidate.toLowerCase());
  entries.push({
    ...entry,
    name: candidate,
  });
};

const downloadApplicationArchive = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid application id.");

  const application = await Application.findById(req.params.id).lean();
  if (!application) {
    throw new ApiError(404, "Application not found.");
  }

  if (
    req.user.role !== ROLES.ADMIN &&
    (req.user.role !== ROLES.UNIVERSITY ||
      resolveIdValue(application.university) !== String(req.user._id))
  ) {
    throw new ApiError(403, "You can only download archives for your university applications.");
  }

  const universityId = resolveIdValue(application.university);
  const [universityForm, universityProfile] = await Promise.all([
    UniversityForm.findOne({ university: universityId }).select("fields").lean(),
    UniversityProfile.findOne({ university: universityId }).lean(),
  ]);

  const entries = [];
  const usedNames = new Set();
  const warnings = [];
  const archiveBaseName = sanitizeDownloadFileName(application.applicationCode || application._id);

  const applicationPdf = await buildApplicationPdfBuffer({
    application,
    universityForm,
    universityProfile,
  });

  addUniqueZipEntry(entries, usedNames, {
    name: `application/${archiveBaseName}-application.pdf`,
    bytes: applicationPdf,
    modifiedAt: application.updatedAt || new Date(),
  });

  const uploadedFiles = collectApplicationUploadedFiles({
    application,
    formFields: Array.isArray(universityForm?.fields) ? universityForm.fields : [],
  });

  for (const file of uploadedFiles) {
    try {
      const loaded = await readDownloadableFile(file.source);
      const extension = inferExtension({
        mimeType: loaded.mimeType,
        source: loaded.sourceName || file.source,
      });
      const label = sanitizeZipName(file.label || file.fieldPath || "document", "document");
      addUniqueZipEntry(entries, usedNames, {
        name: `documents/${label}.${extension}`,
        bytes: loaded.bytes,
        modifiedAt: application.updatedAt || new Date(),
      });
    } catch (error) {
      warnings.push(`${file.label || file.fieldPath}: ${error?.message || "Unable to include file."}`);
    }
  }

  if (application.payment?.proofFileUrl) {
    try {
      const loaded = await readDownloadableFile(application.payment.proofFileUrl);
      const extension = inferExtension({
        mimeType: loaded.mimeType,
        source: application.payment.proofFileName || loaded.sourceName || application.payment.proofFileUrl,
      });
      addUniqueZipEntry(entries, usedNames, {
        name: `payment/payment-screenshot.${extension}`,
        bytes: loaded.bytes,
        modifiedAt: application.payment.paidAt || application.updatedAt || new Date(),
      });
    } catch (error) {
      warnings.push(`Payment screenshot: ${error?.message || "Unable to include file."}`);
    }
  } else {
    warnings.push("Payment screenshot: no payment proof uploaded.");
  }

  if (warnings.length > 0) {
    addUniqueZipEntry(entries, usedNames, {
      name: "archive-warnings.txt",
      bytes: Buffer.from(warnings.join("\n"), "utf8"),
      modifiedAt: new Date(),
    });
  }

  const zipBuffer = createZipArchive(entries);
  const fileName = `${archiveBaseName}-application-package.zip`;
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
  return res.status(200).send(zipBuffer);
});

const payApplicationFee = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid application id.");

  const {
    method,
    accountNumber = "",
    transactionReference,
    paymentProof,
    paymentProofFileName,
  } = req.body;

  if (!transactionReference) {
    throw new ApiError(400, "Transaction reference is required.");
  }

  if (!paymentProof) {
    throw new ApiError(400, "Payment screenshot is required.");
  }

  const application = await Application.findById(req.params.id);
  if (!application) {
    throw new ApiError(404, "Application not found.");
  }

  if (String(application.student) !== String(req.user._id)) {
    throw new ApiError(403, "You can only pay for your own applications.");
  }

  const profile = await UniversityProfile.findOne({ university: application.university })
    .select("acceptApplicationsThroughUaams applicationEndDate programs")
    .lean();
  ensureProgramAcceptingApplications({ profile, programName: application.program });

  const proofFileUrl = await persistMaybeDataUrl({
    value: paymentProof,
    folder: `applications/${String(application._id)}/payment-proof`,
    preferredName: paymentProofFileName || `payment-proof-${String(transactionReference || "submitted")}`,
  });

  application.payment.status = "paid";
  application.payment.method = method || "bank";
  application.payment.accountLast4 = String(accountNumber).slice(-4);
  application.payment.transactionReference = String(transactionReference).trim();
  application.payment.proofFileUrl = String(proofFileUrl || "").trim();
  application.payment.proofFileName = String(paymentProofFileName || extractFileNameFromUrl(proofFileUrl) || "").trim();
  application.payment.paidAt = new Date();
  application.status = "pending";

  await application.save();

  emitDataUpdate({
    resource: "applications",
    action: "updated",
    userIds: [String(application.student), String(application.university)],
    payload: {
      applicationId: String(application._id),
      universityId: String(application.university),
      status: application.status,
      paymentStatus: application.payment.status,
    },
  });

  return res.status(200).json({
    success: true,
    message: "Payment recorded and application submitted successfully.",
    data: { application },
  });
});

const updateMyDraftApplication = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid application id.");

  const application = await Application.findById(req.params.id);
  if (!application) {
    throw new ApiError(404, "Application not found.");
  }

  if (String(application.student) !== String(req.user._id)) {
    throw new ApiError(403, "You can only edit your own applications.");
  }

  if (application.status !== "not-submitted" || application.payment?.status === "paid") {
    throw new ApiError(400, "Only unpaid draft applications can be edited.");
  }

  const program = String(req.body?.program || "").trim();
  const formData = await normalizeApplicationFormData(req.body?.formData || {}, req.user._id);

  if (!program) {
    throw new ApiError(400, "Program is required.");
  }

  const profile = await UniversityProfile.findOne({ university: application.university })
    .select("acceptApplicationsThroughUaams applicationEndDate programs")
    .lean();
  ensureProgramAcceptingApplications({ profile, programName: program });

  const matricMarks = Number(formData["7"] || formData.matric || 0);
  const interMarks = Number(formData["8"] || formData.fsc || 0);
  const aggregate =
    Number(formData.aggregate || 0) ||
    (matricMarks > 0 && interMarks > 0
      ? Number((((matricMarks + interMarks) / 2200) * 100).toFixed(2))
      : 0);

  application.program = program;
  application.formData = formData;
  application.studentName = String(formData["1"] || req.user.name || application.studentName || "Student");
  application.email = String(formData["2"] || req.user.email || application.email || "").toLowerCase();
  application.cnic = String(formData["4"] || formData.cnic || application.cnic || "");
  application.aggregate = aggregate;
  application.matricMarks = matricMarks;
  application.interMarks = interMarks;
  application.testScore = Number(formData.testScore || application.testScore || 0);

  await application.save();

  emitDataUpdate({
    resource: "applications",
    action: "updated",
    userIds: [String(application.student), String(application.university)],
    payload: {
      applicationId: String(application._id),
      universityId: String(application.university),
      status: application.status,
      paymentStatus: application.payment?.status || "unpaid",
    },
  });

  return res.status(200).json({
    success: true,
    message: "Draft application updated successfully.",
    data: { application },
  });
});

const deleteMyDraftApplication = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid application id.");

  const application = await Application.findById(req.params.id);
  if (!application) {
    throw new ApiError(404, "Application not found.");
  }

  if (String(application.student) !== String(req.user._id)) {
    throw new ApiError(403, "You can only delete your own applications.");
  }

  if (application.status !== "not-submitted" || application.payment?.status === "paid") {
    throw new ApiError(400, "Only unpaid draft applications can be deleted.");
  }

  await Application.findByIdAndDelete(req.params.id);

  emitDataUpdate({
    resource: "applications",
    action: "deleted",
    userIds: [String(application.student), String(application.university)],
    payload: {
      applicationId: String(application._id),
      universityId: String(application.university),
    },
  });

  return res.status(200).json({
    success: true,
    message: "Draft application deleted successfully.",
  });
});

const getUniversityApplications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const query = {};

  if (req.user.role === ROLES.UNIVERSITY) {
    query.university = req.user._id;
  } else if (req.user.role !== ROLES.ADMIN) {
    throw new ApiError(403, "Only universities and admins can access this endpoint.");
  }

  if (req.query.status) {
    query.status = String(req.query.status);
  }

  if (req.query.program) {
    query.program = String(req.query.program);
  }

  if (req.query.search) {
    const search = String(req.query.search).trim();
    query.$or = [
      { studentName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { applicationCode: { $regex: search, $options: "i" } },
    ];
  }

  const [total, applications] = await Promise.all([
    Application.countDocuments(query),
    Application.find(query)
      .select(APPLICATION_LIST_PROJECTION)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("student", "name email")
      .populate("university", "name")
      .lean(),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      applications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  });
});

const updateApplicationStatus = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid application id.");

  const { status } = req.body;
  const allowedStatuses = [
    "not-submitted",
    "pending",
    "under-review",
    "accepted",
    "rejected",
    "assigned",
    "finalized",
  ];

  if (!allowedStatuses.includes(status)) {
    throw new ApiError(400, "Invalid status value.");
  }

  const application = await Application.findById(req.params.id);
  if (!application) {
    throw new ApiError(404, "Application not found.");
  }

  if (req.user.role === ROLES.UNIVERSITY && String(application.university) !== String(req.user._id)) {
    throw new ApiError(403, "You can only update your university applications.");
  }

  if (application.status === "not-submitted" || application.payment?.status !== "paid") {
    throw new ApiError(
      400,
      "Status cannot be changed before payment is completed and application is submitted."
    );
  }

  if (String(status) === String(application.status)) {
    return res.status(200).json({
      success: true,
      message: "Application status is already up to date.",
      data: { application },
    });
  }

  if (!canTransitionStatus({ currentStatus: application.status, nextStatus: status })) {
    throw new ApiError(
      400,
      `Invalid status transition from ${application.status} to ${status}.`
    );
  }

  if (status === "assigned" && !application.rollNumber?.assigned) {
    throw new ApiError(400, "Roll number must be assigned before moving to assigned status.");
  }

  if (status === "finalized") {
    if (!application.rollNumber?.assigned) {
      throw new ApiError(
        400,
        "Roll number must be assigned before moving to finalized status."
      );
    }
    if (!application.admissionLetter?.issued) {
      throw new ApiError(
        400,
        "Admission letter must be issued before moving to finalized status."
      );
    }
  }

  application.status = status;
  await application.save();

  emitDataUpdate({
    resource: "applications",
    action: "updated",
    userIds: [String(application.student), String(application.university)],
    payload: {
      applicationId: String(application._id),
      universityId: String(application.university),
      status: application.status,
    },
  });
  if (["accepted", "rejected", "assigned", "finalized"].includes(status)) {
    emitDataUpdate({
      resource: "merit-lists",
      action: "updated",
      roles: ["student"],
      payload: {
        universityId: String(application.university),
        applicationId: String(application._id),
      },
    });
  }

  return res.status(200).json({
    success: true,
    message: "Application status updated successfully.",
    data: { application },
  });
});

const assignRollNumber = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid application id.");

  const { number, slipFileUrl, slipFileName, eligibleForAdmissionLetter } = req.body;

  if (!number) {
    throw new ApiError(400, "Roll number is required.");
  }

  const application = await Application.findById(req.params.id);
  if (!application) {
    throw new ApiError(404, "Application not found.");
  }

  if (req.user.role === ROLES.UNIVERSITY && String(application.university) !== String(req.user._id)) {
    throw new ApiError(403, "You can only assign roll numbers for your own university.");
  }

  if (!["accepted", "assigned", "finalized"].includes(String(application.status))) {
    throw new ApiError(400, "Roll number can only be assigned after application is accepted.");
  }

  if (application.payment?.status !== "paid") {
    throw new ApiError(400, "Payment is not completed for this application.");
  }

  const persistedSlipFileUrl = await persistMaybeDataUrl({
    value: slipFileUrl,
    folder: `applications/${String(application._id)}/roll-slips`,
    preferredName: slipFileName || `roll-slip-${String(number || "assigned")}`,
  });

  application.rollNumber = {
    assigned: true,
    number: String(number).trim(),
    slipFileUrl: String(persistedSlipFileUrl || ""),
    slipFileName: String(slipFileName || ""),
    assignedAt: new Date(),
    assignedBy: req.user._id,
  };
  if (eligibleForAdmissionLetter !== undefined) {
    application.eligibleForAdmissionLetter = Boolean(eligibleForAdmissionLetter);
  }
  if (application.status !== "finalized") {
    application.status = "assigned";
  }
  await application.save();

  let rollEmailDelivery = { sent: false, reason: "" };
  try {
    rollEmailDelivery = await sendRollNumberAssignedEmail({
      to: application.email,
      studentName: application.studentName,
      universityName: req.user?.name || "University",
      applicationCode: application.applicationCode,
      program: application.program,
      rollNumber: application.rollNumber?.number,
      slipFileUrl: application.rollNumber?.slipFileUrl,
      slipFileName: application.rollNumber?.slipFileName,
    });
  } catch (emailError) {
    rollEmailDelivery = {
      sent: false,
      reason: emailError?.message || "Failed to send roll number email.",
    };
  }

  emitDataUpdate({
    resource: "applications",
    action: "updated",
    userIds: [String(application.student), String(application.university)],
    payload: {
      applicationId: String(application._id),
      universityId: String(application.university),
      status: application.status,
      rollAssigned: true,
      eligibleForAdmissionLetter: application.eligibleForAdmissionLetter,
    },
  });
  emitDataUpdate({
    resource: "merit-lists",
    action: "updated",
    roles: ["student"],
    payload: {
      universityId: String(application.university),
      applicationId: String(application._id),
    },
  });

  return res.status(200).json({
    success: true,
    message: "Roll number assigned successfully.",
    data: { application, emailDelivery: rollEmailDelivery },
  });
});

const uploadAdmissionLetter = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id, "Invalid application id.");

  const { letterNumber, fileUrl, fileName, remarks, sentToStudent } = req.body;

  if (!letterNumber || !fileUrl) {
    throw new ApiError(400, "Letter number and file URL are required.");
  }

  const application = await Application.findById(req.params.id);
  if (!application) {
    throw new ApiError(404, "Application not found.");
  }

  if (req.user.role === ROLES.UNIVERSITY && String(application.university) !== String(req.user._id)) {
    throw new ApiError(403, "You can only upload admission letters for your own university.");
  }

  if (!application.rollNumber?.assigned) {
    throw new ApiError(400, "Admission letter cannot be issued before roll number is assigned.");
  }

  if (!application.eligibleForAdmissionLetter) {
    throw new ApiError(400, "This application is not marked eligible for admission letter.");
  }

  if (application.payment?.status !== "paid") {
    throw new ApiError(400, "Payment is not completed for this application.");
  }

  const persistedLetterFileUrl = await persistMaybeDataUrl({
    value: fileUrl,
    folder: `applications/${String(application._id)}/admission-letters`,
    preferredName: fileName || `admission-letter-${String(letterNumber || "issued")}`,
  });

  application.admissionLetter = {
    issued: true,
    letterNumber: String(letterNumber).trim(),
    fileUrl: String(persistedLetterFileUrl || "").trim(),
    fileName: String(fileName || "").trim(),
    remarks: String(remarks || ""),
    sentToStudent: Boolean(sentToStudent),
    uploadedAt: new Date(),
    uploadedBy: req.user._id,
    sentAt: sentToStudent ? new Date() : null,
  };
  application.status = "finalized";
  await application.save();

  let letterEmailDelivery = { sent: false, reason: "" };
  try {
    letterEmailDelivery = await sendAdmissionLetterIssuedEmail({
      to: application.email,
      studentName: application.studentName,
      universityName: req.user?.name || "University",
      applicationCode: application.applicationCode,
      program: application.program,
      letterNumber: application.admissionLetter?.letterNumber,
      fileUrl: application.admissionLetter?.fileUrl,
      fileName: application.admissionLetter?.fileName,
    });
  } catch (emailError) {
    letterEmailDelivery = {
      sent: false,
      reason: emailError?.message || "Failed to send admission letter email.",
    };
  }

  emitDataUpdate({
    resource: "applications",
    action: "updated",
    userIds: [String(application.student), String(application.university)],
    payload: {
      applicationId: String(application._id),
      universityId: String(application.university),
      status: application.status,
      letterIssued: true,
    },
  });

  return res.status(200).json({
    success: true,
    message: "Admission letter uploaded successfully.",
    data: { application, emailDelivery: letterEmailDelivery },
  });
});

module.exports = {
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
};
