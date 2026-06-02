const mongoose = require("mongoose");
const { ROLES, UNIVERSITY_APPROVAL } = require("../constants/roles");

const pendingRegistrationSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: [ROLES.STUDENT, ROLES.UNIVERSITY],
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    username: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      unique: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    location: {
      type: String,
      trim: true,
      default: "",
    },
    website: {
      type: String,
      trim: true,
      default: "",
    },
    establishedYear: {
      type: String,
      trim: true,
      default: "",
    },
    studentCount: {
      type: String,
      trim: true,
      default: "",
    },
    programsOffered: {
      type: String,
      trim: true,
      default: "",
    },
    representativeName: {
      type: String,
      trim: true,
      default: "",
    },
    approvalStatus: {
      type: String,
      enum: Object.values(UNIVERSITY_APPROVAL),
      default: UNIVERSITY_APPROVAL.APPROVED,
    },
    emailVerificationTokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    emailVerificationExpiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

pendingRegistrationSchema.index({ emailVerificationExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PendingRegistration", pendingRegistrationSchema);
