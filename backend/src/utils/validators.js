const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const namePattern = /^[A-Za-z][A-Za-z .'-]{1,119}$/;
const phonePattern = /^(\+92|0)?[ -]?3\d{2}[ -]?\d{7}$/;
const cnicPattern = /^\d{5}-?\d{7}-?\d$/;
const transactionReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{5,63}$/;
const rollNumberPattern = /^[A-Za-z0-9][A-Za-z0-9/-]{2,30}$/;
const DATA_URL_PATTERN = /^data:([^;]+);base64,/i;

const isValidEmail = (value) => emailPattern.test(String(value || "").trim());
const isValidName = (value) => namePattern.test(String(value || "").trim());
const isValidPhone = (value) => phonePattern.test(String(value || "").trim());
const isValidCnic = (value) => cnicPattern.test(String(value || "").trim());
const isValidTransactionReference = (value) =>
  transactionReferencePattern.test(String(value || "").trim());
const isValidRollNumber = (value) => rollNumberPattern.test(String(value || "").trim());
const isStrongPassword = (value) => {
  const text = String(value || "");
  return (
    text.length >= 8 &&
    /[A-Z]/.test(text) &&
    /[a-z]/.test(text) &&
    /\d/.test(text) &&
    /[^A-Za-z0-9]/.test(text)
  );
};

const isNumberInRange = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const text = String(value ?? "").trim();
  if (!text) return false;
  const number = Number(text);
  return Number.isFinite(number) && number >= min && number <= max;
};

const normalizeCnic = (value) => String(value || "").trim().replace(/-/g, "");

const inferMimeTypeFromDataUrl = (value = "") => {
  const match = String(value || "").trim().match(DATA_URL_PATTERN);
  return match ? String(match[1] || "").toLowerCase() : "";
};

const inferExtensionFromNameOrUrl = (value = "") => {
  const cleanValue = String(value || "").split("?")[0].split("#")[0].toLowerCase();
  const match = cleanValue.match(/\.([a-z0-9]+)$/i);
  return match ? match[1] : "";
};

const isPdfUpload = ({ dataUrl = "", fileName = "", url = "" } = {}) => {
  const mimeType = inferMimeTypeFromDataUrl(dataUrl || url);
  const extension = inferExtensionFromNameOrUrl(fileName || url);
  return mimeType === "application/pdf" || extension === "pdf";
};

const isSupportedDocumentUpload = ({ dataUrl = "", fileName = "", url = "" } = {}) => {
  const mimeType = inferMimeTypeFromDataUrl(dataUrl || url);
  const extension = inferExtensionFromNameOrUrl(fileName || url);
  return (
    mimeType === "application/pdf" ||
    ["image/jpeg", "image/jpg", "image/png"].includes(mimeType) ||
    ["pdf", "jpg", "jpeg", "png"].includes(extension)
  );
};

const isSupportedProfileImageUpload = ({ dataUrl = "", fileName = "", url = "" } = {}) => {
  const mimeType = inferMimeTypeFromDataUrl(dataUrl || url);
  const extension = inferExtensionFromNameOrUrl(fileName || url);
  return ["image/jpeg", "image/jpg", "image/png"].includes(mimeType) ||
    ["jpg", "jpeg", "png"].includes(extension);
};

module.exports = {
  emailPattern,
  namePattern,
  phonePattern,
  cnicPattern,
  transactionReferencePattern,
  rollNumberPattern,
  isValidEmail,
  isValidName,
  isValidPhone,
  isValidCnic,
  isValidTransactionReference,
  isValidRollNumber,
  isStrongPassword,
  isNumberInRange,
  normalizeCnic,
  inferMimeTypeFromDataUrl,
  isPdfUpload,
  isSupportedDocumentUpload,
  isSupportedProfileImageUpload,
};
