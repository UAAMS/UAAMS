const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const PendingRegistration = require("../models/PendingRegistration");
const StudentProfile = require("../models/StudentProfile");
const UniversityProfile = require("../models/UniversityProfile");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { signAuthToken } = require("../utils/jwt");
const {
  sendPasswordResetOtpEmail,
  sendEmailVerificationLinkEmail,
} = require("../utils/mailer");
const {
  isNumberInRange,
  isStrongPassword,
  isValidEmail,
  isValidName,
  isValidPhone,
} = require("../utils/validators");
const env = require("../config/env");
const { ROLES, UNIVERSITY_APPROVAL } = require("../constants/roles");

const isSupportedRole = (role) =>
  [ROLES.STUDENT, ROLES.UNIVERSITY, ROLES.BLOGGER, ROLES.ADMIN].includes(role);

const OTP_EXPIRY_MINUTES = 10;
const OTP_EXPIRY_MS = OTP_EXPIRY_MINUTES * 60 * 1000;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
const EMAIL_VERIFICATION_EXPIRY_MS = EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000;

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const hashOtp = (value) =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex");
const generateVerificationToken = () => crypto.randomBytes(32).toString("hex");
const hashToken = (value) =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex");

const clearPasswordResetOtp = (user) => {
  user.passwordResetOtpHash = "";
  user.passwordResetOtpExpiresAt = null;
};

const clearEmailVerification = (user) => {
  user.emailVerificationTokenHash = "";
  user.emailVerificationExpiresAt = null;
};

const resolveFrontendBaseUrl = (req) => {
  const explicitFrontendUrl = String(env.frontendUrl || "").trim();
  if (explicitFrontendUrl) {
    return explicitFrontendUrl.replace(/\/+$/, "");
  }

  const origin = String(req.get("origin") || req.headers.origin || "").trim();
  if (origin) {
    return origin.replace(/\/+$/, "");
  }

  const referer = String(req.get("referer") || req.headers.referer || "").trim();
  if (referer) {
    try {
      const parsed = new URL(referer);
      return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, "");
    } catch {
      // ignore invalid referer
    }
  }

  return "http://localhost:5173";
};

const buildEmailVerificationUrl = (req, verificationToken, email = "") => {
  const frontendBaseUrl = resolveFrontendBaseUrl(req);
  return `${frontendBaseUrl}/verify-email?token=${encodeURIComponent(
    verificationToken
  )}&email=${encodeURIComponent(String(email || "").trim().toLowerCase())}`;
};

const createVerifiedUserFromPendingRegistration = async (pendingRegistration) => {
  const existingUser = await User.findOne({ email: pendingRegistration.email });
  if (existingUser) {
    await PendingRegistration.deleteOne({ _id: pendingRegistration._id });
    throw new ApiError(409, "An account with this email already exists.");
  }

  const createdUser = new User({
    role: pendingRegistration.role,
    name: pendingRegistration.name,
    email: pendingRegistration.email,
    password: pendingRegistration.passwordHash,
    username: pendingRegistration.username || undefined,
    phone: pendingRegistration.phone || "",
    location: pendingRegistration.location || "",
    website: pendingRegistration.website || "",
    establishedYear: pendingRegistration.establishedYear || "",
    studentCount: pendingRegistration.studentCount || "",
    programsOffered: pendingRegistration.programsOffered || "",
    representativeName: pendingRegistration.representativeName || "",
    emailVerified: true,
    emailVerificationTokenHash: pendingRegistration.emailVerificationTokenHash,
    emailVerificationExpiresAt: pendingRegistration.emailVerificationExpiresAt,
    approvalStatus: pendingRegistration.approvalStatus,
  });
  createdUser.$locals.passwordAlreadyHashed = true;

  let savedUser = null;
  try {
    savedUser = await createdUser.save();

    if (savedUser.role === ROLES.STUDENT) {
      await StudentProfile.create({
        user: savedUser._id,
        fullName: savedUser.name,
        email: savedUser.email,
      });
    }

    if (savedUser.role === ROLES.UNIVERSITY) {
      await UniversityProfile.create({
        university: savedUser._id,
        universityName: savedUser.name,
        representativeName: savedUser.representativeName || "",
        email: savedUser.email,
        phone: savedUser.phone || "",
        city: savedUser.location || "",
        website: savedUser.website || "",
        established: savedUser.establishedYear || "",
        totalStudents: savedUser.studentCount || "",
        programs: [],
      });
    }

    await PendingRegistration.deleteOne({ _id: pendingRegistration._id });
    return savedUser;
  } catch (error) {
    if (savedUser?._id) {
      await User.deleteOne({ _id: savedUser._id }).catch(() => {});
    }
    throw error;
  }
};

