const User = require("../models/User");
const StudentProfile = require("../models/StudentProfile");
const UniversityProfile = require("../models/UniversityProfile");
const Application = require("../models/Application");
const { getStructuredStore } = require("./store");

const asString = (value) => (value === null || value === undefined ? "" : String(value));

const toRoleLabel = (roleKey) => {
  const key = asString(roleKey).toLowerCase();
  if (key === "admin") return "Admin";
  if (key === "student") return "Student";
  if (key === "university") return "University Representative";
  if (key === "blogger") return "Blogger";
  return "User";
};

const ensureStoreReady = () => {
  const store = getStructuredStore();
  if (!store.enabled || !store.ready || !store.models) return null;
  return store;
};

const upsertRoleIfMissing = async (models, roleKey, transaction) => {
  const key = asString(roleKey).toLowerCase();
  if (!key) return;
  await models.Role.upsert(
    {
      key,
      label: toRoleLabel(key),
    },
    { transaction }
  );
};

const upsertStructuredUserById = async (userId, { transaction } = {}) => {
  const store = ensureStoreReady();
  if (!store) return;
  const { models } = store;

  const user = await User.findById(userId)
    .select("+emailVerificationTokenHash +passwordResetOtpHash")
    .lean();

  if (!user) {
    await models.StructuredUser.destroy({
      where: { id: asString(userId) },
      transaction,
    });
    return;
  }

  const roleKey = asString(user.role).toLowerCase();
  await upsertRoleIfMissing(models, roleKey, transaction);

  await models.StructuredUser.upsert(
    {
      id: asString(user._id),
      name: asString(user.name),
      email: asString(user.email).toLowerCase(),
      username: user.username ? asString(user.username).toLowerCase() : null,
      roleKey,
      approvalStatus: asString(user.approvalStatus || "approved"),
      status: asString(user.status || "active"),
      representativeName: asString(user.representativeName),
      phone: asString(user.phone),
      profilePicture: asString(user.profilePicture),
      managedUniversityId: user.managedUniversity ? asString(user.managedUniversity) : null,
      lastLoginAt: user.lastLoginAt || null,
      emailVerified: Boolean(user.emailVerified),
      createdAtMongo: user.createdAt || null,
      updatedAtMongo: user.updatedAt || null,
    },
    { transaction }
  );
};

const upsertStructuredStudentProfileByUserId = async (userId, { transaction } = {}) => {
  const store = ensureStoreReady();
  if (!store) return;
  const { models } = store;
  const id = asString(userId);

  const profile = await StudentProfile.findOne({ user: userId }).lean();
  if (!profile) {
    await models.StructuredStudentProfile.destroy({ where: { userId: id }, transaction });
    return;
  }

  await upsertStructuredUserById(id, { transaction });

  await models.StructuredStudentProfile.upsert(
    {
      userId: id,
      fullName: asString(profile.fullName),
      fatherName: asString(profile.fatherName),
      cnic: asString(profile.cnic),
      dateOfBirth: asString(profile.dateOfBirth),
      gender: asString(profile.gender || "male"),
      bloodGroup: asString(profile.bloodGroup),
      religion: asString(profile.religion || "Islam"),
      nationality: asString(profile.nationality || "Pakistani"),
      email: asString(profile.email).toLowerCase(),
      phone: asString(profile.phone),
      alternatePhone: asString(profile.alternatePhone),
      address: asString(profile.address),
      city: asString(profile.city),
      province: asString(profile.province),
      postalCode: asString(profile.postalCode),
      matricBoard: asString(profile.matricBoard),
      matricRollNo: asString(profile.matricRollNo),
      matricYear: asString(profile.matricYear),
      matricTotalMarks: Number(profile.matricTotalMarks || 0),
      matricObtainedMarks: Number(profile.matricObtainedMarks || 0),
      matricPercentage: Number(profile.matricPercentage || 0),
      interBoard: asString(profile.interBoard),
      interRollNo: asString(profile.interRollNo),
      interYear: asString(profile.interYear),
      interTotalMarks: Number(profile.interTotalMarks || 0),
      interObtainedMarks: Number(profile.interObtainedMarks || 0),
      interPercentage: Number(profile.interPercentage || 0),
      interGroup: asString(profile.interGroup),
      preferredPrograms: Array.isArray(profile.preferredPrograms) ? profile.preferredPrograms : [],
      preferredCities: Array.isArray(profile.preferredCities) ? profile.preferredCities : [],
      achievements: asString(profile.achievements),
      extraCurricular: asString(profile.extraCurricular),
      updatedAtMongo: profile.updatedAt || null,
    },
    { transaction }
  );
};

