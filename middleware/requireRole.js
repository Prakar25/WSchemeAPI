/**
 * Role-Based Authorization Middleware
 * 
 * Checks if the authenticated admin has the required role level or higher.
 * Hierarchy: Super Admin (1) > Admin (2) > ... > CSCAdmin (5)
 * Lower number = Higher authority
 * Must be used after adminAuth middleware.
 */

const AdminUser = require("../models/AdminUser");

/**
 * Middleware factory to require minimum role level
 * @param {string|string[]} requiredRoles - Single role or array of roles that are allowed
 * @returns {Function} Express middleware
 */
const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    try {
      // Check if admin is authenticated (should be set by adminAuth middleware)
      if (!req.admin) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required",
        });
      }

      const userRole = req.admin.role;
      const userRoleLevel = req.admin.roleLevel || 0;

      // Convert single role to array
      const allowedRoles = Array.isArray(requiredRoles) 
        ? requiredRoles 
        : [requiredRoles];

      // Check if user has one of the required roles
      // Lower number = higher authority (Super Admin = 1, CSCAdmin = 5)
      let hasAccess = false;
      let requiredLevel = 999;

      for (const role of allowedRoles) {
        const roleLevel = AdminUser.ROLE_LEVELS[role] || 999;
        if (userRole === role || userRoleLevel <= roleLevel) {
          hasAccess = true;
          requiredLevel = Math.min(requiredLevel, roleLevel);
          break;
        }
      }

      if (!hasAccess) {
        return res.status(403).json({
          status: "error",
          message: `Access denied. Required role: ${allowedRoles.join(" or ")}`,
          userRole: userRole,
          requiredRoles: allowedRoles,
        });
      }

      next();
    } catch (error) {
      console.error("Role authorization error:", error);
      return res.status(500).json({
        status: "error",
        message: "Authorization error",
      });
    }
  };
};

/**
 * Middleware to require minimum role level (user must have this role or higher authority)
 * Lower number = higher authority (Super Admin = 1, CSCAdmin = 5)
 * @param {string} minimumRole - Minimum role required (user must have this or higher)
 * @returns {Function} Express middleware
 */
const requireMinimumRole = (minimumRole) => {
  return (req, res, next) => {
    try {
      if (!req.admin) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required",
        });
      }

      const userRoleLevel = req.admin.roleLevel || 999;
      const minimumLevel = AdminUser.ROLE_LEVELS[minimumRole] || 999;

      // Lower number = higher authority, so userLevel must be <= minimumLevel
      if (userRoleLevel > minimumLevel) {
        return res.status(403).json({
          status: "error",
          message: `Access denied. Minimum role required: ${minimumRole}`,
          userRole: req.admin.role,
          requiredRole: minimumRole,
        });
      }

      next();
    } catch (error) {
      console.error("Role authorization error:", error);
      return res.status(500).json({
        status: "error",
        message: "Authorization error",
      });
    }
  };
};

module.exports = requireRole;
module.exports.requireMinimumRole = requireMinimumRole;