const buildAuthUser = async (user) => {
  const safeUser = user.toSafeObject();

  if (user.role === ROLES.STUDENT) {
    const profile = await StudentProfile.findOne({ user: user._id })
      .select("profilePicture")
      .lean();
    return {
      ...safeUser,
      profilePicture: profile?.profilePicture || safeUser.profilePicture || "",
    };
  }

  if (user.role === ROLES.UNIVERSITY) {
    const profile = await UniversityProfile.findOne({ university: user._id })
      .select("logo representativeProfilePicture universityName")
      .lean();
    return {
      ...safeUser,
      name: profile?.universityName || safeUser.name,
      logo: profile?.logo || "",
      representativeProfilePicture: profile?.representativeProfilePicture || "",
      profilePicture:
        profile?.representativeProfilePicture || profile?.logo || safeUser.profilePicture || "",
    };
  }

  return safeUser;
};

const register = asyncHandler(async (req, res) => {
  const {
    role,
    name,
    email,
    password,
    username,
    phone,
    representativeName,
  } = req.body;

  if (!isSupportedRole(role)) {
    throw new ApiError(400, "Invalid role selected.");
  }

  if (!name || !email || !password) {
    throw new ApiError(400, "Name, email, and password are required.");
  }

  if (role === ROLES.ADMIN) {
    throw new ApiError(403, "Admin registration is restricted.");
  }

  if (![ROLES.STUDENT, ROLES.UNIVERSITY].includes(role)) {
    throw new ApiError(403, "This account type is created by an authorized user.");
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  if (!isValidEmail(normalizedEmail)) {
    throw new ApiError(400, "Enter a valid email address.");
  }

  if (!isStrongPassword(password)) {
    throw new ApiError(
      400,
      "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
    );
  }

  if (role === ROLES.STUDENT && !isValidName(name)) {
    throw new ApiError(400, "Enter a valid full name.");
  }

  if (role === ROLES.UNIVERSITY) {
    if (String(name || "").trim().length < 3) {
      throw new ApiError(400, "Enter a valid university name.");
    }
    if (!isValidName(representativeName)) {
      throw new ApiError(400, "Enter a valid representative name.");
    }
    if (!isValidPhone(phone)) {
      throw new ApiError(400, "Enter a valid Pakistani mobile number.");
    }
    
  }

  const existingEmail = await User.findOne({ email: normalizedEmail });
  if (existingEmail) {
    throw new ApiError(409, "An account with this email already exists.");
  }

  if (username) {
    const normalizedUsername = String(username).trim().toLowerCase();
    const existingUsername = await User.findOne({ username: normalizedUsername });
    const pendingUsername = await PendingRegistration.findOne({
      username: normalizedUsername,
      email: { $ne: normalizedEmail },
    });
    if (existingUsername || pendingUsername) {
      throw new ApiError(409, "This username is already taken.");
    }
  }

  const verificationToken = generateVerificationToken();
  const pendingRegistrationPayload = {
    role,
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(String(password), 10),
    username: username ? String(username).trim().toLowerCase() : undefined,
    phone: phone ? String(phone).trim() : "",
    representativeName: representativeName ? String(representativeName).trim() : "",
    emailVerificationTokenHash: hashToken(verificationToken),
    emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS),
    approvalStatus:
      role === ROLES.UNIVERSITY
        ? UNIVERSITY_APPROVAL.PENDING
        : UNIVERSITY_APPROVAL.APPROVED,
  };

  await PendingRegistration.findOneAndDelete({ email: normalizedEmail });
  const pendingRegistration = await PendingRegistration.create(pendingRegistrationPayload);
  const verificationUrl = buildEmailVerificationUrl(req, verificationToken, pendingRegistration.email);

  let emailDelivery;
  try {
    emailDelivery = await sendEmailVerificationLinkEmail({
      to: pendingRegistration.email,
      name: pendingRegistration.name,
      verificationUrl,
      validForHours: EMAIL_VERIFICATION_EXPIRY_HOURS,
    });
  } catch (error) {
    await PendingRegistration.deleteOne({ _id: pendingRegistration._id });
    throw new ApiError(
      500,
      error?.message || "Unable to send verification email. Please try again."
    );
  }

  if (!emailDelivery.sent) {
    await PendingRegistration.deleteOne({ _id: pendingRegistration._id });
    throw new ApiError(
      500,
      emailDelivery.reason || "Unable to send verification email. Please try again."
    );
  }

  return res.status(202).json({
    success: true,
    message:
      role === ROLES.UNIVERSITY
        ? "Verification link sent. Verify your email to submit registration for admin approval."
        : "Verification link sent. Verify your email to complete registration.",
    data: {
      verificationRequired: true,
      email: pendingRegistration.email,
      role: pendingRegistration.role,
    },
  });
});

