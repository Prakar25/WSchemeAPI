const express = require("express");
const router = express.Router();
const AdminUser = require("../models/AdminUser");
const adminAuth = require("../middleware/adminAuth");

// Helper function to format admin user response
const formatAdminUser = (user) => {
  const roleLevel = AdminUser.ROLE_LEVELS[user.role] || 0;
  return {
    _id: user._id,
    fullName: user.fullName,
    username: user.username,
    contactNumber: user.contactNumber,
    role: user.role,
    roleLevel: roleLevel,
    department: user.department || null,
    departmentId: user.departmentId || null,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

// GET /api/admin/profile/roles/list - Get all available roles with levels (must be before /:admin_id)
router.get("/roles/list", adminAuth, async (req, res) => {
  try {
    const roles = Object.entries(AdminUser.ROLES).map(([key, value]) => ({
      key: key,
      name: value,
      level: AdminUser.ROLE_LEVELS[value] || 0,
    }));

    // Sort by level (ascending: Super Admin = 1 first, CSCAdmin = 5 last)
    roles.sort((a, b) => a.level - b.level);

    res.status(200).json({
      status: "success",
      roles: roles,
    });
  } catch (error) {
    console.error("Error fetching roles list:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch roles list",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/admin/profile - Get current admin profile (from authenticated session)
// Also supports query param: ?admin_id=XXX
router.get("/", adminAuth, async (req, res) => {
  try {
    const { admin_id } = req.query;
    let adminId;

    if (admin_id) {
      // If admin_id provided in query, use it
      adminId = admin_id;
    } else {
      // Otherwise, use authenticated admin's ID
      adminId = req.admin._id;
    }

    const user = await AdminUser.findById(adminId);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Admin user not found",
      });
    }

    const formatted = formatAdminUser(user);
    res.status(200).json({
      status: "success",
      user: formatted,
      // Top-level role fields for frontend (same as user.role / user.roleLevel)
      role: formatted.role,
      roleLevel: formatted.roleLevel,
    });
  } catch (error) {
    console.error("Error fetching admin profile:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid admin ID",
      });
    }
    res.status(500).json({
      status: "error",
      message: "Failed to fetch admin profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/admin/profile/:admin_id - Get admin profile by ID (requires admin auth)
router.get("/:admin_id", adminAuth, async (req, res) => {
  try {
    const { admin_id } = req.params;

    const user = await AdminUser.findById(admin_id);

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Admin user not found",
      });
    }

    res.status(200).json({
      status: "success",
      user: formatAdminUser(user),
    });
  } catch (error) {
    console.error("Error fetching admin profile:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid admin ID",
      });
    }
    res.status(500).json({
      status: "error",
      message: "Failed to fetch admin profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;

