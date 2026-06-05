const { DataTypes, Sequelize } = require("sequelize");
const env = require("../config/env");
const { ROLES } = require("../constants/roles");

const state = {
  enabled: false,
  ready: false,
  sequelize: null,
  models: null,
  lastError: "",
};

const buildSequelize = () =>
  new Sequelize(env.pgDatabase, env.pgUser, env.pgPassword, {
    host: env.pgHost,
    port: Number(env.pgPort),
    dialect: "postgres",
    logging: env.psqlLogQueries ? console.log : false,
    dialectOptions: env.pgSsl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
  });

const defineModels = (sequelize) => {
  const Role = sequelize.define(
    "Role",
    {
      key: {
        type: DataTypes.STRING(32),
        allowNull: false,
        primaryKey: true,
      },
      label: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
    },
    {
      tableName: "roles",
      timestamps: false,
    }
  );

  const StructuredUser = sequelize.define(
    "StructuredUser",
    {
      id: {
        type: DataTypes.STRING(64),
        allowNull: false,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING(120), allowNull: false },
      email: { type: DataTypes.STRING(180), allowNull: false, unique: true },
      username: { type: DataTypes.STRING(120), allowNull: true, unique: true },
      roleKey: { type: DataTypes.STRING(32), allowNull: false },
      approvalStatus: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "approved" },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "active" },
      representativeName: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
      phone: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "" },
      profilePicture: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      location: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
      website: { type: DataTypes.STRING(255), allowNull: false, defaultValue: "" },
      establishedYear: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "" },
      studentCount: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "" },
      programsOffered: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      managedUniversityId: { type: DataTypes.STRING(64), allowNull: true },
      lastLoginAt: { type: DataTypes.DATE, allowNull: true },
      emailVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdAtMongo: { type: DataTypes.DATE, allowNull: true },
      updatedAtMongo: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "users",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["email"], unique: true },
        { fields: ["username"], unique: true },
        { fields: ["role_key", "status"] },
        { fields: ["role_key", "approval_status", "status"] },
        { fields: ["managed_university_id"] },
      ],
    }
  );

  const StructuredStudentProfile = sequelize.define(
    "StructuredStudentProfile",
    {
      userId: {
        type: DataTypes.STRING(64),
        allowNull: false,
        primaryKey: true,
      },
      fullName: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
      fatherName: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
      cnic: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "" },
      dateOfBirth: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "" },
      gender: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "male" },
      bloodGroup: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "" },
      religion: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "Islam" },
      nationality: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "Pakistani" },
      email: { type: DataTypes.STRING(180), allowNull: false, defaultValue: "" },
      phone: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "" },
      alternatePhone: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "" },
      address: { type: DataTypes.STRING(300), allowNull: false, defaultValue: "" },
      city: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
      province: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
      postalCode: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "" },
      matricBoard: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
      matricRollNo: { type: DataTypes.STRING(60), allowNull: false, defaultValue: "" },
      matricYear: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "" },
      matricTotalMarks: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 1100 },
      matricObtainedMarks: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      matricPercentage: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      interBoard: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
      interRollNo: { type: DataTypes.STRING(60), allowNull: false, defaultValue: "" },
      interYear: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "" },
      interTotalMarks: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 1100 },
      interObtainedMarks: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      interPercentage: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      interGroup: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
      preferredPrograms: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      preferredCities: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      achievements: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      extraCurricular: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      updatedAtMongo: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "student_profiles",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["email"] },
        { fields: ["cnic"] },
        { fields: ["city", "province"] },
      ],
    }
  );

  const StructuredUniversity = sequelize.define(
    "StructuredUniversity",
    {
      userId: {
        type: DataTypes.STRING(64),
        allowNull: false,
        primaryKey: true,
      },
      universityName: { type: DataTypes.STRING(180), allowNull: false, defaultValue: "" },
      shortName: { type: DataTypes.STRING(80), allowNull: false, defaultValue: "" },
      type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "public" },
      established: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "" },
      email: { type: DataTypes.STRING(180), allowNull: false, defaultValue: "" },
      phone: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "" },
      website: { type: DataTypes.STRING(255), allowNull: false, defaultValue: "" },
      address: { type: DataTypes.STRING(300), allowNull: false, defaultValue: "" },
      city: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
      province: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
      postalCode: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "" },
      about: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      mission: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      vision: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      totalStudents: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "" },
      totalPrograms: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "" },
      ranking: { type: DataTypes.STRING(80), allowNull: false, defaultValue: "" },
      accreditation: { type: DataTypes.STRING(80), allowNull: false, defaultValue: "HEC" },
      representativeName: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
      representativePosition: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
      representativeEmail: { type: DataTypes.STRING(180), allowNull: false, defaultValue: "" },
      representativePhone: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "" },
      representativeProfilePicture: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      logo: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
      applicationFee: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      applicationStartDate: { type: DataTypes.DATE, allowNull: true },
      applicationEndDate: { type: DataTypes.DATE, allowNull: true },
      acceptApplicationsThroughUaams: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      allowAutoFillFromStudentProfile: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      notifications: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {
          emailOnNewApplication: true,
          dailySummary: true,
          smsUrgentUpdates: false,
        },
      },
      updatedAtMongo: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "universities",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["type", "city"] },
        { fields: ["application_end_date"] },
        { fields: ["university_name"] },
      ],
    }
  );

  const StructuredProgram = sequelize.define(
    "StructuredProgram",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      universityId: { type: DataTypes.STRING(64), allowNull: false },
      mongoProgramId: { type: DataTypes.STRING(64), allowNull: true },
      name: { type: DataTypes.STRING(180), allowNull: false },
      seats: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      feeRange: { type: DataTypes.STRING(180), allowNull: false, defaultValue: "" },
      requiredAggregate: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      minimumFscPercentage: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      minimumMatricPercentage: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      deadlineDate: { type: DataTypes.DATE, allowNull: true },
      isAdmissionOpen: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "programs",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["university_id"] },
        { fields: ["university_id", "name"] },
      ],
    }
  );

  const StructuredApplication = sequelize.define(
    "StructuredApplication",
    {
      id: { type: DataTypes.STRING(64), allowNull: false, primaryKey: true },
      applicationCode: { type: DataTypes.STRING(60), allowNull: false, unique: true },
      studentId: { type: DataTypes.STRING(64), allowNull: false },
      universityId: { type: DataTypes.STRING(64), allowNull: false },
      studentName: { type: DataTypes.STRING(180), allowNull: false },
      email: { type: DataTypes.STRING(180), allowNull: false },
      cnic: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "" },
      program: { type: DataTypes.STRING(180), allowNull: false, defaultValue: "" },
      formData: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      aggregate: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      matricMarks: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      interMarks: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      testScore: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "not-submitted" },
      eligibleForAdmissionLetter: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      meritPosition: { type: DataTypes.INTEGER, allowNull: true },
      meritListNumber: { type: DataTypes.INTEGER, allowNull: true },
      appliedAt: { type: DataTypes.DATE, allowNull: true },
      updatedAtMongo: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "applications",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["student_id"] },
        { fields: ["university_id"] },
        { fields: ["status"] },
        { fields: ["student_id", "status"] },
        { fields: ["university_id", "status"] },
        { fields: ["university_id", "program", "status"] },
        { fields: ["created_at"] },
      ],
    }
  );

  const StructuredPayment = sequelize.define(
    "StructuredPayment",
    {
      applicationId: { type: DataTypes.STRING(64), allowNull: false, primaryKey: true },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "unpaid" },
      amount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      method: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "card" },
      accountLast4: { type: DataTypes.STRING(8), allowNull: false, defaultValue: "" },
      transactionReference: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "" },
      paidAt: { type: DataTypes.DATE, allowNull: true },
      updatedAtMongo: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "payments",
      timestamps: true,
      underscored: true,
      indexes: [{ fields: ["status"] }, { fields: ["paid_at"] }],
    }
  );

  Role.hasMany(StructuredUser, {
    foreignKey: "roleKey",
    sourceKey: "key",
    constraints: true,
  });
  StructuredUser.belongsTo(Role, {
    foreignKey: "roleKey",
    targetKey: "key",
    constraints: true,
  });

  StructuredUser.hasOne(StructuredStudentProfile, {
    foreignKey: "userId",
    sourceKey: "id",
    constraints: true,
    onDelete: "CASCADE",
  });
  StructuredStudentProfile.belongsTo(StructuredUser, {
    foreignKey: "userId",
    targetKey: "id",
    constraints: true,
  });

  StructuredUser.hasOne(StructuredUniversity, {
    foreignKey: "userId",
    sourceKey: "id",
    constraints: true,
    onDelete: "CASCADE",
  });
  StructuredUniversity.belongsTo(StructuredUser, {
    foreignKey: "userId",
    targetKey: "id",
    constraints: true,
  });

  StructuredUniversity.hasMany(StructuredProgram, {
    foreignKey: "universityId",
    sourceKey: "userId",
    onDelete: "CASCADE",
    constraints: true,
  });
  StructuredProgram.belongsTo(StructuredUniversity, {
    foreignKey: "universityId",
    targetKey: "userId",
    constraints: true,
  });

  StructuredApplication.belongsTo(StructuredUser, {
    as: "student",
    foreignKey: "studentId",
    targetKey: "id",
    constraints: true,
  });
  StructuredApplication.belongsTo(StructuredUser, {
    as: "university",
    foreignKey: "universityId",
    targetKey: "id",
    constraints: true,
  });
  StructuredApplication.hasOne(StructuredPayment, {
    foreignKey: "applicationId",
    sourceKey: "id",
    onDelete: "CASCADE",
    constraints: true,
  });
  StructuredPayment.belongsTo(StructuredApplication, {
    foreignKey: "applicationId",
    targetKey: "id",
    constraints: true,
  });

  return {
    Role,
    StructuredUser,
    StructuredStudentProfile,
    StructuredUniversity,
    StructuredProgram,
    StructuredApplication,
    StructuredPayment,
  };
};

