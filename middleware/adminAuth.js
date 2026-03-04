/**
 * Admin Authentication Middleware
 * 
 * For now, this is a simple middleware that checks for admin credentials.
 * In production, you should use JWT tokens or session-based authentication.
 */

const AdminUser = require("../models/AdminUser");

const adminAuth = async (req, res, next) => {
  try {
    // Get credentials from headers, body, or query
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

    // If no credentials provided, return unauthorized
    if (!username || !password) {
      return res.status(401).json({
        status: "error",
        message: "Admin authentication required",
      });
    }

    // Verify admin credentials
    const admin = await AdminUser.findOne({ 
      username: username.trim().toLowerCase() 
    });

    if (!admin || admin.password !== password.trim()) {
      return res.status(401).json({
        status: "error",
        message: "Invalid admin credentials",
      });
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
      roleLevel: admin.constructor.ROLE_LEVELS[admin.role] || 0,
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