const upsertStructuredUniversityByUserId = async (userId, { transaction } = {}) => {
  const store = ensureStoreReady();
  if (!store) return;
  const { models } = store;
  const id = asString(userId);

  const profile = await UniversityProfile.findOne({ university: userId }).lean();
  if (!profile) {
    await models.StructuredProgram.destroy({ where: { universityId: id }, transaction });
    await models.StructuredUniversity.destroy({ where: { userId: id }, transaction });
    return;
  }

  await upsertStructuredUserById(id, { transaction });

  await models.StructuredUniversity.upsert(
    {
      userId: id,
      universityName: asString(profile.universityName),
      shortName: asString(profile.shortName),
      type: asString(profile.type || "public"),
      established: asString(profile.established),
      email: asString(profile.email).toLowerCase(),
      phone: asString(profile.phone),
      website: asString(profile.website),
      address: asString(profile.address),
      city: asString(profile.city),
      province: asString(profile.province),
      postalCode: asString(profile.postalCode),
      about: asString(profile.about),
      mission: asString(profile.mission),
      vision: asString(profile.vision),
      totalStudents: asString(profile.totalStudents),
      totalPrograms: asString(profile.totalPrograms),
      ranking: asString(profile.ranking),
      accreditation: asString(profile.accreditation || "HEC"),
      representativeName: asString(profile.representativeName),
      representativePosition: asString(profile.representativePosition),
      representativeEmail: asString(profile.representativeEmail),
      representativePhone: asString(profile.representativePhone),
      representativeProfilePicture: asString(profile.representativeProfilePicture),
      logo: asString(profile.logo),
      applicationFee: Number(profile.applicationFee || 0),
      applicationStartDate: profile.applicationStartDate || null,
      applicationEndDate: profile.applicationEndDate || null,
      acceptApplicationsThroughUaams: profile.acceptApplicationsThroughUaams !== false,
      allowAutoFillFromStudentProfile: profile.allowAutoFillFromStudentProfile !== false,
      notifications:
        profile.notifications && typeof profile.notifications === "object"
          ? profile.notifications
          : {
              emailOnNewApplication: true,
              dailySummary: true,
              smsUrgentUpdates: false,
            },
      updatedAtMongo: profile.updatedAt || null,
    },
    { transaction }
  );

  await models.StructuredProgram.destroy({ where: { universityId: id }, transaction });
  const programs = Array.isArray(profile.programs) ? profile.programs : [];
  if (programs.length > 0) {
    await models.StructuredProgram.bulkCreate(
      programs.map((program) => ({
        universityId: id,
        mongoProgramId: program?._id ? asString(program._id) : null,
        name: asString(program?.name),
        seats: Number(program?.seats || 0),
        feeRange: asString(program?.feeRange),
        requiredAggregate: Number(program?.requiredAggregate || 0),
        deadlineDate: program?.deadlineDate || null,
        isAdmissionOpen: program?.isAdmissionOpen !== false,
      })),
      { transaction }
    );
  }
};

const upsertStructuredApplicationById = async (applicationId, { transaction } = {}) => {
  const store = ensureStoreReady();
  if (!store) return;
  const { models } = store;
  const id = asString(applicationId);

  const application = await Application.findById(applicationId).lean();
  if (!application) {
    await models.StructuredPayment.destroy({ where: { applicationId: id }, transaction });
    await models.StructuredApplication.destroy({ where: { id }, transaction });
    return;
  }

  await upsertStructuredUserById(application.student, { transaction });
  await upsertStructuredUserById(application.university, { transaction });

  await models.StructuredApplication.upsert(
    {
      id,
      applicationCode: asString(application.applicationCode),
      studentId: asString(application.student),
      universityId: asString(application.university),
      studentName: asString(application.studentName),
      email: asString(application.email).toLowerCase(),
      cnic: asString(application.cnic),
      program: asString(application.program),
      formData: application.formData && typeof application.formData === "object" ? application.formData : {},
      aggregate: Number(application.aggregate || 0),
      matricMarks: Number(application.matricMarks || 0),
      interMarks: Number(application.interMarks || 0),
      testScore: Number(application.testScore || 0),
      status: asString(application.status || "not-submitted"),
      eligibleForAdmissionLetter: Boolean(application.eligibleForAdmissionLetter),
      meritPosition:
        application.meritPosition === null || application.meritPosition === undefined
          ? null
          : Number(application.meritPosition),
      meritListNumber:
        application.meritListNumber === null || application.meritListNumber === undefined
          ? null
          : Number(application.meritListNumber),
      appliedAt: application.appliedAt || application.createdAt || null,
      updatedAtMongo: application.updatedAt || null,
    },
    { transaction }
  );

  const payment = application.payment || {};
  await models.StructuredPayment.upsert(
    {
      applicationId: id,
      status: asString(payment.status || "unpaid"),
      amount: Number(payment.amount || 0),
      method: asString(payment.method || "card"),
      accountLast4: asString(payment.accountLast4 || ""),
      transactionReference: asString(payment.transactionReference || ""),
      paidAt: payment.paidAt || null,
      updatedAtMongo: application.updatedAt || null,
    },
    { transaction }
  );
};

