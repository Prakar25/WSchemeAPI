const express = require("express");
const router = express.Router();
const AdminUser = require("../models/AdminUser");

/**
 * GET /api/admin-roles - Get all admin roles with their levels
 * Returns the role hierarchy and levels for frontend use
 */
router.get("/", async (req, res) => {
  try {
    const ROLES = AdminUser.ROLES;
    const ROLE_LEVELS = AdminUser.ROLE_LEVELS;

    // Get all roles with their levels
    const roles = Object.entries(ROLE_LEVELS).map(([role, level]) => ({
      role: role,
      level: level,
      displayName: role,
    }));

    // Sort by level (ascending - lower number = higher authority)
    roles.sort((a, b) => a.level - b.level);

    res.status(200).json({
      status: "success",
      roles: roles,
      roleLevels: ROLE_LEVELS,
      adminRoles: ROLES,
      count: roles.length,
    });
  } catch (error) {
    console.error("Error fetching admin roles:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch admin roles",
      message: error.message,
    });
  }
});

/**
 * GET /api/admin-roles/hierarchy - Get role hierarchy with descriptions
 * Returns roles organized by hierarchy level
 */
router.get("/hierarchy", async (req, res) => {
  try {
    const ROLE_LEVELS = AdminUser.ROLE_LEVELS;

    // Create hierarchy array
    const hierarchy = Object.entries(ROLE_LEVELS)
      .map(([role, level]) => ({
        role: role,
        level: level,
        displayName: role,
        isHigherAuthority: level <= 4, // Department Head and above
      }))
      .sort((a, b) => a.level - b.level);

    // Group by authority level
    const grouped = {
      highest: hierarchy.filter((r) => r.level <= 2), // Super Admin, Admin
      high: hierarchy.filter((r) => r.level >= 3 && r.level <= 4), // Department Secretary, Department Head
      medium: hierarchy.filter((r) => r.level === 5), // DistrictHQ Head
      standard: hierarchy.filter((r) => r.level >= 6), // Department User and below
    };

    res.status(200).json({
      status: "success",
      hierarchy: hierarchy,
      grouped: grouped,
      roleLevels: ROLE_LEVELS,
      count: hierarchy.length,
    });
  } catch (error) {
    console.error("Error fetching role hierarchy:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch role hierarchy",
      message: error.message,
    });
  }
});

/**
 * GET /api/admin-roles/for-authorization - Get roles suitable for scheme authorization levels
 * Returns roles that can be used in authorization_levels array
 * These are typically roles with levels 1-8 (all roles)
 */
router.get("/for-authorization", async (req, res) => {
  try {
    const ROLE_LEVELS = AdminUser.ROLE_LEVELS;

    // Get all roles with levels
    const rolesForAuthorization = Object.entries(ROLE_LEVELS)
      .map(([role, level]) => ({
        role: role,
        level: level,
        displayName: role,
      }))
      .sort((a, b) => a.level - b.level);

    res.status(200).json({
      status: "success",
      roles: rolesForAuthorization,
      note: "These roles can be used in scheme authorization_levels array (max 4 levels)",
      count: rolesForAuthorization.length,
    });
  } catch (error) {
    console.error("Error fetching authorization roles:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch authorization roles",
      message: error.message,
    });
  }
});

module.exports = router;
