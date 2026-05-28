const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const namePattern = /^[A-Za-z][A-Za-z .'-]{1,119}$/;
const phonePattern = /^(\+92|0)?[ -]?3\d{2}[ -]?\d{7}$/;
const cnicPattern = /^\d{5}-?\d{7}-?\d$/;
const transactionReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{5,63}$/;
const rollNumberPattern = /^[A-Za-z0-9][A-Za-z0-9/-]{2,30}$/;

const passwordRules = [
  {
    key: "length",
    label: "At least 8 characters",
    test: (value) => String(value || "").length >= 8,
  },
  {
    key: "uppercase",
    label: "One uppercase letter",
    test: (value) => /[A-Z]/.test(String(value || "")),
  },
  {
    key: "lowercase",
    label: "One lowercase letter",
    test: (value) => /[a-z]/.test(String(value || "")),
  },
  {
    key: "number",
    label: "One number",
    test: (value) => /\d/.test(String(value || "")),
  },
  {
    key: "special",
    label: "One special character",
    test: (value) => /[^A-Za-z0-9]/.test(String(value || "")),
  },
];

const isValidEmail = (value) => emailPattern.test(String(value || "").trim());
const isValidName = (value) => namePattern.test(String(value || "").trim());
const isValidPhone = (value) => phonePattern.test(String(value || "").trim());
const isValidCnic = (value) => cnicPattern.test(String(value || "").trim());
const isValidTransactionReference = (value) =>
  transactionReferencePattern.test(String(value || "").trim());
const isValidRollNumber = (value) => rollNumberPattern.test(String(value || "").trim());

const getPasswordChecks = (value) =>
  passwordRules.map((rule) => ({
    ...rule,
    met: rule.test(value),
  }));

const isStrongPassword = (value) => getPasswordChecks(value).every((rule) => rule.met);

const getPasswordStrength = (value) => {
  const metCount = getPasswordChecks(value).filter((rule) => rule.met).length;
  if (metCount <= 2) return { label: "Weak", percent: 30, className: "bg-red-500" };
  if (metCount <= 4) return { label: "Medium", percent: 65, className: "bg-amber-500" };
  return { label: "Strong", percent: 100, className: "bg-emerald-500" };
};

const isPdfFile = (file) =>
  Boolean(file) &&
  (file.type === "application/pdf" || /\.pdf$/i.test(String(file.name || "")));

const isImageFile = (file) => Boolean(file) && /^image\//i.test(String(file.type || ""));

const isSupportedDocumentFile = (file) =>
  Boolean(file) &&
  (isPdfFile(file) ||
    ["image/jpeg", "image/jpg", "image/png"].includes(String(file.type || "").toLowerCase()) ||
    /\.(jpe?g|png)$/i.test(String(file.name || "")));

const isSupportedProfileImage = (file) =>
  Boolean(file) &&
  (["image/jpeg", "image/jpg", "image/png"].includes(
    String(file.type || "").toLowerCase(),
  ) ||
    /\.(jpe?g|png)$/i.test(String(file.name || "")));

const isNumberInRange = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const text = String(value ?? "").trim();
  if (!text) return false;
  const number = Number(text);
  return Number.isFinite(number) && number >= min && number <= max;
};

export {
  emailPattern,
  namePattern,
  phonePattern,
  cnicPattern,
  transactionReferencePattern,
  rollNumberPattern,
  passwordRules,
  isValidEmail,
  isValidName,
  isValidPhone,
  isValidCnic,
  isValidTransactionReference,
  isValidRollNumber,
  getPasswordChecks,
  getPasswordStrength,
  isStrongPassword,
  isPdfFile,
  isImageFile,
  isSupportedDocumentFile,
  isSupportedProfileImage,
  isNumberInRange,
};