const login = asyncHandler(async (req, res) => {
  const { identifier, password, role } = req.body;

  if (!identifier || !password || !role) {
    throw new ApiError(400, "Identifier, password, and role are required.");
  }

  if (!isSupportedRole(role)) {
    throw new ApiError(400, "Invalid role selected.");
  }

  const normalizedIdentifier = String(identifier).trim().toLowerCase();
  if (![ROLES.BLOGGER, ROLES.UNIVERSITY].includes(role) && !isValidEmail(normalizedIdentifier)) {
    throw new ApiError(400, "Enter a valid email address.");
  }

  const query = { role };
  if ([ROLES.BLOGGER, ROLES.UNIVERSITY].includes(role)) {
    query.$or = [{ email: normalizedIdentifier }, { username: normalizedIdentifier }];
  } else {
    query.email = normalizedIdentifier;
  }

  const user = await User.findOne(query).select("+password");

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isPasswordCorrect = await user.comparePassword(String(password));
  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid credentials");
  }

  if (!user.emailVerified) {
    throw new ApiError(
      403,
      "Email is not verified yet. Please click the verification link sent to your email."
    );
  }

  if (
    user.role === ROLES.UNIVERSITY &&
    user.approvalStatus === UNIVERSITY_APPROVAL.PENDING
  ) {
    throw new ApiError(
      403,
      "University account is pending admin approval. Please try again later."
    );
  }

  if (
    user.role === ROLES.UNIVERSITY &&
    user.approvalStatus === UNIVERSITY_APPROVAL.REJECTED
  ) {
    throw new ApiError(
      403,
      "University registration was rejected. Contact system admin support."
    );
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signAuthToken({
    userId: user._id.toString(),
    role: user.role,
  });

  return res.status(200).json({
    success: true,
    message: "Login successful.",
    data: {
      token,
      user: await buildAuthUser(user),
    },
  });
});

