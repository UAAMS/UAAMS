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

const UNIVERSITY_RECOMMENDATION_DATASET_CACHE_KEY = "recommendations:universities:dataset:v3";
const SNAPSHOT_CACHE_VERSION = 4;

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
  matricPercentage: Number(studentProfile?.matricPercentage || 0),
  interPercentage: Number(studentProfile?.interPercentage || 0),
  studentAggregate: Math.max(
    Number(studentProfile?.interPercentage || 0),
    Number(studentProfile?.matricPercentage || 0),
  ),
  preferredPrograms: normalizeStringArray(studentProfile?.preferredPrograms),
  preferredCities: normalizeStringArray(studentProfile?.preferredCities),
});

const calculatePercentage = (obtainedMarks, totalMarks) => {
  const obtained = Number(obtainedMarks || 0);
  const total = Number(totalMarks || 0);
  if (!obtained || !total || total <= 0) return 0;
  return Number(((obtained / total) * 100).toFixed(2));
};

const resolveAcademicPercentage = (profile, percentageKey, obtainedKey, totalKey) => {
  const storedPercentage = Number(profile?.[percentageKey] || 0);
  if (storedPercentage > 0) return storedPercentage;
  return calculatePercentage(profile?.[obtainedKey], profile?.[totalKey]);
};

const normalizeLookupText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const findMatchingProgram = (programs = [], rawProgramName = "", rawProgramId = "") => {
  const normalizedProgramId = String(rawProgramId || "").trim();
  const normalizedProgramName = normalizeLookupText(rawProgramName);
  if (!Array.isArray(programs) || programs.length === 0) return null;

  if (normalizedProgramId) {
    const byId = programs.find((program) => String(program?._id || "") === normalizedProgramId);
    if (byId) return byId;
  }

  if (!normalizedProgramName) return null;

  return (
    programs.find((program) => normalizeLookupText(program?.name) === normalizedProgramName) ||
    programs.find((program) => {
      const programName = normalizeLookupText(program?.name);
      return programName && (normalizedProgramName.includes(programName) || programName.includes(normalizedProgramName));
    }) ||
    null
  );
};

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
    Number(snapshotBasis.matricPercentage || 0) === Number(profileBasis.matricPercentage || 0) &&
    Number(snapshotBasis.interPercentage || 0) === Number(profileBasis.interPercentage || 0) &&
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

