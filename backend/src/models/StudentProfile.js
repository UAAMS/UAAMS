const mongoose = require("mongoose");
const { queueStructuredSync } = require("../structured/queue");

const studentProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    fullName: { type: String, trim: true, default: "" },
    fatherName: { type: String, trim: true, default: "" },
    cnic: { type: String, trim: true, default: "" },
    dateOfBirth: { type: String, default: "" },
    gender: { type: String, enum: ["male", "female", "other"], default: "male" },
    bloodGroup: { type: String, trim: true, default: "" },
    religion: { type: String, trim: true, default: "Islam" },
    nationality: { type: String, trim: true, default: "Pakistani" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    alternatePhone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    province: { type: String, trim: true, default: "" },
    postalCode: { type: String, trim: true, default: "" },
    matricBoard: { type: String, trim: true, default: "" },
    matricRollNo: { type: String, trim: true, default: "" },
    matricYear: { type: String, default: "" },
    matricTotalMarks: { type: Number, default: 1100 },
    matricObtainedMarks: { type: Number, default: 0 },
    matricPercentage: { type: Number, default: 0 },
    interBoard: { type: String, trim: true, default: "" },
    interRollNo: { type: String, trim: true, default: "" },
    interYear: { type: String, default: "" },
    interTotalMarks: { type: Number, default: 1100 },
    interObtainedMarks: { type: Number, default: 0 },
    interPercentage: { type: Number, default: 0 },
    interGroup: { type: String, trim: true, default: "" },
    preferredPrograms: { type: [String], default: [] },
    preferredCities: { type: [String], default: [] },
    achievements: { type: String, default: "" },
    extraCurricular: { type: String, default: "" },
    profilePicture: { type: String, default: "" },
    profilePictureFileName: { type: String, default: "" },
    domicileDocument: { type: String, default: "" },
    domicileFileName: { type: String, default: "" },
    matricResultDocument: { type: String, default: "" },
    matricResultFileName: { type: String, default: "" },
    interResultDocument: { type: String, default: "" },
    interResultFileName: { type: String, default: "" },
  },
  { timestamps: true }
);

studentProfileSchema.index({ email: 1 });
studentProfileSchema.index({ cnic: 1 });
studentProfileSchema.index({ city: 1, province: 1 });

studentProfileSchema.pre("save", function autoCalculatePercentages(next) {
  if (this.matricTotalMarks > 0 && this.matricObtainedMarks > 0) {
    this.matricPercentage = Number(
      ((this.matricObtainedMarks / this.matricTotalMarks) * 100).toFixed(2)
    );
  }

  if (this.interTotalMarks > 0 && this.interObtainedMarks > 0) {
    this.interPercentage = Number(
      ((this.interObtainedMarks / this.interTotalMarks) * 100).toFixed(2)
    );
  }

  next();
});

const queueStudentProfileSync = (action, userId) => {
  const entityId = String(userId || "").trim();
  if (!entityId) return;
  void queueStructuredSync({ entityType: "studentProfile", entityId, action }).catch(() => {});
};

studentProfileSchema.post("save", function onSave(doc) {
  queueStudentProfileSync("upsert", doc?.user || this?.user);
});

studentProfileSchema.post("findOneAndUpdate", function onFindOneAndUpdate(doc) {
  if (!doc?.user) return;
  queueStudentProfileSync("upsert", doc.user);
});

studentProfileSchema.post("findOneAndDelete", function onFindOneAndDelete(doc) {
  if (!doc?.user) return;
  queueStudentProfileSync("delete", doc.user);
});

studentProfileSchema.post(
  "deleteOne",
  { document: true, query: false },
  function onDeleteOneDocument(doc) {
    queueStudentProfileSync("delete", doc?.user || this?.user);
  }
);

studentProfileSchema.post("deleteOne", { document: false, query: true }, function onDeleteOneQuery() {
  const filter = this.getFilter ? this.getFilter() : {};
  if (!filter?.user) return;
  queueStudentProfileSync("delete", filter.user);
});

module.exports = mongoose.model("StudentProfile", studentProfileSchema);
