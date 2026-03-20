const express = require("express");
const router = express.Router();
const AdminUser = require("../models/AdminUser");
const adminAuth = require("../middleware/adminAuth");
const { signAdminToken } = require("../utils/jwtUtils");
const { comparePassword } = require("../utils/passwordUtils");

// POST /api/admin-login
// Accepts credentials in body or query: { username, password }
// Returns user info + token (JWT) for subsequent requests via Authorization: Bearer <token>
router.post("/", async (req, res) => {
  const username = (req.body?.username || req.query?.username || "")
    .trim()
    .toLowerCase();
  const password = (req.body?.password || req.query?.password || "").trim();

  if (!username || !password) {
    return res.status(400).json({
      status: "error",
      message: "username and password are required",
    });
  }

  try {
    const user = await AdminUser.findOne({ username });

    const passwordMatch = user && (await comparePassword(password, user.password));
    if (!user || !passwordMatch) {
      return res.status(401).json({
        status: "unauthorized",
        message: "Invalid credentials",
      });
    }

    // Check if admin is active
    if (!user.isActive) {
      return res.status(403).json({
        status: "error",
        message: "Admin account is inactive",
      });
    }

    // Reject pending admins (must be verified by Super Admin or Secretary)
    const status = user.status || "verified";
    if (status === "pending") {
      return res.status(403).json({
        status: "error",
        message: "Your account is pending verification.",
      });
    }
    if (status === "rejected") {
      return res.status(403).json({
        status: "error",
        message: "Your account verification was rejected. Please contact support.",
      });
    }

    // Get role level
    const roleLevel = AdminUser.ROLE_LEVELS[user.role] || 0;

    // Issue JWT for subsequent requests
    const token = signAdminToken({
      adminId: user._id,
      username: user.username,
      role: user.role,
      roleLevel,
    });

    const userPayload = {
      _id: user._id,
      fullName: user.fullName,
      username: user.username,
      contactNumber: user.contactNumber,
      role: user.role,
      roleLevel: roleLevel,
      department: user.department || null,
      departmentId: user.departmentId || null,
    };
    return res.status(200).json({
      status: "success",
      token,
      user: userPayload,
      role: user.role,
      roleLevel,
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

// PUT /api/admin-login/:adminId/update-role - Update admin role (for fixing roles)
router.put("/:adminId/update-role", adminAuth, async (req, res) => {
  try {
    const { adminId } = req.params;
    const { role } = req.body;
    const currentAdmin = req.admin;

    // Only Super Admin or Admin can update roles
    if (currentAdmin.roleLevel > 2) {
      return res.status(403).json({
        status: "error",
        message: "Only Super Admin or Admin can update roles",
      });
    }

    if (!role || !Object.values(AdminUser.ROLES).includes(role)) {
      return res.status(400).json({
        status: "error",
        message: "Valid role is required",
        availableRoles: Object.values(AdminUser.ROLES),
      });
    }

    const admin = await AdminUser.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        status: "error",
        message: "Admin not found",
      });
    }

    admin.role = role;
    await admin.save();

    res.status(200).json({
      status: "success",
      message: "Admin role updated successfully",
      admin: {
        _id: admin._id,
        fullName: admin.fullName,
        username: admin.username,
        role: admin.role,
        roleLevel: AdminUser.ROLE_LEVELS[admin.role],
      },
    });
  } catch (error) {
    console.error("Error updating admin role:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to update admin role",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