const deleteStructuredUserById = async (userId, { transaction } = {}) => {
  const store = ensureStoreReady();
  if (!store) return;
  const id = asString(userId);
  const { models } = store;

  const studentApplications = await models.StructuredApplication.findAll({
    where: { studentId: id },
    attributes: ["id"],
    transaction,
  });
  const universityApplications = await models.StructuredApplication.findAll({
    where: { universityId: id },
    attributes: ["id"],
    transaction,
  });
  const appIds = [...studentApplications, ...universityApplications].map((item) => item.id);

  if (appIds.length > 0) {
    await models.StructuredPayment.destroy({
      where: { applicationId: appIds },
      transaction,
    });
  }

  if (appIds.length > 0) {
    await models.StructuredApplication.destroy({
      where: {
        id: appIds,
      },
      transaction,
    });
  }

  await models.StructuredProgram.destroy({ where: { universityId: id }, transaction });
  await models.StructuredUniversity.destroy({ where: { userId: id }, transaction });
  await models.StructuredStudentProfile.destroy({ where: { userId: id }, transaction });

  await models.StructuredUser.destroy({
    where: { id },
    transaction,
  });
};

const deleteStructuredStudentProfileByUserId = async (userId, { transaction } = {}) => {
  const store = ensureStoreReady();
  if (!store) return;
  await store.models.StructuredStudentProfile.destroy({
    where: { userId: asString(userId) },
    transaction,
  });
};

const deleteStructuredUniversityByUserId = async (userId, { transaction } = {}) => {
  const store = ensureStoreReady();
  if (!store) return;
  const id = asString(userId);
  await store.models.StructuredProgram.destroy({ where: { universityId: id }, transaction });
  await store.models.StructuredUniversity.destroy({
    where: { userId: id },
    transaction,
  });
};

const deleteStructuredApplicationById = async (applicationId, { transaction } = {}) => {
  const store = ensureStoreReady();
  if (!store) return;
  const id = asString(applicationId);
  await store.models.StructuredPayment.destroy({ where: { applicationId: id }, transaction });
  await store.models.StructuredApplication.destroy({
    where: { id },
    transaction,
  });
};

const syncStructuredEntity = async ({ entityType, entityId, action = "upsert" }) => {
  const store = ensureStoreReady();
  if (!store) return;

  await store.sequelize.transaction(async (transaction) => {
    if (entityType === "user") {
      if (action === "delete") {
        await deleteStructuredUserById(entityId, { transaction });
      } else {
        await upsertStructuredUserById(entityId, { transaction });
      }
      return;
    }

    if (entityType === "studentProfile") {
      if (action === "delete") {
        await deleteStructuredStudentProfileByUserId(entityId, { transaction });
      } else {
        await upsertStructuredStudentProfileByUserId(entityId, { transaction });
      }
      return;
    }

    if (entityType === "universityProfile") {
      if (action === "delete") {
        await deleteStructuredUniversityByUserId(entityId, { transaction });
      } else {
        await upsertStructuredUniversityByUserId(entityId, { transaction });
      }
      return;
    }

    if (entityType === "application") {
      if (action === "delete") {
        await deleteStructuredApplicationById(entityId, { transaction });
      } else {
        await upsertStructuredApplicationById(entityId, { transaction });
      }
    }
  });
};

module.exports = {
  syncStructuredEntity,
  upsertStructuredUserById,
  upsertStructuredStudentProfileByUserId,
  upsertStructuredUniversityByUserId,
  upsertStructuredApplicationById,
};
