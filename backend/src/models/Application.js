const mongoose = require("mongoose");
const { queueStructuredSync } = require("../structured/queue");

const paymentSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["unpaid", "paid", "refunded"], default: "unpaid" },
    amount: { type: Number, default: 0, min: 0 },
    method: { type: String, enum: ["card", "bank", "wallet", "other"], default: "card" },
    accountLast4: { type: String, default: "" },
    transactionReference: { type: String, default: "" },
    proofFileUrl: { type: String, default: "" },
    proofFileName: { type: String, default: "" },
    stripeSessionId: { type: String, default: "" },
    stripePaymentIntentId: { type: String, default: "" },
    paidAt: { type: Date, default: null },
  },
  { _id: false }
);

const rollNumberSchema = new mongoose.Schema(
  {
    assigned: { type: Boolean, default: false },
    number: { type: String, default: "" },
    slipFileUrl: { type: String, default: "" },
    slipFileName: { type: String, default: "" },
    assignedAt: { type: Date, default: null },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false }
);

const admissionLetterSchema = new mongoose.Schema(
  {
    issued: { type: Boolean, default: false },
    letterNumber: { type: String, default: "" },
    fileUrl: { type: String, default: "" },
    fileName: { type: String, default: "" },
    remarks: { type: String, default: "" },
    sentToStudent: { type: Boolean, default: false },
    uploadedAt: { type: Date, default: null },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sentAt: { type: Date, default: null },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    applicationCode: { type: String, unique: true, index: true },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    university: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    studentName: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    cnic: { type: String, default: "" },
    program: { type: String, required: true, trim: true },
    formData: { type: mongoose.Schema.Types.Mixed, default: {} },
    aggregate: { type: Number, default: 0, min: 0, max: 100 },
    matricMarks: { type: Number, default: 0, min: 0 },
    interMarks: { type: Number, default: 0, min: 0 },
    testScore: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: [
        "not-submitted",
        "pending",
        "under-review",
        "accepted",
        "rejected",
        "assigned",
        "finalized",
      ],
      default: "not-submitted",
      index: true,
    },
    payment: { type: paymentSchema, default: () => ({}) },
    rollNumber: { type: rollNumberSchema, default: () => ({}) },
    eligibleForAdmissionLetter: { type: Boolean, default: false, index: true },
    admissionLetter: { type: admissionLetterSchema, default: () => ({}) },
    meritPosition: { type: Number, default: null },
    meritListNumber: { type: Number, default: null },
    appliedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

applicationSchema.index({ student: 1, createdAt: -1 });
applicationSchema.index({ student: 1, status: 1, createdAt: -1 });
applicationSchema.index({ university: 1, createdAt: -1 });
applicationSchema.index({ university: 1, status: 1, createdAt: -1 });
applicationSchema.index({ university: 1, program: 1, status: 1, createdAt: -1 });
applicationSchema.index({ status: 1, createdAt: -1 });
applicationSchema.index({ "payment.status": 1, createdAt: -1 });
applicationSchema.index({ "rollNumber.assigned": 1 });
applicationSchema.index({ "admissionLetter.issued": 1 });
applicationSchema.index({ program: 1 });
applicationSchema.index({ email: 1 });
applicationSchema.index({ cnic: 1 });

applicationSchema.pre("validate", function buildApplicationCode(next) {
  if (!this.applicationCode) {
    const suffix = `${Math.floor(10000 + Math.random() * 90000)}`;
    const year = new Date().getFullYear();
    this.applicationCode = `APP-${year}-${suffix}`;
  }
  next();
});

const queueApplicationSync = (action, applicationId) => {
  const entityId = String(applicationId || "").trim();
  if (!entityId) return;
  void queueStructuredSync({ entityType: "application", entityId, action }).catch(() => {});
};

applicationSchema.post("save", function onSave(doc) {
  queueApplicationSync("upsert", doc?._id || this?._id);
});

applicationSchema.post("findOneAndUpdate", function onFindOneAndUpdate(doc) {
  if (!doc?._id) return;
  queueApplicationSync("upsert", doc._id);
});

applicationSchema.post("findOneAndDelete", function onFindOneAndDelete(doc) {
  if (!doc?._id) return;
  queueApplicationSync("delete", doc._id);
});

applicationSchema.post("deleteOne", { document: true, query: false }, function onDeleteOneDocument(doc) {
  queueApplicationSync("delete", doc?._id || this?._id);
});

applicationSchema.post("deleteOne", { document: false, query: true }, function onDeleteOneQuery() {
  const filter = this.getFilter ? this.getFilter() : {};
  if (!filter?._id) return;
  queueApplicationSync("delete", filter._id);
});

module.exports = mongoose.model("Application", applicationSchema);
