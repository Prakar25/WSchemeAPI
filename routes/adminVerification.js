const express = require("express");
const router = express.Router();
const AdminUser = require("../models/AdminUser");
const Department = require("../models/Department");
const adminAuth = require("../middleware/adminAuth");

/**
 * GET /api/admin/me - Current admin's role and basic info (from JWT/session)
 * Use for "who am I" / access checks without full profile fetch
 */
router.get("/me", adminAuth, (req, res) => {
  res.status(200).json({
    status: "success",
    admin: {
      _id: req.admin._id,
      username: req.admin.username,
      fullName: req.admin.fullName,
      role: req.admin.role,
      roleLevel: req.admin.roleLevel,
      department: req.admin.department || null,
      departmentId: req.admin.departmentId || null,
    },
    role: req.admin.role,
    roleLevel: req.admin.roleLevel,
  });
});

/**
 * Require Super Admin or DistrictHQ Head to access
 */
const requireVerifier = (req, res, next) => {
  const role = req.admin?.role;
  const level = req.admin?.roleLevel;
  if (
    role === AdminUser.ROLES.SUPER_ADMIN ||
    role === AdminUser.ROLES.DISTRICTHQ_HEAD
  ) {
    return next();
  }
  return res.status(403).json({
    status: "error",
    message: "Only Super Admin or DistrictHQ Head can verify pending admins",
  });
};

/**
 * GET /api/admin/pending-admins
 * List admins with status "pending" (for Super Admin / Secretary)
 */
router.get("/pending-admins", adminAuth, requireVerifier, async (req, res) => {
  try {
    const admins = await AdminUser.find({ status: "pending" })
      .select("username fullName email contactNumber role department departmentId status createdAt")
      .sort({ createdAt: -1 });

    const roleLevels = AdminUser.ROLE_LEVELS;
    const list = admins.map((a) => ({
      _id: a._id,
      username: a.username,
      fullName: a.fullName,
      email: a.email,
      contactNumber: a.contactNumber,
      role: a.role,
      roleLevel: roleLevels[a.role] ?? 0,
      department: a.department,
      departmentId: a.departmentId,
      status: a.status,
      createdAt: a.createdAt,
    }));

    return res.status(200).json({
      status: "success",
      pendingAdmins: list,
      admins: list, // alias for backward compatibility
      count: list.length,
    });
  } catch (error) {
    console.error("Error fetching pending admins:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

/**
 * POST /api/admin/verify-admin
 * Approve or reject a pending admin (Super Admin or Secretary only)
 *
 * Body: { adminId: string, action: "approve" | "reject", rejectionReason?: string }
 */
router.post("/verify-admin", adminAuth, requireVerifier, async (req, res) => {
  try {
    const { adminId, action, rejectionReason } = req.body;

    if (!adminId || !action) {
      return res.status(400).json({
        status: "error",
        message: "adminId and action are required",
      });
    }

    const actionLower = String(action).toLowerCase();
    if (actionLower !== "approve" && actionLower !== "reject") {
      return res.status(400).json({
        status: "error",
        message: 'action must be "approve" or "reject"',
      });
    }

    const admin = await AdminUser.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        status: "error",
        message: "Admin not found",
      });
    }

    if (admin.status !== "pending") {
      return res.status(400).json({
        status: "error",
        message: `Admin is not pending (current status: ${admin.status})`,
      });
    }

    const currentAdminId = req.admin._id;

    if (actionLower === "approve") {
      admin.status = "verified";
      admin.verifiedBy = currentAdminId;
      admin.verifiedAt = new Date();
      admin.rejectionReason = null;
    } else {
      admin.status = "rejected";
      admin.rejectionReason = rejectionReason ? String(rejectionReason).trim() : null;
      admin.verifiedBy = null;
      admin.verifiedAt = null;
    }

    await admin.save();

    return res.status(200).json({
      status: "success",
      message:
        actionLower === "approve"
          ? "Admin approved successfully"
          : "Admin rejected",
      admin: {
        _id: admin._id,
        username: admin.username,
        fullName: admin.fullName,
        status: admin.status,
      },
    });
  } catch (error) {
    console.error("Error verifying admin:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

module.exports = router;