const filterRecommendationsByRequest = ({ recommendations = [], maxFee, typeFilter }) =>
  recommendations
    .map((item) => {
      const allProgramRecommendations = Array.isArray(item?.programRecommendations)
        ? item.programRecommendations
        : [];
      const filteredPrograms = allProgramRecommendations
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
      "university universityName city type applicationFee minimumFscPercentage minimumMatricPercentage applicationEndDate programs logo representativeName representativeProfilePicture"
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

const enrichModelRecommendationsForApplication = async (recommendations = []) => {
  if (!Array.isArray(recommendations) || recommendations.length === 0) return [];

  const { universities, profileLookup } = await loadUniversityRecommendationDataset();
  const profileEntries = Object.entries(profileLookup || {});
  const universityNameLookup = new Map(
    universities.map((university) => [String(university._id), university.name || ""]),
  );

  return recommendations.map((item) => {
    const rawUniversityId = String(item?.university_id || "").trim();
    const rawProgramId = String(item?.mongo_id || "").trim();
    const rawProgramName = String(item?.program_name || item?.program || "").trim();
    const rawCampus = normalizeLookupText(item?.campus);

    let matchedUniversityId = "";
    let matchedProfile = null;
    let matchedProgram = null;

    if (rawUniversityId && profileLookup[rawUniversityId]) {
      matchedUniversityId = rawUniversityId;
      matchedProfile = profileLookup[rawUniversityId];
      matchedProgram = findMatchingProgram(matchedProfile?.programs, rawProgramName, rawProgramId);
    }

    if (!matchedProfile && rawProgramId) {
      const entry = profileEntries.find(([, profile]) =>
        findMatchingProgram(profile?.programs, rawProgramName, rawProgramId),
      );
      if (entry) {
        [matchedUniversityId, matchedProfile] = entry;
        matchedProgram = findMatchingProgram(matchedProfile?.programs, rawProgramName, rawProgramId);
      }
    }

    if (!matchedProfile && (rawProgramName || rawCampus)) {
      const entry = profileEntries.find(([, profile]) => {
        const profileName = normalizeLookupText(profile?.universityName);
        const userName = normalizeLookupText(universityNameLookup.get(String(profile?.university)));
        const campusMatches =
          rawCampus &&
          ((profileName && (profileName.includes(rawCampus) || rawCampus.includes(profileName))) ||
            (userName && (userName.includes(rawCampus) || rawCampus.includes(userName))));
        return campusMatches || findMatchingProgram(profile?.programs, rawProgramName, rawProgramId);
      });
      if (entry) {
        [matchedUniversityId, matchedProfile] = entry;
        matchedProgram = findMatchingProgram(matchedProfile?.programs, rawProgramName, rawProgramId);
      }
    }

    if (!matchedProfile || !matchedProgram) {
      return {
        ...item,
        university_id: matchedUniversityId || rawUniversityId,
        apply_program_name: rawProgramName,
        can_apply: Boolean(matchedUniversityId || rawUniversityId) && Boolean(rawProgramName),
      };
    }

    return {
      ...item,
      university_id: matchedUniversityId,
      university_name: matchedProfile?.universityName || universityNameLookup.get(matchedUniversityId) || "",
      apply_program_name: matchedProgram.name,
      can_apply: matchedProgram.isAdmissionOpen !== false && !hasDeadlinePassed(matchedProgram.deadlineDate),
    };
  });
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

  // If fullName is updated, also update the User model's name for consistency
  if (Object.prototype.hasOwnProperty.call(payload, "fullName") && payload.fullName) {
    await User.findByIdAndUpdate(req.user._id, { name: payload.fullName }, { runValidators: true });
  }

  return res.status(200).json({
    success: true,
    message: "Student profile updated successfully.",
    data: { profile },
  });
});

const getRecommendations = asyncHandler(async (req, res) => {
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
              minimumFscPercentage: Number(profile?.minimumFscPercentage || 0),
              minimumMatricPercentage: Number(profile?.minimumMatricPercentage || 0),
              feeRange: String(item?.feeRange || "").trim(),
              seats: Number(item?.seats || 0),
              deadlineDate: item?.deadlineDate || null,
            isAdmissionOpen: item?.isAdmissionOpen !== false && !hasDeadlinePassed(item?.deadlineDate),
            }))
          : parsedProgramsFromRegistration.map((name) => ({
              name,
              requiredAggregate: 0,
              minimumFscPercentage: Number(profile?.minimumFscPercentage || 0),
              minimumMatricPercentage: Number(profile?.minimumMatricPercentage || 0),
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
            minimumFscPercentage: Number(program.minimumFscPercentage || 0),
            minimumMatricPercentage: Number(program.minimumMatricPercentage || 0),
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
        minimumFscPercentage: Number(profile?.minimumFscPercentage || 0),
        minimumMatricPercentage: Number(profile?.minimumMatricPercentage || 0),
        logo: profile?.logo || "",
        representativeName: profile?.representativeName || "",
        representativeProfilePicture: profile?.representativeProfilePicture || "",
      };
    })
    .filter(Boolean);

  const recommendations = filterRecommendationsByRequest({
    recommendations: allRecommendations,
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

const getModelRecommendations = asyncHandler(async (req, res) => {
  const studentProfile = await StudentProfile.findOne({ user: req.user._id })
    .select(
      "matricPercentage matricObtainedMarks matricTotalMarks interPercentage interObtainedMarks interTotalMarks updatedAt"
    )
    .lean();

  const matric = resolveAcademicPercentage(
    studentProfile,
    "matricPercentage",
    "matricObtainedMarks",
    "matricTotalMarks",
  );
  const fsc = resolveAcademicPercentage(
    studentProfile,
    "interPercentage",
    "interObtainedMarks",
    "interTotalMarks",
  );

  if (!matric || !fsc) {
    return res.status(200).json({
      success: true,
      data: {
        recommendations: [],
        userInput: { matric, fsc },
        summary: null,
        message: "Add matric and intermediate marks in your profile to see model recommendations.",
      },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.recommendationModelTimeoutMs);

  try {
    const modelResponse = await fetch(
      `${String(env.recommendationModelUrl).replace(/\/$/, "")}/recommend`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matric, fsc, k: 4 }),
        signal: controller.signal,
      },
    );

    const payload = await modelResponse.json().catch(() => ({}));
    if (!modelResponse.ok) {
      throw new ApiError(
        modelResponse.status,
        payload?.error || "Unable to load model recommendations.",
      );
    }

    const recommendations = await enrichModelRecommendationsForApplication(
      Array.isArray(payload?.recommendations) ? payload.recommendations : [],
    );

    return res.status(200).json({
      success: true,
      data: {
        recommendations,
        userInput: payload?.user_input || { matric, fsc },
        estimationFormula: payload?.estimation_formula || "",
        summary: payload?.summary || null,
        modelStatus: payload?.status || "success",
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    const message =
      error?.name === "AbortError"
        ? "Recommendation model request timed out."
        : "Recommendation model service is not available. Start the Flask model server on port 4000.";
    throw new ApiError(503, message);
  } finally {
    clearTimeout(timeout);
  }
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
  getModelRecommendations,
};
