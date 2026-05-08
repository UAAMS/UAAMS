const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLES, UNIVERSITY_APPROVAL, USER_STATUS } = require("../constants/roles");
const { queueStructuredSync } = require("../structured/queue");

const userSchema = new mongoose.Schema(
  {
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
    username: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: Object.values(UNIVERSITY_APPROVAL),
      default: UNIVERSITY_APPROVAL.APPROVED,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
      index: true,
    },
    representativeName: {
      type: String,
      trim: true,
      default: "",
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
    managedUniversity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    emailVerified: {
      type: Boolean,
      default: true,
      index: true,
    },
    emailVerificationTokenHash: {
      type: String,
      default: "",
      select: false,
    },
    emailVerificationExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    passwordResetOtpHash: {
      type: String,
      default: "",
      select: false,
    },
    passwordResetOtpExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, approvalStatus: 1, status: 1 });
userSchema.index({ role: 1, managedUniversity: 1, status: 1 });
userSchema.index({ email: 1, role: 1 });

userSchema.pre("validate", function setUniversityApproval(next) {
  if (this.role === ROLES.UNIVERSITY && !this.approvalStatus) {
    this.approvalStatus = UNIVERSITY_APPROVAL.PENDING;
  }
  next();
});

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function comparePassword(rawPassword) {
  return bcrypt.compare(rawPassword, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    username: this.username,
    role: this.role,
    approvalStatus: this.approvalStatus,
    status: this.status,
    representativeName: this.representativeName,
    phone: this.phone,
    location: this.location,
    website: this.website,
    establishedYear: this.establishedYear,
    studentCount: this.studentCount,
    programsOffered: this.programsOffered,
    managedUniversity: this.managedUniversity,
    emailVerified: this.emailVerified,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const queueUserSync = (action, id) => {
  const entityId = String(id || "").trim();
  if (!entityId) return;
  void queueStructuredSync({ entityType: "user", entityId, action }).catch(() => {});
};

userSchema.post("save", function onSave(doc) {
  queueUserSync("upsert", doc?._id || this?._id);
});

userSchema.post("findOneAndUpdate", function onFindOneAndUpdate(doc) {
  if (!doc?._id) return;
  queueUserSync("upsert", doc._id);
});

userSchema.post("findOneAndDelete", function onFindOneAndDelete(doc) {
  if (!doc?._id) return;
  queueUserSync("delete", doc._id);
});

userSchema.post("deleteOne", { document: true, query: false }, function onDeleteOneDocument(doc) {
  queueUserSync("delete", doc?._id || this?._id);
});

userSchema.post("deleteOne", { document: false, query: true }, function onDeleteOneQuery() {
  const filter = this.getFilter ? this.getFilter() : {};
  if (!filter?._id) return;
  queueUserSync("delete", filter._id);
});

module.exports = mongoose.model("User", userSchema);