const me = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      user: await buildAuthUser(req.user),
    },
  });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const token = String(req.query?.token || req.body?.token || "").trim();
  if (!token) {
    throw new ApiError(400, "Verification token is required.");
  }

  const tokenHash = hashToken(token);
  const pendingRegistration = await PendingRegistration.findOne({
    emailVerificationTokenHash: tokenHash,
  }).select("+passwordHash +emailVerificationTokenHash");

  if (pendingRegistration) {
    if (new Date(pendingRegistration.emailVerificationExpiresAt).getTime() < Date.now()) {
      await PendingRegistration.deleteOne({ _id: pendingRegistration._id });
      throw new ApiError(400, "Verification link has expired. Please register again.");
    }

    const createdUser = await createVerifiedUserFromPendingRegistration(pendingRegistration);

    return res.status(200).json({
      success: true,
      message:
        createdUser.role === ROLES.UNIVERSITY
          ? "Email verified successfully. Your registration is waiting for admin approval."
          : "Email verified successfully. You can now login.",
      data: {
        role: createdUser.role,
        email: createdUser.email,
      },
    });
  }

  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
  }).select("+emailVerificationTokenHash +emailVerificationExpiresAt +emailVerified");

  if (!user || !user.emailVerificationTokenHash || !user.emailVerificationExpiresAt) {
    throw new ApiError(400, "Invalid or expired verification link.");
  }

  if (user.emailVerified) {
    return res.status(200).json({
      success: true,
      message: "Email is already verified. You can login.",
      data: {
        role: user.role,
        email: user.email,
      },
    });
  }

  if (new Date(user.emailVerificationExpiresAt).getTime() < Date.now()) {
    clearEmailVerification(user);
    await user.save({ validateBeforeSave: false });
    throw new ApiError(400, "Verification link has expired. Please register again.");
  }

  user.emailVerified = true;
  // Keep verification token data for idempotent link handling (e.g., email scanners).
  await user.save({ validateBeforeSave: false });

  return res.status(200).json({
    success: true,
    message: "Email verified successfully. You can now login.",
    data: {
      role: user.role,
      email: user.email,
    },
  });
});

const resendEmailVerification = asyncHandler(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    throw new ApiError(400, "Enter a valid email address.");
  }

  const pendingRegistration = await PendingRegistration.findOne({ email }).select(
    "+emailVerificationTokenHash"
  );

  if (pendingRegistration) {
    if (new Date(pendingRegistration.emailVerificationExpiresAt).getTime() < Date.now()) {
      await PendingRegistration.deleteOne({ _id: pendingRegistration._id });
      throw new ApiError(400, "Verification link has expired. Please register again.");
    }

    const verificationToken = generateVerificationToken();
    pendingRegistration.emailVerificationTokenHash = hashToken(verificationToken);
    pendingRegistration.emailVerificationExpiresAt = new Date(
      Date.now() + EMAIL_VERIFICATION_EXPIRY_MS
    );
    await pendingRegistration.save({ validateBeforeSave: false });

    const verificationUrl = buildEmailVerificationUrl(
      req,
      verificationToken,
      pendingRegistration.email
    );
    const emailDelivery = await sendEmailVerificationLinkEmail({
      to: pendingRegistration.email,
      name: pendingRegistration.name,
      verificationUrl,
      validForHours: EMAIL_VERIFICATION_EXPIRY_HOURS,
    });

    if (!emailDelivery.sent) {
      throw new ApiError(
        500,
        emailDelivery.reason || "Unable to send verification email. Please try again."
      );
    }

    return res.status(200).json({
      success: true,
      message: "Verification link sent to your email.",
      data: {
        role: pendingRegistration.role,
        email: pendingRegistration.email,
      },
    });
  }

  const user = await User.findOne({ email }).select(
    "+emailVerificationTokenHash +emailVerificationExpiresAt +emailVerified"
  );

  if (!user) {
    throw new ApiError(404, "No account found with this email address.");
  }

  if (user.emailVerified) {
    return res.status(200).json({
      success: true,
      message: "Email is already verified. You can login.",
      data: {
        role: user.role,
        email: user.email,
      },
    });
  }

  const verificationToken = generateVerificationToken();
  user.emailVerificationTokenHash = hashToken(verificationToken);
  user.emailVerificationExpiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS);
  await user.save({ validateBeforeSave: false });

  const verificationUrl = buildEmailVerificationUrl(req, verificationToken, user.email);
  const emailDelivery = await sendEmailVerificationLinkEmail({
    to: user.email,
    name: user.name,
    verificationUrl,
    validForHours: EMAIL_VERIFICATION_EXPIRY_HOURS,
  });

  if (!emailDelivery.sent) {
    throw new ApiError(
      500,
      emailDelivery.reason || "Unable to send verification email. Please try again."
    );
  }

  return res.status(200).json({
    success: true,
    message: "Verification link sent to your email.",
    data: {
      role: user.role,
      email: user.email,
    },
  });
});

