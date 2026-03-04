const express = require("express");
const router = express.Router();
const PublicUser = require("../models/PublicUser");
const AdminUser = require("../models/AdminUser");
const Application = require("../models/Application");
const adminAuth = require("../middleware/adminAuth");

/**
 * Require CSDAdmin role to access CSD verification endpoints
 */
const requireCsdAdmin = (req, res, next) => {
  const role = req.admin?.role;
  if (role === AdminUser.ROLES.CSD_ADMIN) {
    return next();
  }
    return res.status(403).json({
    status: "error",
    message: "Only CSDAdmin can access this resource",
  });
};

/**
 * GET /api/csd/pending-applications
 * List scheme applications pending CSD Admin review (verification_level === 9)
 * Requires: admin auth, CSDAdmin role
 */
router.get("/pending-applications", adminAuth, requireCsdAdmin, async (req, res) => {
  try {
    const applications = await Application.find({ verification_level: 9, status: { $ne: "Rejected" } })
      .populate("user_id", "demographics.fullName demographics.gender contact.mobile.value contact.email.value")
      .populate("scheme_id", "scheme_name department category")
      .sort({ date_applied: -1 });

    const list = applications.map((app) => ({
      _id: app._id,
      applicantName: app.user_id?.demographics?.fullName || "Unknown",
      applicantMobile: app.user_id?.contact?.mobile?.value || null,
      schemeName: app.scheme_id?.scheme_name || "Unknown",
      schemeId: app.scheme_id?._id || null,
      date_applied: app.date_applied,
      verification_level: app.verification_level,
      verification_stage: "CSD Admin Review",
      status: app.status,
    }));

    return res.status(200).json({
      status: "success",
      pendingApplications: list,
      applications: list,
      count: list.length,
    });
  } catch (error) {
    console.error("Error fetching pending applications:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

/**
 * GET /api/csd/pending-public-users
 * List public users with verificationStatus "pending" (for CSDAdmin)
 * Requires: admin auth (x-admin-username, x-admin-password), CSDAdmin role
 */
router.get("/pending-public-users", adminAuth, requireCsdAdmin, async (req, res) => {
  try {
    const users = await PublicUser.find({ "status.verificationStatus": "pending" })
      .select(
        "_id demographics.fullName demographics.gender demographics.dob contact.mobile.value contact.email.value address status.verificationStatus kycLevel audit.createdAt"
      )
      .sort({ "audit.createdAt": -1 });

    const list = users.map((u) => ({
      _id: u._id,
      fullName: u.demographics?.fullName || null,
      gender: u.demographics?.gender || null,
      dob: u.demographics?.dob?.date || null,
      mobile: u.contact?.mobile?.value || null,
      email: u.contact?.email?.value || null,
      address: u.address || null,
      verificationStatus: u.status?.verificationStatus || "pending",
      kycLevel: u.kycLevel || "BASIC",
      createdAt: u.audit?.createdAt || u.createdAt,
    }));

    return res.status(200).json({
      status: "success",
      pendingPublicUsers: list,
      users: list,
      count: list.length,
    });
  } catch (error) {
    console.error("Error fetching pending public users:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

/**
 * POST /api/csd/verify-public-user
 * Approve or reject a pending public user (CSDAdmin only)
 *
 * Body: {
 *   userId: string,           // PublicUser _id
 *   action: "approve" | "reject",
 *   rejectionReason?: string  // optional, for action "reject"
 * }
 */
router.post("/verify-public-user", adminAuth, requireCsdAdmin, async (req, res) => {
  try {
    const { userId, action, rejectionReason } = req.body;

    if (!userId || !action) {
      return res.status(400).json({
        status: "error",
        message: "userId and action are required",
      });
    }

    const actionLower = String(action).toLowerCase();
    if (actionLower !== "approve" && actionLower !== "reject") {
      return res.status(400).json({
        status: "error",
        message: 'action must be "approve" or "reject"',
      });
    }

    const user = await PublicUser.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Public user not found",
      });
    }

    const currentStatus = user.status?.verificationStatus || "pending";
    if (currentStatus !== "pending") {
      return res.status(400).json({
        status: "error",
        message: `User is not pending (current status: ${currentStatus})`,
      });
    }

    const csdAdminId = req.admin._id;

    if (actionLower === "approve") {
      user.status = user.status || {};
      user.status.verificationStatus = "verified";
      user.status.verifiedBy = csdAdminId;
      user.status.verifiedAt = new Date();
      user.status.rejectionReason = null;
    } else {
      user.status = user.status || {};
      user.status.verificationStatus = "rejected";
      user.status.verifiedBy = null;
      user.status.verifiedAt = null;
      user.status.rejectionReason = rejectionReason ? String(rejectionReason).trim() : null;
    }

    await user.save();

    return res.status(200).json({
      status: "success",
      message: actionLower === "approve" ? "Public user verified successfully" : "Public user rejected",
      user: {
        _id: user._id,
        fullName: user.demographics?.fullName || null,
        verificationStatus: user.status.verificationStatus,
      },
    });
  } catch (error) {
    console.error("Error verifying public user:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid user ID",
      });
    }
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

module.exports = router;
