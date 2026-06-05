const mongoose = require("mongoose");
const { queueStructuredSync } = require("../structured/queue");

const programSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    seats: { type: Number, default: 0, min: 0 },
    feeRange: { type: String, default: "" },
    requiredAggregate: { type: Number, default: 0, min: 0, max: 100 },
    deadlineDate: { type: Date, default: null },
    isAdmissionOpen: { type: Boolean, default: true },
  },
  { _id: true }
);

const notificationSchema = new mongoose.Schema(
  {
    emailOnNewApplication: { type: Boolean, default: true },
    dailySummary: { type: Boolean, default: true },
    smsUrgentUpdates: { type: Boolean, default: false },
  },
  { _id: false }
);

const paymentMethodSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["bank", "wallet", "card", "other"],
      default: "bank",
    },
    title: { type: String, trim: true, default: "" },
    accountTitle: { type: String, trim: true, default: "" },
    bankName: { type: String, trim: true, default: "" },
    accountNumber: { type: String, trim: true, default: "" },
    iban: { type: String, trim: true, default: "" },
    walletName: { type: String, trim: true, default: "" },
    walletNumber: { type: String, trim: true, default: "" },
    instructions: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const universityProfileSchema = new mongoose.Schema(
  {
    university: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    universityName: { type: String, required: true, trim: true },
    shortName: { type: String, trim: true, default: "" },
    type: { type: String, enum: ["public", "private"], default: "public" },
    established: { type: String, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    website: { type: String, trim: true, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    province: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    about: { type: String, default: "" },
    mission: { type: String, default: "" },
    vision: { type: String, default: "" },
    totalStudents: { type: String, default: "" },
    totalPrograms: { type: String, default: "" },
    ranking: { type: String, default: "" },
    accreditation: { type: String, default: "HEC" },
    representativeName: { type: String, default: "" },
    representativePosition: { type: String, default: "" },
    representativeEmail: { type: String, default: "" },
    representativePhone: { type: String, default: "" },
    representativeProfilePicture: { type: String, default: "" },
    logo: { type: String, default: "" },
    applicationFee: { type: Number, default: 0, min: 0 },
    minimumFscPercentage: { type: Number, default: 0, min: 0, max: 100 },
    minimumMatricPercentage: { type: Number, default: 0, min: 0, max: 100 },
    applicationStartDate: { type: Date, default: null },
    applicationEndDate: { type: Date, default: null },
    acceptApplicationsThroughUaams: { type: Boolean, default: true },
    allowAutoFillFromStudentProfile: { type: Boolean, default: true },
    programs: { type: [programSchema], default: [] },
    paymentMethods: { type: [paymentMethodSchema], default: [] },
    notifications: { type: notificationSchema, default: () => ({}) },
  },
  { timestamps: true }
);

universityProfileSchema.index({ type: 1, city: 1 });
universityProfileSchema.index({ universityName: 1 });
universityProfileSchema.index({ applicationEndDate: 1 });
universityProfileSchema.index({ "programs.name": 1 });
universityProfileSchema.index({ "programs.isAdmissionOpen": 1, "programs.deadlineDate": 1 });

const queueUniversityProfileSync = (action, universityId) => {
  const entityId = String(universityId || "").trim();
  if (!entityId) return;
  void queueStructuredSync({ entityType: "universityProfile", entityId, action }).catch(() => {});
};

universityProfileSchema.post("save", function onSave(doc) {
  queueUniversityProfileSync("upsert", doc?.university || this?.university);
});

universityProfileSchema.post("findOneAndUpdate", function onFindOneAndUpdate(doc) {
  if (!doc?.university) return;
  queueUniversityProfileSync("upsert", doc.university);
});

universityProfileSchema.post("findOneAndDelete", function onFindOneAndDelete(doc) {
  if (!doc?.university) return;
  queueUniversityProfileSync("delete", doc.university);
});

universityProfileSchema.post(
  "deleteOne",
  { document: true, query: false },
  function onDeleteOneDocument(doc) {
    queueUniversityProfileSync("delete", doc?.university || this?.university);
  }
);

universityProfileSchema.post("deleteOne", { document: false, query: true }, function onDeleteOneQuery() {
  const filter = this.getFilter ? this.getFilter() : {};
  if (!filter?.university) return;
  queueUniversityProfileSync("delete", filter.university);
});

module.exports = mongoose.model("UniversityProfile", universityProfileSchema);