const requestPasswordResetOtp = asyncHandler(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    throw new ApiError(400, "Enter a valid email address.");
  }

  const user = await User.findOne({ email }).select(
    "+passwordResetOtpHash +passwordResetOtpExpiresAt"
  );

  if (!user) {
    throw new ApiError(404, "Email is not registered.");
  }

  const otp = generateOtp();
  user.passwordResetOtpHash = hashOtp(otp);
  user.passwordResetOtpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
  await user.save({ validateBeforeSave: false });

  const emailDelivery = await sendPasswordResetOtpEmail({
    to: user.email,
    name: user.name,
    otp,
    validForMinutes: OTP_EXPIRY_MINUTES,
  });

  if (!emailDelivery.sent) {
    throw new ApiError(500, emailDelivery.reason || "Unable to send OTP email.");
  }

  return res.status(200).json({
    success: true,
    message: "OTP sent to your registered email.",
  });
});

const verifyPasswordResetOtp = asyncHandler(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const otp = String(req.body?.otp || "").trim();

  if (!email || !otp) {
    throw new ApiError(400, "Email and OTP are required.");
  }

  const user = await User.findOne({ email }).select(
    "+passwordResetOtpHash +passwordResetOtpExpiresAt"
  );

  if (!user || !user.passwordResetOtpHash || !user.passwordResetOtpExpiresAt) {
    throw new ApiError(400, "Invalid or expired OTP.");
  }

  if (new Date(user.passwordResetOtpExpiresAt).getTime() < Date.now()) {
    clearPasswordResetOtp(user);
    await user.save({ validateBeforeSave: false });
    throw new ApiError(400, "OTP expired. Request a new OTP.");
  }

  const incomingOtpHash = hashOtp(otp);
  if (incomingOtpHash !== user.passwordResetOtpHash) {
    throw new ApiError(400, "Invalid OTP.");
  }

  return res.status(200).json({
    success: true,
    message: "OTP verified successfully.",
  });
});

const resetPasswordWithOtp = asyncHandler(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const otp = String(req.body?.otp || "").trim();
  const newPassword = String(req.body?.newPassword || "");
  const confirmPassword = String(req.body?.confirmPassword || "");

  if (!email || !otp || !newPassword || !confirmPassword) {
    throw new ApiError(400, "Email, OTP, new password, and confirm password are required.");
  }

  if (!isStrongPassword(newPassword)) {
    throw new ApiError(
      400,
      "New password must be at least 8 characters and include uppercase, lowercase, number, and special character."
    );
  }

  if (newPassword !== confirmPassword) {
    throw new ApiError(400, "New password and confirm password do not match.");
  }

  const user = await User.findOne({ email }).select(
    "+password +passwordResetOtpHash +passwordResetOtpExpiresAt"
  );

  if (!user || !user.passwordResetOtpHash || !user.passwordResetOtpExpiresAt) {
    throw new ApiError(400, "Invalid or expired OTP.");
  }

  if (new Date(user.passwordResetOtpExpiresAt).getTime() < Date.now()) {
    clearPasswordResetOtp(user);
    await user.save({ validateBeforeSave: false });
    throw new ApiError(400, "OTP expired. Request a new OTP.");
  }

  const incomingOtpHash = hashOtp(otp);
  if (incomingOtpHash !== user.passwordResetOtpHash) {
    throw new ApiError(400, "Invalid OTP.");
  }

  user.password = newPassword;
  clearPasswordResetOtp(user);
  await user.save();

  return res.status(200).json({
    success: true,
    message: "Password reset successful. You can now login with your new password.",
  });
});

module.exports = {
  register,
  login,
  me,
  verifyEmail,
  resendEmailVerification,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithOtp,
};
