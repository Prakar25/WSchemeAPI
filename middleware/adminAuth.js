/**
 * Admin Authentication Middleware
 *
 * Supports two auth methods (in order):
 * 1. JWT: Authorization: Bearer <token> (from POST /api/admin-login)
 * 2. Headers: x-admin-username + x-admin-password (legacy)
 */

const AdminUser = require("../models/AdminUser");
const { verifyAdminToken } = require("../utils/jwtUtils");
const { comparePassword } = require("../utils/passwordUtils");

const adminAuth = async (req, res, next) => {
  try {
    let admin = null;

    // 1. Try JWT first (Authorization: Bearer <token>)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const decoded = verifyAdminToken(token);
      if (decoded && decoded.adminId) {
        admin = await AdminUser.findById(decoded.adminId);
      }
    }

    // 2. Fall back to username/password headers (legacy)
    if (!admin) {
      const username =
        req.headers["x-admin-username"] ||
        req.body?.username ||
        req.query?.username ||
        "";
      const password =
        req.headers["x-admin-password"] ||
        req.body?.password ||
        req.query?.password ||
        "";

      if (!username || !password) {
        return res.status(401).json({
          status: "error",
          message: "Admin authentication required",
        });
      }

      admin = await AdminUser.findOne({
        username: username.trim().toLowerCase(),
      });

      const passwordMatch = admin && (await comparePassword(password.trim(), admin.password));
      if (!admin || !passwordMatch) {
        return res.status(401).json({
          status: "error",
          message: "Invalid admin credentials",
        });
      }
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(403).json({
        status: "error",
        message: "Admin account is inactive",
      });
    }

    // Reject pending or rejected admins
    const status = admin.status || "verified";
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

    // Attach admin info to request for use in routes
    req.admin = {
      _id: admin._id,
      username: admin.username,
      fullName: admin.fullName,
      role: admin.role,
      roleLevel: AdminUser.ROLE_LEVELS[admin.role] || 0,
      department: admin.department || null,
      departmentId: admin.departmentId || null,
    };

    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    return res.status(500).json({
      status: "error",
      message: "Authentication error",
    });
  }
};

module.exports = adminAuth;

