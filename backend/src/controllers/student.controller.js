const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const UniversityProfile = require("../models/UniversityProfile");
const RecommendationSnapshot = require("../models/RecommendationSnapshot");
const env = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { getCache, setCache } = require("../utils/cacheClient");
const { persistMaybeDataUrl } = require("../utils/fileStorage");
const {
  isNumberInRange,
  isValidCnic,
  isValidEmail,
  isValidName,
  isValidPhone,
} = require("../utils/validators");
const { ROLES, UNIVERSITY_APPROVAL, USER_STATUS } = require("../constants/roles");

const UNIVERSITY_RECOMMENDATION_DATASET_CACHE_KEY = "recommendations:universities:dataset:v2";
const SNAPSHOT_CACHE_VERSION = 3;

const formatReadableDate = (value) => {
  if (!value) return "Not announced";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not announced";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const hasDeadlinePassed = (value) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  date.setHours(23, 59, 59, 999);
  return date.getTime() < Date.now();
};

const normalizeStringArray = (value) =>
  (Array.isArray(value) ? value : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

const areStringArraysEqual = (a = [], b = []) => {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
};

const buildProfileBasis = (studentProfile) => ({
  cacheVersion: SNAPSHOT_CACHE_VERSION,
  studentAggregate: Math.max(
    Number(studentProfile?.interPercentage || 0),
    Number(studentProfile?.matricPercentage || 0),
  ),
  preferredPrograms: normalizeStringArray(studentProfile?.preferredPrograms),
  preferredCities: normalizeStringArray(studentProfile?.preferredCities),
});

const hasRecommendationSnapshotExpired = (snapshotGeneratedAt, ttlMs) => {
  if (!snapshotGeneratedAt) return true;
  const snapshotTime = new Date(snapshotGeneratedAt).getTime();
  if (Number.isNaN(snapshotTime)) return true;
  return Date.now() - snapshotTime > ttlMs;
};

const canReuseSnapshotRecommendations = ({ snapshot, profileBasis, studentProfileUpdatedAt }) => {
  if (!snapshot) return false;
  if (Number(snapshot?.profileBasis?.cacheVersion || 0) !== SNAPSHOT_CACHE_VERSION) {
    return false;
  }

  if (
    hasRecommendationSnapshotExpired(
      snapshot.generatedAt || snapshot.updatedAt,
      env.recommendationsCacheTtlMs,
    )
  ) {
    return false;
  }

  if (
    studentProfileUpdatedAt &&
    snapshot.generatedAt &&
    new Date(studentProfileUpdatedAt).getTime() > new Date(snapshot.generatedAt).getTime()
  ) {
    return false;
  }

  const snapshotBasis = snapshot.profileBasis || {};
  return (
    Number(snapshotBasis.studentAggregate || 0) === Number(profileBasis.studentAggregate || 0) &&
    areStringArraysEqual(
      normalizeStringArray(snapshotBasis.preferredPrograms),
      profileBasis.preferredPrograms,
    ) &&
    areStringArraysEqual(
      normalizeStringArray(snapshotBasis.preferredCities),
      profileBasis.preferredCities,
    )
  );
};

const filterRecommendationsByRequest = ({ recommendations = [], minAggregate, maxFee, typeFilter }) =>
  recommendations
    .map((item) => {
      const allProgramRecommendations = Array.isArray(item?.programRecommendations)
        ? item.programRecommendations
        : [];
      const filteredPrograms = allProgramRecommendations
        .filter((program) =>
          minAggregate === null || Number(program?.requiredAggregate || 0) <= minAggregate,
        )
        .sort((a, b) => Number(b?.matchScore || 0) - Number(a?.matchScore || 0));

      if (filteredPrograms.length === 0) {
        return null;
      }

      const requiredAggregate = Math.min(
        ...filteredPrograms.map((program) => Number(program?.requiredAggregate || 0)),
      );
      const feeRange =
        filteredPrograms.find((program) => String(program?.feeRange || "").trim())?.feeRange ||
        "Contact university";
      const matchScore = Math.max(
        ...filteredPrograms.map((program) => Number(program?.matchScore || 0)),
      );
      const earliestProgramDeadline = filteredPrograms
        .map((program) => program?.deadlineDate)
        .filter(Boolean)
        .map((value) => new Date(value))
        .filter((date) => !Number.isNaN(date.getTime()))
        .sort((a, b) => a - b)[0] || null;

      return {
        ...item,
        programs: filteredPrograms.map((program) => program.name),
        programRecommendations: filteredPrograms,
        requiredAggregate,
        feeRange,
        matchScore,
        deadline: formatReadableDate(earliestProgramDeadline || item?.applicationEndDate || null),
      };
    })
    .filter(Boolean)
    .filter((item) => (typeFilter === "all" ? true : String(item?.type || "").toLowerCase() === typeFilter))
    .filter((item) => Number(item?.applicationFee || 0) <= maxFee)
    .sort((a, b) => Number(b?.matchScore || 0) - Number(a?.matchScore || 0));

const loadUniversityRecommendationDataset = async () => {
  const cached = await getCache(UNIVERSITY_RECOMMENDATION_DATASET_CACHE_KEY);
  if (cached) {
    return {
      universities: Array.isArray(cached.universities) ? cached.universities : [],
      profileLookup: cached.profileLookup && typeof cached.profileLookup === "object"
        ? cached.profileLookup
        : {},
    };
  }

  const universities = await User.find({
    role: ROLES.UNIVERSITY,
    approvalStatus: UNIVERSITY_APPROVAL.APPROVED,
    status: USER_STATUS.ACTIVE,
  })
    .select("name location programsOffered")
    .lean();

  const universityIds = universities.map((item) => item._id);
  const profiles = await UniversityProfile.find({
    university: { $in: universityIds },
  })
    .select(
      "university universityName city type applicationFee applicationEndDate programs logo representativeName representativeProfilePicture"
    )
    .lean();

  const profileLookup = Object.fromEntries(
    profiles.map((item) => [String(item.university), item])
  );
  const dataset = {
    universities,
    profileLookup,
  };

  await setCache(UNIVERSITY_RECOMMENDATION_DATASET_CACHE_KEY, dataset, env.apiCacheTtlMs);
  return dataset;
};

const getMyProfile = asyncHandler(async (req, res) => {
  let profile = await StudentProfile.findOne({ user: req.user._id });

  if (!profile) {
    profile = await StudentProfile.create({
      user: req.user._id,
      fullName: req.user.name,
      email: req.user.email,
    });
  }

  return res.status(200).json({
    success: true,
    data: { profile },
  });
});

const updateMyProfile = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  delete payload.user;
  delete payload._id;

  if (Object.prototype.hasOwnProperty.call(payload, "fullName")) {
    payload.fullName = String(payload.fullName || "").trim();
    if (!isValidName(payload.fullName)) {
      throw new ApiError(400, "Enter a valid full name.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "fatherName")) {
    payload.fatherName = String(payload.fatherName || "").trim();
    if (payload.fatherName && !isValidName(payload.fatherName)) {
      throw new ApiError(400, "Enter a valid father's name.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "email")) {
    payload.email = String(payload.email || "").trim().toLowerCase();
    if (payload.email && !isValidEmail(payload.email)) {
      throw new ApiError(400, "Enter a valid email address.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "phone")) {
    payload.phone = String(payload.phone || "").trim();
    if (payload.phone && !isValidPhone(payload.phone)) {
      throw new ApiError(400, "Enter a valid Pakistani mobile number.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "alternatePhone")) {
    payload.alternatePhone = String(payload.alternatePhone || "").trim();
    if (payload.alternatePhone && !isValidPhone(payload.alternatePhone)) {
      throw new ApiError(400, "Enter a valid alternate Pakistani mobile number.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "cnic")) {
    payload.cnic = String(payload.cnic || "").trim();
    if (payload.cnic && !isValidCnic(payload.cnic)) {
      throw new ApiError(400, "Enter a valid CNIC or B-form number.");
    }
  }

  const marksChecks = [
    ["Matric total marks", payload.matricTotalMarks, 1, 2000],
    ["Matric obtained marks", payload.matricObtainedMarks, 0, Number(payload.matricTotalMarks || 2000)],
    ["Intermediate total marks", payload.interTotalMarks, 1, 2000],
    ["Intermediate obtained marks", payload.interObtainedMarks, 0, Number(payload.interTotalMarks || 2000)],
  ];

  const invalidMarks = marksChecks.find(
    ([, value, min, max]) =>
      value !== undefined && String(value || "").trim() && !isNumberInRange(value, min, max)
  );
  if (invalidMarks) {
    throw new ApiError(400, `${invalidMarks[0]} must be a valid number within the allowed range.`);
  }

  const fileFieldMap = {
    profilePicture: "profile-picture",
    domicileDocument: "domicile-document",
    matricResultDocument: "matric-result",
    interResultDocument: "inter-result",
  };

  const fileFieldEntries = Object.entries(fileFieldMap);
  for (const [field, preferredName] of fileFieldEntries) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) {
      continue;
    }

    payload[field] = await persistMaybeDataUrl({
      value: payload[field],
      folder: `student-profiles/${String(req.user._id)}`,
      preferredName,
    });
  }

  const profile = await StudentProfile.findOneAndUpdate(
    { user: req.user._id },
    { $set: payload, $setOnInsert: { user: req.user._id } },
    { new: true, upsert: true, runValidators: true }
  );

  return res.status(200).json({
    success: true,
    message: "Student profile updated successfully.",
    data: { profile },
  });
});

const getRecommendations = asyncHandler(async (req, res) => {
  const minAggregate = req.query.minAggregate ? Number(req.query.minAggregate) : null;
  const maxFee = Number(req.query.maxFee || Number.MAX_SAFE_INTEGER);
  const typeFilter = (req.query.type || "all").toLowerCase();
  const studentProfile = await StudentProfile.findOne({ user: req.user._id })
    .select("interPercentage matricPercentage preferredPrograms preferredCities updatedAt")
    .lean();
  const profileBasis = buildProfileBasis(studentProfile);

  const snapshot = await RecommendationSnapshot.findOne({ student: req.user._id })
    .select("recommendations profileBasis generatedAt updatedAt")
    .lean();

  if (
    canReuseSnapshotRecommendations({
      snapshot,
      profileBasis,
      studentProfileUpdatedAt: studentProfile?.updatedAt || null,
    })
  ) {
    const recommendations = filterRecommendationsByRequest({
      recommendations: snapshot.recommendations || [],
      minAggregate,
      maxFee,
      typeFilter,
    });

    return res.status(200).json({
      success: true,
      data: {
        recommendations,
        profileBasis,
      },
    });
  }

  const { universities, profileLookup } = await loadUniversityRecommendationDataset();
  const studentAggregate = Number(profileBasis.studentAggregate || 0);
  const preferredPrograms = profileBasis.preferredPrograms;
  const preferredCities = profileBasis.preferredCities;

  const allRecommendations = universities
    .map((uni) => {
      const profile = profileLookup[String(uni._id)];
      const programsFromProfile = Array.isArray(profile?.programs) ? profile.programs : [];
      const parsedProgramsFromRegistration = String(uni.programsOffered || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const rawProgramEntries =
        programsFromProfile.length > 0
          ? programsFromProfile.map((item) => ({
              name: String(item?.name || "").trim(),
              requiredAggregate: Number(item?.requiredAggregate || 0),
              feeRange: String(item?.feeRange || "").trim(),
              seats: Number(item?.seats || 0),
              deadlineDate: item?.deadlineDate || null,
            isAdmissionOpen: item?.isAdmissionOpen !== false && !hasDeadlinePassed(item?.deadlineDate),
            }))
          : parsedProgramsFromRegistration.map((name) => ({
              name,
              requiredAggregate: 0,
              feeRange: "Contact university",
              seats: 0,
              deadlineDate: null,
              isAdmissionOpen: true,
            }));

      const uniqueProgramMap = new Map();
      rawProgramEntries.forEach((program) => {
        if (!program.name) return;
        const key = program.name.toLowerCase();
        if (!uniqueProgramMap.has(key)) {
          uniqueProgramMap.set(key, program);
        }
      });

      const cityBonus = profile?.city && preferredCities.includes(profile.city) ? 5 : 0;

      const programRecommendations = Array.from(uniqueProgramMap.values())
        .map((program) => {
          let matchScore = 70;
          if (studentAggregate > 0) {
            if (studentAggregate >= program.requiredAggregate) {
              matchScore += 20;
            } else {
              matchScore -= Math.min(20, program.requiredAggregate - studentAggregate);
            }
          }

          matchScore += cityBonus;

          if (preferredPrograms.includes(program.name)) {
            matchScore += 5;
          }

          return {
            name: program.name,
            requiredAggregate: Number(program.requiredAggregate || 0),
            seats: Number(program.seats || 0),
            feeRange: program.feeRange || "Contact university",
            matchScore: Math.max(0, Math.min(100, Math.round(matchScore))),
            deadlineDate: program.deadlineDate || null,
            deadline: formatReadableDate(program.deadlineDate),
            isAdmissionOpen: program.isAdmissionOpen !== false && !hasDeadlinePassed(program.deadlineDate),
          };
        })
        .sort((a, b) => b.matchScore - a.matchScore);

      if (programRecommendations.length === 0) {
        return null;
      }

      const requiredAggregate = Math.min(
        ...programRecommendations.map((item) => Number(item.requiredAggregate || 0))
      );
      const feeRange =
        programRecommendations.find((item) => String(item.feeRange || "").trim())?.feeRange ||
        "Contact university";
      const matchScore = Math.max(
        ...programRecommendations.map((item) => Number(item.matchScore || 0))
      );
      const programDeadlineValues = programRecommendations
        .map((item) => item?.deadlineDate)
        .filter(Boolean)
        .map((value) => new Date(value))
        .filter((date) => !Number.isNaN(date.getTime()))
        .sort((a, b) => a - b);
      const earliestProgramDeadline = programDeadlineValues[0] || null;

      return {
        id: uni._id,
        name: profile?.universityName || uni.name,
        location: profile?.city || uni.location || "Pakistan",
        programs: programRecommendations.map((item) => item.name),
        programRecommendations,
        feeRange,
        requiredAggregate,
        deadline: formatReadableDate(earliestProgramDeadline || profile?.applicationEndDate || null),
        applicationEndDate: profile?.applicationEndDate || null,
        matchScore,
        type: profile?.type || "public",
        applicationFee: Number(profile?.applicationFee || 0),
        logo: profile?.logo || "",
        representativeName: profile?.representativeName || "",
        representativeProfilePicture: profile?.representativeProfilePicture || "",
      };
    })
    .filter(Boolean);

  const recommendations = filterRecommendationsByRequest({
    recommendations: allRecommendations,
    minAggregate,
    maxFee,
    typeFilter,
  });

  await RecommendationSnapshot.findOneAndUpdate(
    { student: req.user._id },
    {
      $set: {
        recommendations: allRecommendations,
        profileBasis,
        generatedAt: new Date(),
      },
      $setOnInsert: {
        student: req.user._id,
      },
    },
    { upsert: true, new: true }
  );

  return res.status(200).json({
    success: true,
    data: {
      recommendations,
      profileBasis,
    },
  });
});

const ensureStudentRole = asyncHandler(async (req, _res, next) => {
  if (req.user.role !== ROLES.STUDENT) {
    throw new ApiError(403, "Only students can access this endpoint.");
  }
  next();
});

module.exports = {
  ensureStudentRole,
  getMyProfile,
  updateMyProfile,
  getRecommendations,
};