const seedRoles = async (Role) => {
  const entries = [
    { key: ROLES.ADMIN, label: "Admin" },
    { key: ROLES.STUDENT, label: "Student" },
    { key: ROLES.UNIVERSITY, label: "University Representative" },
    { key: ROLES.BLOGGER, label: "Blogger" },
  ];

  for (const entry of entries) {
    await Role.upsert(entry);
  }
};

const initializeStructuredStore = async () => {
  if (!env.enablePsql) {
    state.enabled = false;
    state.ready = false;
    return state;
  }

  if (state.ready && state.sequelize && state.models) {
    return state;
  }

  const sequelize = buildSequelize();
  const models = defineModels(sequelize);

  try {
    await sequelize.authenticate();
    if (env.psqlSyncSchema) {
      await sequelize.sync();
    }
    await seedRoles(models.Role);

    state.enabled = true;
    state.ready = true;
    state.sequelize = sequelize;
    state.models = models;
    state.lastError = "";
    // eslint-disable-next-line no-console
    console.log(`[psql] connected: ${env.pgHost}:${env.pgPort}/${env.pgDatabase}`);
    return state;
  } catch (error) {
    state.enabled = true;
    state.ready = false;
    state.sequelize = sequelize;
    state.models = models;
    state.lastError = error?.message || "Failed to initialize PostgreSQL";
    throw error;
  }
};

const getStructuredStore = () => state;

module.exports = {
  initializeStructuredStore,
  getStructuredStore,
};
