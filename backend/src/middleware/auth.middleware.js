const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { verifyAuthToken } = require("../utils/jwt");
const { USER_STATUS } = require("../constants/roles");

const AUTH_USER_PROJECTION = [
  "name",
  "email",
  "username",
  "role",
  "approvalStatus",
  "status",
  "representativeName",
  "phone",
  "location",
  "website",
  "establishedYear",
  "studentCount",
  "programsOffered",
  "managedUniversity",
  "emailVerified",
].join(" ");

const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "Authorization token is required.");
  }

  let decoded;
  try {
    decoded = verifyAuthToken(token);
  } catch {
    throw new ApiError(401, "Invalid or expired token.");
  }

  const user = await User.findById(decoded.userId).select(AUTH_USER_PROJECTION);

  if (!user) {
    throw new ApiError(401, "User account not found.");
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw new ApiError(403, "User account is inactive.");
  }

  req.user = user;
  next();
});

const optionalProtect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = verifyAuthToken(token);
    const user = await User.findById(decoded.userId).select(AUTH_USER_PROJECTION);
    req.user = user || null;
    return next();
  } catch {
    req.user = null;
    return next();
  }
});

const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized.");
  }

  if (!roles.includes(req.user.role)) {
    throw new ApiError(403, "You do not have permission to perform this action.");
  }

  next();
};

module.exports = {
  protect,
  optionalProtect,
  authorize,
};
