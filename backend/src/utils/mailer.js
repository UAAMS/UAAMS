const nodemailer = require("nodemailer");
const env = require("../config/env");

let transporterCache = null;

const isSmtpConfigured = () =>
  Boolean(
    String(env.smtpHost || "").trim() &&
      Number(env.smtpPort || 0) > 0 &&
      String(env.smtpUser || "").trim() &&
      String(env.smtpPass || "").trim() &&
      String(env.smtpFrom || "").trim(),
  );

const getTransporter = () => {
  if (transporterCache) {
    return transporterCache;
  }

  transporterCache = nodemailer.createTransport({
    host: env.smtpHost,
    port: Number(env.smtpPort),
    secure: Boolean(env.smtpSecure),
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });

  return transporterCache;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildDetailList = (items = []) =>
  `<div style="margin:18px 0; border:1px solid #dbeafe; border-radius:12px; overflow:hidden;">${items
    .map(
      ([label, value]) =>
        `<div style="display:flex; gap:12px; padding:10px 14px; border-bottom:1px solid #e0f2fe;">
          <div style="min-width:130px; color:#475569; font-size:13px;">${escapeHtml(label)}</div>
          <div style="color:#0f172a; font-weight:600; font-size:13px;">${escapeHtml(value || "N/A")}</div>
        </div>`,
    )
    .join("")
    .replace(/border-bottom:1px solid #e0f2fe;">\s*<\/div>$/, '">')}</div>`;

const buildEmailShell = ({ eyebrow = "UAAMS", title, children }) => `
  <div style="margin:0; padding:24px; background:#f8fafc; font-family:Arial, Helvetica, sans-serif; color:#0f172a;">
    <div style="max-width:620px; margin:0 auto; overflow:hidden; border:1px solid #dbeafe; border-radius:18px; background:#ffffff; box-shadow:0 12px 30px rgba(15,23,42,0.08);">
      <div style="background:#047857; padding:22px 26px; color:#ffffff;">
        <div style="font-size:12px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase;">${escapeHtml(eyebrow)}</div>
        <h1 style="margin:8px 0 0; font-size:24px; line-height:1.25;">${escapeHtml(title)}</h1>
      </div>
      <div style="padding:26px; font-size:15px; line-height:1.65;">
        ${children}
        <p style="margin-top:24px; color:#64748b; font-size:12px;">This is an automated UAAMS email. Please do not share verification codes or credentials with anyone.</p>
      </div>
    </div>
  </div>
`;

const sendBloggerCredentialsEmail = async ({
  to,
  bloggerName,
  username,
  email,
  password,
  universityName,
}) => {
  if (!isSmtpConfigured()) {
    return {
      sent: false,
      reason: "SMTP is not configured. Set SMTP_* env values to enable emails.",
    };
  }

  const transporter = getTransporter();
  const subject = `UAAMS Blogger Account Credentials - ${universityName || "University"}`;

  const safeUniversityName = universityName || "your university";
  const safeBloggerName = bloggerName || "Blogger";

  const text = [
    `Hello ${safeBloggerName},`,
    "",
    `You have been added as a blogger for ${safeUniversityName} in UAAMS.`,
    "",
    "Login credentials:",
    `Username: ${username || "N/A"}`,
    `Email: ${email || "N/A"}`,
    `Password: ${password || "N/A"}`,
    "",
    "Please login and change your password after first sign in.",
  ].join("\n");

  await transporter.sendMail({
    from: env.smtpFrom,
    to,
    subject,
    text,
    html: buildEmailShell({
      title: "Blogger Account Created",
      children: `
        <p>Hello ${escapeHtml(safeBloggerName)},</p>
        <p>You have been added as a blogger for <strong>${escapeHtml(safeUniversityName)}</strong> in UAAMS.</p>
        ${buildDetailList([
          ["Username", username],
          ["Email", email],
          ["Temporary Password", password],
        ])}
        <p>Please sign in and change your password after first login.</p>
      `,
    }),
  });

  return { sent: true, reason: "" };
};

const sendPasswordResetOtpEmail = async ({ to, name, otp, validForMinutes = 10 }) => {
  if (!isSmtpConfigured()) {
    return {
      sent: false,
      reason: "SMTP is not configured. Set SMTP_* env values to enable emails.",
    };
  }

  const transporter = getTransporter();
  const safeName = name || "UAAMS user";
  const safeOtp = String(otp || "").trim();

  if (!safeOtp) {
    return {
      sent: false,
      reason: "OTP is missing for password reset email.",
    };
  }

  const subject = "UAAMS Password Reset OTP";
  const text = [
    `Hello ${safeName},`,
    "",
    "Use the OTP below to reset your UAAMS account password:",
    "",
    `OTP: ${safeOtp}`,
    "",
    `This OTP will expire in ${validForMinutes} minutes.`,
    "If you did not request this, ignore this email.",
  ].join("\n");

  await transporter.sendMail({
    from: env.smtpFrom,
    to,
    subject,
    text,
    html: buildEmailShell({
      title: "Password Reset Code",
      children: `
        <p>Hello ${escapeHtml(safeName)},</p>
        <p>Use this one-time password to reset your UAAMS account password.</p>
        <div style="margin:20px 0; border-radius:14px; background:#ecfdf5; padding:18px; text-align:center;">
          <div style="color:#047857; font-size:12px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase;">Reset OTP</div>
          <div style="margin-top:8px; color:#064e3b; font-size:34px; font-weight:800; letter-spacing:0.22em;">${escapeHtml(safeOtp)}</div>
        </div>
        <p>This OTP will expire in <strong>${escapeHtml(validForMinutes)} minutes</strong>.</p>
        <p>If you did not request this reset, you can safely ignore this email.</p>
      `,
    }),
  });

  return { sent: true, reason: "" };
};

const sendEmailVerificationLinkEmail = async ({
  to,
  name,
  verificationUrl,
  validForHours = 24,
}) => {
  if (!isSmtpConfigured()) {
    return {
      sent: false,
      reason: "SMTP is not configured. Set SMTP_* env values to enable emails.",
    };
  }

  const safeVerificationUrl = String(verificationUrl || "").trim();
  if (!safeVerificationUrl) {
    return {
      sent: false,
      reason: "Verification URL is missing.",
    };
  }

  const transporter = getTransporter();
  const safeName = name || "UAAMS user";

  const subject = "Verify your UAAMS account email";
  const text = [
    `Hello ${safeName},`,
    "",
    "Welcome to UAAMS. Please verify your account by clicking the link below:",
    safeVerificationUrl,
    "",
    `This link will expire in ${validForHours} hours.`,
    "If you did not create this account, ignore this email.",
  ].join("\n");

  await transporter.sendMail({
    from: env.smtpFrom,
    to,
    subject,
    text,
    html: buildEmailShell({
      title: "Verify Your Email",
      children: `
        <p>Hello ${escapeHtml(safeName)},</p>
        <p>Welcome to UAAMS. Verify your account email before signing in.</p>
        <p style="margin:24px 0;">
          <a href="${escapeHtml(safeVerificationUrl)}" style="display:inline-block; border-radius:10px; background:#059669; color:#ffffff; font-weight:700; padding:12px 18px; text-decoration:none;">Verify Email</a>
        </p>
        <p>This link will expire in <strong>${escapeHtml(validForHours)} hours</strong>.</p>
        <p>If you did not create this account, you can safely ignore this email.</p>
      `,
    }),
  });

  return { sent: true, reason: "" };
};

const parseDataUrlAttachment = ({ dataUrl, fallbackName, fallbackMimeType = "application/octet-stream" }) => {
  const source = String(dataUrl || "").trim();
  if (!source.startsWith("data:")) {
    return null;
  }

  const splitIndex = source.indexOf(",");
  if (splitIndex === -1) return null;

  const header = source.slice(0, splitIndex);
  const payload = source.slice(splitIndex + 1);
  const mimeMatch = header.match(/^data:([^;]+);base64$/i);
  if (!mimeMatch) {
    return null;
  }

  const mimeType = String(mimeMatch[1] || fallbackMimeType).trim() || fallbackMimeType;
  const ext = mimeType.split("/")[1] || "bin";
  const filenameBase = String(fallbackName || "document").trim().replace(/\s+/g, "_");

  try {
    return {
      filename: filenameBase.includes(".") ? filenameBase : `${filenameBase}.${ext}`,
      content: Buffer.from(payload, "base64"),
      contentType: mimeType,
    };
  } catch {
    return null;
  }
};

const sendRollNumberAssignedEmail = async ({
  to,
  studentName,
  universityName,
  applicationCode,
  program,
  rollNumber,
  slipFileUrl,
  slipFileName,
}) => {
  if (!isSmtpConfigured()) {
    return {
      sent: false,
      reason: "SMTP is not configured. Set SMTP_* env values to enable emails.",
    };
  }

  const transporter = getTransporter();
  const safeStudentName = studentName || "Student";
  const safeUniversityName = universityName || "University";
  const safeRollNumber = rollNumber || "N/A";

  const attachments = [];
  const parsedAttachment = parseDataUrlAttachment({
    dataUrl: slipFileUrl,
    fallbackName: slipFileName || "roll-number-slip.pdf",
    fallbackMimeType: "application/pdf",
  });
  if (parsedAttachment) {
    attachments.push(parsedAttachment);
  }

  const subject = `UAAMS Roll Number Assigned - ${safeUniversityName}`;
  const text = [
    `Hello ${safeStudentName},`,
    "",
    `Your roll number has been assigned by ${safeUniversityName}.`,
    `Application Code: ${applicationCode || "N/A"}`,
    `Program: ${program || "N/A"}`,
    `Roll Number: ${safeRollNumber}`,
    "",
    parsedAttachment
      ? "Your roll number slip is attached with this email."
      : slipFileUrl
      ? `Roll Slip Link: ${slipFileUrl}`
      : "Roll slip will be available in your student portal.",
  ].join("\n");

  await transporter.sendMail({
    from: env.smtpFrom,
    to,
    subject,
    text,
    html: `
      <p>Hello ${safeStudentName},</p>
      <p>Your roll number has been assigned by <strong>${safeUniversityName}</strong>.</p>
      <ul>
        <li>Application Code: ${applicationCode || "N/A"}</li>
        <li>Program: ${program || "N/A"}</li>
        <li>Roll Number: ${safeRollNumber}</li>
      </ul>
      ${
        parsedAttachment
          ? "<p>Your roll number slip is attached with this email.</p>"
          : slipFileUrl
          ? `<p>Roll Slip Link: <a href="${slipFileUrl}">${slipFileUrl}</a></p>`
          : "<p>Roll slip will be available in your student portal.</p>"
      }
    `,
    attachments,
  });

  return { sent: true, reason: "" };
};

const sendAdmissionLetterIssuedEmail = async ({
  to,
  studentName,
  universityName,
  applicationCode,
  program,
  letterNumber,
  fileUrl,
  fileName,
}) => {
  if (!isSmtpConfigured()) {
    return {
      sent: false,
      reason: "SMTP is not configured. Set SMTP_* env values to enable emails.",
    };
  }

  const transporter = getTransporter();
  const safeStudentName = studentName || "Student";
  const safeUniversityName = universityName || "University";
  const safeLetterNumber = letterNumber || "N/A";

  const attachments = [];
  const parsedAttachment = parseDataUrlAttachment({
    dataUrl: fileUrl,
    fallbackName: fileName || "admission-letter.pdf",
    fallbackMimeType: "application/pdf",
  });
  if (parsedAttachment) {
    attachments.push(parsedAttachment);
  }

  const subject = `UAAMS Admission Letter Issued - ${safeUniversityName}`;
  const text = [
    `Hello ${safeStudentName},`,
    "",
    `Your admission letter has been issued by ${safeUniversityName}.`,
    `Application Code: ${applicationCode || "N/A"}`,
    `Program: ${program || "N/A"}`,
    `Letter Number: ${safeLetterNumber}`,
    "",
    parsedAttachment
      ? "Your admission letter is attached with this email."
      : fileUrl
      ? `Admission Letter Link: ${fileUrl}`
      : "Admission letter is available in your student portal.",
  ].join("\n");

  await transporter.sendMail({
    from: env.smtpFrom,
    to,
    subject,
    text,
    html: `
      <p>Hello ${safeStudentName},</p>
      <p>Your admission letter has been issued by <strong>${safeUniversityName}</strong>.</p>
      <ul>
        <li>Application Code: ${applicationCode || "N/A"}</li>
        <li>Program: ${program || "N/A"}</li>
        <li>Letter Number: ${safeLetterNumber}</li>
      </ul>
      ${
        parsedAttachment
          ? "<p>Your admission letter is attached with this email.</p>"
          : fileUrl
          ? `<p>Admission Letter Link: <a href="${fileUrl}">${fileUrl}</a></p>`
          : "<p>Admission letter is available in your student portal.</p>"
      }
    `,
    attachments,
  });

  return { sent: true, reason: "" };
};

module.exports = {
  isSmtpConfigured,
  sendBloggerCredentialsEmail,
  sendPasswordResetOtpEmail,
  sendEmailVerificationLinkEmail,
  sendRollNumberAssignedEmail,
  sendAdmissionLetterIssuedEmail,
};
