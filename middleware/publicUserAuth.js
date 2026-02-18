const PublicUser = require("../models/PublicUser");

/**
 * Middleware to identify logged-in public user
 * Accepts userId and/or mobileNumber from query params and/or request body.
 * No custom headers required.
 *
 * - GET: query params { userId } or { mobileNumber }
 * - PUT/DELETE: query params and/or body { userId }, { mobileNumber }
 * - POST (multipart): query params only (body not parsed until multer runs)
 */
const publicUserAuth = async (req, res, next) => {
  try {
    // Accept from query and/or body (body available for JSON requests only)
    const userId = req.query?.userId ?? req.body?.userId;
    const mobileNumber = req.query?.mobileNumber ?? req.body?.mobileNumber;

    if (!userId && !mobileNumber) {
      return res.status(401).json({
        status: "error",
        message: "User identification required. Please provide userId or mobileNumber in query params or request body.",
      });
    }

    let user;
    if (userId) {
      user = await PublicUser.findById(userId);
    } else if (mobileNumber) {
      user = await PublicUser.findOne({ "contact.mobile.value": mobileNumber.trim() });
    }

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found.",
      });
    }

    // Check if user is active
    if (!user.status?.isActive || user.status?.isDeactivated) {
      return res.status(403).json({
        status: "error",
        message: "Your account is inactive. Please contact support.",
      });
    }

    // Attach user to request object
    req.publicUser = user;
    req.userId = user._id;
    next();
  } catch (error) {
    console.error("Public user auth middleware error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

module.exports = publicUserAuth;
