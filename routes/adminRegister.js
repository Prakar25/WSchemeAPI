const express = require("express");
const router = express.Router();
const AdminUser = require("../models/AdminUser");
const Department = require("../models/Department");
const mongoose = require("mongoose");

/**
 * GET /api/admin-registration-options
 * Combined roles + departments for admin registration form (optional)
 */
router.get("/options", async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true })
      .select("_id department_name department_display_name")
      .sort({ department_display_name: 1 });

    const roleLevelMap = AdminUser.ROLE_LEVEL_TO_ROLE;
    const roles = Object.entries(roleLevelMap)
      .map(([levelStr, role]) => ({
        level: parseInt(levelStr, 10),
        role,
        displayName: role,
      }))
      .sort((a, b) => a.level - b.level);

    return res.status(200).json({
      status: "success",
      departments: departments.map((d) => ({
        _id: d._id.toString(),
        department_name: d.department_name,
        department_display_name: d.department_display_name,
      })),
      roles,
    });
  } catch (error) {
    console.error("Error fetching registration options:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

/**
 * POST /api/admin-register
 * Register a new admin. Account starts as "pending" until Super Admin or Secretary verifies.
 *
 * Body: username, password, fullName, email, contactNumber (optional), roleLevel (2-9), departmentId (optional)
 */
router.post("/", async (req, res) => {
  try {
    const {
      username,
      password,
      fullName,
      email,
      contactNumber,
      roleLevel,
      departmentId,
    } = req.body;

    if (!username || !password || !fullName || !email || roleLevel == null) {
      return res.status(400).json({
        status: "error",
        message:
          "username, password, fullName, email, and roleLevel are required",
      });
    }

    const usernameTrimmed = String(username).trim().toLowerCase();
    const passwordTrimmed = String(password).trim();
    const fullNameTrimmed = String(fullName).trim();
    const emailTrimmed = String(email).trim().toLowerCase();

    if (!usernameTrimmed) {
      return res.status(400).json({
        status: "error",
        message: "Username is required",
      });
    }

    if (!passwordTrimmed || passwordTrimmed.length < 6) {
      return res.status(400).json({
        status: "error",
        message: "Password must be at least 6 characters",
      });
    }

    if (!fullNameTrimmed) {
      return res.status(400).json({
        status: "error",
        message: "Full name is required",
      });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(emailTrimmed)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid email format",
      });
    }

    // Accept roleLevel as number, string "2", or role object { level: 2 }
    const levelValue =
      roleLevel != null && typeof roleLevel === "object" && "level" in roleLevel
        ? roleLevel.level
        : roleLevel;
    const roleLevelNum = parseInt(String(levelValue).trim(), 10);
    if (
      Number.isNaN(roleLevelNum) ||
      roleLevelNum < 2 ||
      roleLevelNum > 9
    ) {
      return res.status(400).json({
        status: "error",
        message: "roleLevel must be an integer between 2 and 9",
      });
    }

    const role = AdminUser.ROLE_LEVEL_TO_ROLE[roleLevelNum];
    if (!role) {
      return res.status(400).json({
        status: "error",
        message: "Invalid roleLevel",
      });
    }

    let departmentName = null;
    let departmentIdStr = null;
    if (departmentId != null && departmentId !== "") {
      if (!mongoose.Types.ObjectId.isValid(departmentId)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid departmentId",
        });
      }
      const department = await Department.findById(departmentId);
      if (!department) {
        return res.status(400).json({
          status: "error",
          message: "Department not found",
        });
      }
      departmentName = department.department_name;
      departmentIdStr = department._id.toString();
    }

    if (contactNumber != null && contactNumber !== "") {
      const contactStr = String(contactNumber).trim();
      if (!/^\d{10}$/.test(contactStr)) {
        return res.status(400).json({
          status: "error",
          message: "contactNumber must be a 10-digit number if provided",
        });
      }
    }

    const existingAdmin = await AdminUser.findOne({ username: usernameTrimmed });
    if (existingAdmin) {
      return res.status(400).json({
        status: "error",
        message: "Username already exists",
      });
    }

    const admin = await AdminUser.create({
      username: usernameTrimmed,
      password: passwordTrimmed,
      fullName: fullNameTrimmed,
      email: emailTrimmed,
      contactNumber: contactNumber != null ? String(contactNumber).trim() : null,
      role,
      department: departmentName,
      departmentId: departmentIdStr,
      status: "pending",
      isActive: true,
    });

    return res.status(201).json({
      status: "success",
      message: "Registration successful. Your account is pending verification.",
      admin: {
        _id: admin._id,
        username: admin.username,
        fullName: admin.fullName,
        email: admin.email,
        status: admin.status,
      },
    });
  } catch (error) {
    console.error("Admin registration error:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        status: "error",
        message: "Username already exists",
      });
    }
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

module.exports = router;
