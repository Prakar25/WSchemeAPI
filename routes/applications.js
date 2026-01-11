const express = require("express");
const router = express.Router();
const Application = require("../models/Application");
const Scheme = require("../models/Scheme");
const PublicUser = require("../models/PublicUser");
const AdminUser = require("../models/AdminUser");
const { checkEligibility } = require("../utils/eligibilityUtils");
const adminAuth = require("../middleware/adminAuth");

// POST /api/applications/apply - Apply to a scheme
router.post("/apply", async (req, res) => {
  try {
    const { user_id, scheme_id, form_data, documents_submitted } = req.body;

    if (!user_id || !scheme_id) {
      return res.status(400).json({
        status: "error",
        message: "User ID and Scheme ID are required",
      });
    }

    // Check if user exists
    const user = await PublicUser.findById(user_id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Check if scheme exists
    const scheme = await Scheme.findById(scheme_id);
    if (!scheme) {
      return res.status(404).json({
        status: "error",
        message: "Scheme not found",
      });
    }

    // Check if already applied
    const existingApplication = await Application.findOne({
      user_id,
      scheme_id,
    });

    if (existingApplication) {
      return res.status(400).json({
        status: "error",
        message: "Application already exists",
        application: existingApplication,
      });
    }

    // Check eligibility
    const eligibility = await checkEligibility(user, scheme, user_id);
    if (!eligibility.eligible) {
      return res.status(400).json({
        status: "error",
        message: "Not eligible for this scheme",
        reason: eligibility.reason,
      });
    }

    // Create application - starts at Level 7 or 8 (Post Operator) for initial verification
    const application = await Application.create({
      user_id,
      scheme_id,
      status: "Applied",
      verification_level: 7, // Start at Level 7 (Post Operator) - first verification step
      verification_stage: "Post_Operator_Review", // Legacy field
      form_data: form_data || {},
      documents_submitted: documents_submitted || [],
    });

    const populatedApplication = await Application.findById(application._id)
      .populate("user_id", "demographics.fullName")
      .populate("scheme_id", "scheme_name scheme_type category department");

    res.status(201).json({
      status: "success",
      message: "Application submitted successfully",
      application: populatedApplication,
    });
  } catch (error) {
    console.error("Error creating application:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(422).json({
        status: "error",
        message: "Validation error",
        errors: messages,
      });
    }
    res.status(500).json({
      status: "error",
      message: "Failed to create application",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/applications - Get applications (with filters)
router.get("/", adminAuth, async (req, res) => {
  try {
    const { user_id, scheme_id, status, verification_stage, assigned_to_me } = req.query;
    const adminRoleLevel = req.admin.roleLevel;

    const query = {};

    if (user_id) {
      query.user_id = user_id;
    }

    if (scheme_id) {
      query.scheme_id = scheme_id;
    }

    if (status) {
      query.status = status;
    }

    if (verification_stage) {
      query.verification_stage = verification_stage;
    }

    // Filter by current verifier if assigned_to_me is true
    if (assigned_to_me === "true") {
      query["current_verifier.verified_by"] = req.admin._id;
    }

    // Filter by verification level based on role level
    if (!verification_stage && !assigned_to_me) {
      // Level 7 & 8 (District Overlookers/Post Operator) - see Level 7 or 8 (FIRST)
      if (adminRoleLevel === 7 || adminRoleLevel === 8) {
        query.$or = [{ verification_level: 7 }, { verification_level: 8 }];
      }
      // Level 1 & 2 (Super Admin/Admin) - see Level 1 or 2
      else if (adminRoleLevel === 1 || adminRoleLevel === 2) {
        query.$or = [{ verification_level: 1 }, { verification_level: 2 }];
      }
      // Level 6 (DistrictHQ Head) - see Level 6
      else if (adminRoleLevel === 6) {
        query.verification_level = 6;
      }
      // Level 4 & 5 (Department Head/User) - see Level 4 or 5
      else if (adminRoleLevel === 4 || adminRoleLevel === 5) {
        query.$or = [{ verification_level: 4 }, { verification_level: 5 }];
      }
      // Level 3 (Department Secretary) - see Level 3
      else if (adminRoleLevel === 3) {
        query.verification_level = 3;
      }
    }

    const applications = await Application.find(query)
      .populate("user_id", "demographics.fullName demographics.gender demographics.dob aadhaarNumber contact")
      .populate("scheme_id", "scheme_name scheme_type category department")
      .populate("current_verifier.verified_by", "fullName username role")
      .sort({ createdAt: -1 });
    
    // Transform to include applicant name and verification info
    const transformedApplications = applications.map(app => {
      const appObj = app.toObject();
      return {
        ...appObj,
        applicantName: app.user_id?.demographics?.fullName || "Unknown",
        applicantId: app.user_id?._id || null,
        schemeName: app.scheme_id?.scheme_name || "Unknown",
        schemeId: app.scheme_id?._id || null,
      };
    });

    res.status(200).json({
      status: "success",
      data: applications,
      count: applications.length,
    });
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch applications",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/applications/:id - Get application details
// Supports query params: username, password (for admin auth)
router.get("/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const application = await Application.findById(id)
      .populate("user_id")
      .populate("scheme_id")
      .populate("current_verifier.verified_by", "fullName username role contactNumber")
      .populate("verification_history.verified_by", "fullName username role");

    if (!application) {
      return res.status(404).json({
        status: "error",
        message: "Application not found",
      });
    }

    // Get stage requirements using level number
    const ApplicationModel = require("../models/Application");
    const currentLevel = application.verification_level || 0;
    const requiredRoleLevels = ApplicationModel.getRequiredRoleLevels(currentLevel);
    
    // Get next level
    let nextLevel = null;
    if (currentLevel === 7 || currentLevel === 8) nextLevel = 1;
    else if (currentLevel === 1 || currentLevel === 2) nextLevel = 6;
    else if (currentLevel === 6) nextLevel = 4;
    else if (currentLevel === 4 || currentLevel === 5) nextLevel = 3;
    else if (currentLevel === 3) nextLevel = 99;
    
    const nextRequiredRoleLevels = nextLevel ? ApplicationModel.getRequiredRoleLevels(nextLevel) : [];

    const appObj = application.toObject();
    const transformedApp = {
      ...appObj,
      applicantName: application.user_id?.demographics?.fullName || "Unknown",
      applicantId: application.user_id?._id || null,
      schemeName: application.scheme_id?.scheme_name || "Unknown",
      schemeId: application.scheme_id?._id || null,
      verification_level: currentLevel,
      verification_stage: ApplicationModel.getStageNameFromLevel(currentLevel),
      required_role_levels: requiredRoleLevels,
      next_verification_level: nextLevel,
      next_verification_stage: nextLevel ? ApplicationModel.getStageNameFromLevel(nextLevel) : null,
      next_required_role_levels: nextRequiredRoleLevels,
    };

    res.status(200).json({
      status: "success",
      data: transformedApp,
    });
  } catch (error) {
    console.error("Error fetching application:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid application ID",
      });
    }
    res.status(500).json({
      status: "error",
      message: "Failed to fetch application",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Helper function to get stage requirements
function getStageRequirements(stage) {
  const requirements = {
    Applied: { roleLevels: [7, 8], roleNames: ["District Overlookers", "Post Operator"] },
    Post_Operator_Review: { roleLevels: [7, 8], roleNames: ["District Overlookers", "Post Operator"] },
    Admin_Review: { roleLevels: [1, 2], roleNames: ["Super Admin", "Admin"] },
    District_Head_Review: { roleLevels: [6], roleNames: ["DistrictHQ Head"] },
    Department_Review: { roleLevels: [4, 5], roleNames: ["Department Head", "Department User"] },
    Secretary_Review: { roleLevels: [3], roleNames: ["Department Secretary"] },
    Completed: { roleLevels: [], roleNames: [] },
  };
  return requirements[stage] || { roleLevels: [], roleNames: [] };
}

// Helper function to get next stage requirements
function getNextStageRequirements(stage) {
  const nextStages = {
    Applied: "Post_Operator_Review",
    Post_Operator_Review: "Admin_Review",
    Admin_Review: "District_Head_Review",
    District_Head_Review: "Department_Review",
    Department_Review: "Secretary_Review",
    Secretary_Review: "Completed",
    Completed: null,
  };
  const nextStage = nextStages[stage];
  if (!nextStage) return null;
  return getStageRequirements(nextStage);
}

// GET /api/applications/:id/next-stage-admins - Get available admins for next verification stage
router.get("/:id/next-stage-admins", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({
        status: "error",
        message: "Application not found",
      });
    }

    const ApplicationModel = require("../models/Application");
    const currentLevel = application.verification_level || 0;
    
    // Get next level
    let nextLevel = null;
    if (currentLevel === 7 || currentLevel === 8) nextLevel = 1;
    else if (currentLevel === 1 || currentLevel === 2) nextLevel = 6;
    else if (currentLevel === 6) nextLevel = 4;
    else if (currentLevel === 4 || currentLevel === 5) nextLevel = 3;
    else if (currentLevel === 3) nextLevel = 99;
    
    if (!nextLevel || nextLevel === 99) {
      return res.status(200).json({
        status: "success",
        message: "No next stage available (application is at final stage)",
        data: [],
        next_verification_level: null,
        next_verification_stage: null,
      });
    }
    
    const nextRequiredRoleLevels = ApplicationModel.getRequiredRoleLevels(nextLevel);

    // Get current admin level
    const currentAdminLevel = req.admin.roleLevel;

    // Get all role levels that are higher authority (lower number) than current admin
    const higherAuthorityLevels = [];
    for (let level = 1; level < currentAdminLevel; level++) {
      higherAuthorityLevels.push(level);
    }

    // Get all roles that match these higher authority levels
    const higherAuthorityRoles = Object.values(AdminUser.ROLES).filter(role => {
      const roleLevel = AdminUser.ROLE_LEVELS[role];
      return higherAuthorityLevels.includes(roleLevel);
    });

    // Get all admins with higher authority (lower role level number = higher authority)
    const admins = await AdminUser.find({
      role: { $in: higherAuthorityRoles },
      isActive: true,
    }).select("_id fullName username role department contactNumber");

    // Add role level to each admin
    const adminsWithLevel = admins.map(admin => ({
      _id: admin._id,
      fullName: admin.fullName,
      username: admin.username,
      role: admin.role,
      roleLevel: AdminUser.ROLE_LEVELS[admin.role],
      department: admin.department || null,
      contactNumber: admin.contactNumber,
    }));

    // Sort by role level (ascending - higher authority first)
    adminsWithLevel.sort((a, b) => a.roleLevel - b.roleLevel);

    res.status(200).json({
      status: "success",
      data: adminsWithLevel,
      current_verification_level: currentLevel,
      current_verification_stage: ApplicationModel.getStageNameFromLevel(currentLevel),
      next_verification_level: nextLevel,
      next_verification_stage: ApplicationModel.getStageNameFromLevel(nextLevel),
      required_role_levels: nextRequiredRoleLevels,
      currentAdminLevel: currentAdminLevel,
      higherAuthorityLevels: higherAuthorityLevels,
    });
  } catch (error) {
    console.error("Error fetching next stage admins:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid application ID",
      });
    }
    res.status(500).json({
      status: "error",
      message: "Failed to fetch next stage admins",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Helper function to get next stage name
function getNextStageName(stage) {
  const nextStages = {
    Applied: "Post_Operator_Review",
    Post_Operator_Review: "Admin_Review",
    Admin_Review: "District_Head_Review",
    District_Head_Review: "Department_Review",
    Department_Review: "Secretary_Review",
    Secretary_Review: "Completed",
    Completed: null,
  };
  return nextStages[stage] || null;
}

// POST /api/applications/:id/verify - Verify application (multi-level workflow)
router.post("/:id/verify", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, remarks, forward_to_admin_id } = req.body;
    const admin = req.admin;

    if (!action || !["Verified", "Rejected", "Forwarded", "Returned"].includes(action)) {
      return res.status(400).json({
        status: "error",
        message: "Valid action is required (Verified, Rejected, Forwarded, Returned)",
      });
    }

    const application = await Application.findById(id)
      .populate("user_id")
      .populate("scheme_id");

    if (!application) {
      return res.status(404).json({
        status: "error",
        message: "Application not found",
      });
    }

    // Get admin user details
    const adminUser = await AdminUser.findById(admin._id);
    if (!adminUser) {
      return res.status(404).json({
        status: "error",
        message: "Admin user not found",
      });
    }

    // Get ApplicationModel helper functions
    const ApplicationModel = require("../models/Application");
    
    // Get current level - handle backward compatibility
    let currentLevel = application.verification_level;
    
    // If verification_level is not set, derive from verification_stage (backward compatibility)
    if (currentLevel === null || currentLevel === undefined) {
      const stageMap = {
        "Applied": 0,
        "Post_Operator_Review": 7,
        "Admin_Review": 1,
        "District_Head_Review": 6,
        "Department_Review": 4,
        "Secretary_Review": 3,
        "Completed": 99
      };
      currentLevel = stageMap[application.verification_stage] || 7; // Default to 7 if unknown
      // Update the application with the level
      application.verification_level = currentLevel;
    }
    
    const adminRoleLevel = admin.roleLevel;

    // Get required role levels for current verification level
    const requiredRoleLevels = ApplicationModel.getRequiredRoleLevels(currentLevel);
    
    // Check if admin can verify at this level
    const canVerify = requiredRoleLevels.includes(adminRoleLevel);
    
    // Determine next level based on current level and action
    let nextLevel = null;
    
    if (canVerify) {
      if (action === "Verified" || action === "Forwarded") {
        // Move to next level in hierarchy
        if (currentLevel === 7 || currentLevel === 8) {
          nextLevel = 1; // Post Operator -> Admin
        } else if (currentLevel === 1 || currentLevel === 2) {
          nextLevel = 6; // Admin -> District Head
        } else if (currentLevel === 6) {
          nextLevel = 4; // District Head -> Department
        } else if (currentLevel === 4 || currentLevel === 5) {
          nextLevel = 3; // Department -> Secretary
        } else if (currentLevel === 3) {
          nextLevel = 99; // Secretary -> Completed
        }
      } else if (action === "Returned") {
        // Return to previous level
        if (currentLevel === 1 || currentLevel === 2) {
          nextLevel = 7; // Admin -> Post Operator
        } else if (currentLevel === 6) {
          nextLevel = 1; // District Head -> Admin
        } else if (currentLevel === 4 || currentLevel === 5) {
          nextLevel = 6; // Department -> District Head
        } else if (currentLevel === 3) {
          nextLevel = 4; // Secretary -> Department
        } else if (currentLevel === 7 || currentLevel === 8) {
          nextLevel = currentLevel; // Stay at Post Operator (can't go back further)
        }
      }
    }

    if (!canVerify) {
      const stageName = ApplicationModel.getStageNameFromLevel(currentLevel);
      return res.status(403).json({
        status: "error",
        message: `You don't have permission to verify applications at verification level ${currentLevel}. Required role levels: ${requiredRoleLevels.join(", ")}`,
        verification_level: currentLevel,
        verification_stage: stageName,
        required_role_levels: requiredRoleLevels,
        your_role_level: adminRoleLevel,
      });
    }

    // Handle rejection - already handled above with nextLevel logic
    if (action === "Rejected") {
      application.status = "Rejected";
      application.verification_level = 99; // Completed
      application.verification_stage = "Completed"; // Legacy
    }

    // Add to verification history
    application.verification_history.push({
      stage: ApplicationModel.getStageNameFromLevel(currentLevel),
      verification_level: currentLevel,
      verified_by: admin._id,
      verified_by_name: admin.fullName,
      verified_by_role: admin.role,
      verified_by_role_level: adminRoleLevel,
      action: action,
      remarks: remarks || null,
      verified_at: new Date(),
    });

    // Update current verifier
    if (nextLevel !== null && nextLevel !== 99) {
      // If forward_to_admin_id is provided, assign to that specific admin
      // If not provided, application moves to next level without specific assignment
      if (forward_to_admin_id && (action === "Verified" || action === "Forwarded")) {
        const assignedAdmin = await AdminUser.findById(forward_to_admin_id);
        if (!assignedAdmin) {
          return res.status(404).json({
            status: "error",
            message: "Assigned admin not found",
          });
        }

        const assignedAdminLevel = AdminUser.ROLE_LEVELS[assignedAdmin.role];
        
        // Allow forwarding to any admin with higher authority (lower level number)
        // This allows forwarding to anyone above you in hierarchy, regardless of next level requirements
        const isHigherAuthority = assignedAdminLevel < adminRoleLevel;
        
        if (!isHigherAuthority) {
          return res.status(400).json({
            status: "error",
            message: `Selected admin must have higher authority. Your level: ${adminRoleLevel}, Selected admin level: ${assignedAdminLevel}. Higher authority means lower level number.`,
            assignedAdminLevel: assignedAdminLevel,
            yourRoleLevel: adminRoleLevel,
          });
        }

        // Check department: must be same department OR higher authority
        const scheme = await Scheme.findById(application.scheme_id);
        const schemeDepartment = scheme?.department;
        const assignedAdminDepartment = assignedAdmin.department;
        const currentAdminDepartment = adminUser.department;
        const isSameDepartment = schemeDepartment && assignedAdminDepartment && 
                                 schemeDepartment.toLowerCase() === assignedAdminDepartment.toLowerCase();
        const isSuperAdminOrAdmin = adminRoleLevel <= 2;

        if (!isSuperAdminOrAdmin && !isSameDepartment && !isHigherAuthority) {
          return res.status(403).json({
            status: "error",
            message: `Cannot forward to this admin. Admin must be in the same department (${schemeDepartment}) or have higher authority.`,
            schemeDepartment: schemeDepartment,
            assignedAdminDepartment: assignedAdminDepartment,
            currentAdminLevel: adminRoleLevel,
            assignedAdminLevel: assignedAdminLevel,
          });
        }

        // Assign to specific admin
        application.current_verifier = {
          verified_by: assignedAdmin._id,
          verified_by_name: assignedAdmin.fullName,
          verified_by_role: assignedAdmin.role,
          verified_by_role_level: assignedAdminLevel,
          remarks: remarks || `Forwarded by ${admin.fullName}`,
          verified_at: null,
        };
      } else {
        // Clear current verifier for next stage (will be assigned later)
        application.current_verifier = {
          verified_by: null,
          verified_by_name: null,
          verified_by_role: null,
          verified_by_role_level: null,
          remarks: null,
          verified_at: null,
        };
      }
    } else {
      // Set current verifier (for completed/rejected)
      application.current_verifier = {
        verified_by: admin._id,
        verified_by_name: admin.fullName,
        verified_by_role: admin.role,
        verified_by_role_level: adminRoleLevel,
        remarks: remarks || null,
        verified_at: new Date(),
      };
    }

    // Update verification level
    if (nextLevel !== null) {
      application.verification_level = nextLevel;
      application.verification_stage = ApplicationModel.getStageNameFromLevel(nextLevel); // Legacy field for backward compatibility
    }
    
    // Ensure verification_level is always set
    if (!application.verification_level && application.verification_level !== 0) {
      application.verification_level = 7; // Default to Post Operator level
    }

    // Update legacy fields for backward compatibility
    application.reviewed_by = admin._id;
    application.reviewed_at = new Date();
    if (remarks) {
      application.remarks = remarks;
    }

    await application.save();

    const updatedApplication = await Application.findById(id)
      .populate("user_id", "demographics.fullName demographics.gender demographics.dob aadhaarNumber contact address")
      .populate("scheme_id", "scheme_name scheme_type category department scheme_description")
      .populate("verification_history.verified_by", "fullName username role");
    
    // Transform response to include applicant name and verification info
    const appObj = updatedApplication.toObject();
    const transformedApp = {
      ...appObj,
      applicantName: updatedApplication.user_id?.demographics?.fullName || "Unknown",
      applicantId: updatedApplication.user_id?._id || null,
      applicantAadhaar: updatedApplication.user_id?.aadhaarNumber || null,
      applicantDOB: updatedApplication.user_id?.demographics?.dob?.date || null,
      applicantGender: updatedApplication.user_id?.demographics?.gender || null,
      schemeName: updatedApplication.scheme_id?.scheme_name || "Unknown",
      schemeId: updatedApplication.scheme_id?._id || null,
      verification_level: updatedApplication.verification_level || 7,
      verification_stage: ApplicationModel.getStageNameFromLevel(updatedApplication.verification_level || 7),
    };

    res.status(200).json({
      status: "success",
      message: `Application ${action.toLowerCase()} successfully`,
      data: transformedApp,
    });
  } catch (error) {
    console.error("Error verifying application:", error);
    console.error("Error stack:", error.stack);
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid application ID",
      });
    }
    res.status(500).json({
      status: "error",
      message: "Failed to verify application",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// POST /api/applications/:id/assign - Assign application to a specific admin
router.post("/:id/assign", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { assign_to_admin_id } = req.body;
    const admin = req.admin;

    if (!assign_to_admin_id) {
      return res.status(400).json({
        status: "error",
        message: "Admin ID to assign is required",
      });
    }

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({
        status: "error",
        message: "Application not found",
      });
    }

    const assignToAdmin = await AdminUser.findById(assign_to_admin_id);
    if (!assignToAdmin) {
      return res.status(404).json({
        status: "error",
        message: "Admin user not found",
      });
    }

    // Check if assigner has permission (only higher level admins can assign)
    if (admin.roleLevel > assignToAdmin.constructor.ROLE_LEVELS[assignToAdmin.role]) {
      return res.status(403).json({
        status: "error",
        message: "You don't have permission to assign to this admin",
      });
    }

    // Assign to admin
    application.current_verifier = {
      verified_by: assignToAdmin._id,
      verified_by_name: assignToAdmin.fullName,
      verified_by_role: assignToAdmin.role,
      verified_by_role_level: assignToAdmin.constructor.ROLE_LEVELS[assignToAdmin.role],
      remarks: `Assigned by ${admin.fullName}`,
      verified_at: null,
    };

    await application.save();

    res.status(200).json({
      status: "success",
      message: "Application assigned successfully",
      data: application,
    });
  } catch (error) {
    console.error("Error assigning application:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to assign application",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/applications/user/:user_id/summary - Get application summary for a user (Public API)
router.get("/user/:user_id/summary", async (req, res) => {
  try {
    const { user_id } = req.params;

    const applications = await Application.find({ user_id })
      .populate("scheme_id", "scheme_name scheme_type category department")
      .select("status verification_level date_applied scheme_id createdAt updatedAt")
      .sort({ createdAt: -1 });

    const ApplicationModel = require("../models/Application");
    
    // Count by status
    const statusCounts = {
      total: applications.length,
      applied: 0,
      under_review: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
    };

    // Count by verification stage
    const stageCounts = {
      applied: 0,
      post_operator_review: 0,
      admin_review: 0,
      district_review: 0,
      department_review: 0,
      secretary_review: 0,
      completed: 0,
    };

    const summary = applications.map(app => {
      const status = app.status;
      const level = app.verification_level || 0;
      
      // Update status counts
      if (status === "Applied") statusCounts.applied++;
      else if (status === "Under Review") statusCounts.under_review++;
      else if (status === "Approved") statusCounts.approved++;
      else if (status === "Rejected") statusCounts.rejected++;
      else if (status === "Pending") statusCounts.pending++;

      // Update stage counts
      if (level === 0) stageCounts.applied++;
      else if (level === 7 || level === 8) stageCounts.post_operator_review++;
      else if (level === 1 || level === 2) stageCounts.admin_review++;
      else if (level === 6) stageCounts.district_review++;
      else if (level === 4 || level === 5) stageCounts.department_review++;
      else if (level === 3) stageCounts.secretary_review++;
      else if (level === 99) stageCounts.completed++;

      return {
        applicationId: app._id,
        schemeId: app.scheme_id?._id || null,
        schemeName: app.scheme_id?.scheme_name || "Unknown",
        status: status,
        verification_stage: ApplicationModel.getStageNameFromLevel(level),
        verification_stage_display: getVerificationStageDisplay(level),
        date_applied: app.date_applied,
        last_updated: app.updatedAt,
      };
    });

    res.status(200).json({
      status: "success",
      data: {
        summary: {
          status_counts: statusCounts,
          stage_counts: stageCounts,
        },
        applications: summary,
      },
      count: summary.length,
    });
  } catch (error) {
    console.error("Error fetching application summary:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid user ID",
      });
    }
    res.status(500).json({
      status: "error",
      message: "Failed to fetch application summary",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/applications/user/:user_id - Get all applications for a user (Public API)
router.get("/user/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const { status } = req.query; // Optional filter by status

    const query = { user_id };
    if (status) {
      query.status = status;
    }

    const applications = await Application.find(query)
      .populate("scheme_id", "scheme_name scheme_type category department scheme_description scheme_image_file_url")
      .populate("current_verifier.verified_by", "fullName username role")
      .sort({ createdAt: -1 });

    // Transform to include verification info and formatted data
    const ApplicationModel = require("../models/Application");
    const transformedApplications = applications.map(app => {
      const appObj = app.toObject();
      const currentLevel = app.verification_level || 0;
      
      return {
        _id: app._id,
        applicationId: app._id,
        schemeId: app.scheme_id?._id || null,
        schemeName: app.scheme_id?.scheme_name || "Unknown",
        schemeType: app.scheme_id?.scheme_type || null,
        schemeCategory: app.scheme_id?.category || null,
        schemeDepartment: app.scheme_id?.department || null,
        schemeImage: app.scheme_id?.scheme_image_file_url || null,
        status: app.status,
        verification_level: currentLevel,
        verification_stage: ApplicationModel.getStageNameFromLevel(currentLevel),
        verification_stage_display: getVerificationStageDisplay(currentLevel),
        date_applied: app.date_applied,
        form_data: app.form_data || {},
        documents_submitted: app.documents_submitted || [],
        current_verifier: app.current_verifier?.verified_by ? {
          name: app.current_verifier.verified_by_name,
          role: app.current_verifier.verified_by_role,
        } : null,
        verification_history_count: app.verification_history?.length || 0,
        last_updated: app.updatedAt,
        createdAt: app.createdAt,
      };
    });

    res.status(200).json({
      status: "success",
      data: transformedApplications,
      count: transformedApplications.length,
    });
  } catch (error) {
    console.error("Error fetching user applications:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid user ID",
      });
    }
    res.status(500).json({
      status: "error",
      message: "Failed to fetch applications",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/applications/user/:user_id/:application_id - Get specific application details for a user (Public API)
router.get("/user/:user_id/:application_id", async (req, res) => {
  try {
    const { user_id, application_id } = req.params;

    const application = await Application.findOne({
      _id: application_id,
      user_id: user_id, // Ensure user can only access their own applications
    })
      .populate("scheme_id", "scheme_name scheme_type category department scheme_description scheme_objectives scheme_benefits scheme_eligibility scheme_image_file_url")
      .populate("current_verifier.verified_by", "fullName username role contactNumber")
      .populate("verification_history.verified_by", "fullName username role");

    if (!application) {
      return res.status(404).json({
        status: "error",
        message: "Application not found or you don't have access to this application",
      });
    }

    // Transform to include all details
    const ApplicationModel = require("../models/Application");
    const currentLevel = application.verification_level || 0;
    
    // Get next level info
    let nextLevel = null;
    if (currentLevel === 7 || currentLevel === 8) nextLevel = 1;
    else if (currentLevel === 1 || currentLevel === 2) nextLevel = 6;
    else if (currentLevel === 6) nextLevel = 4;
    else if (currentLevel === 4 || currentLevel === 5) nextLevel = 3;
    else if (currentLevel === 3) nextLevel = 99;

    const appObj = application.toObject();
    const transformedApp = {
      _id: appObj._id,
      applicationId: appObj._id,
      schemeId: appObj.scheme_id?._id || null,
      scheme: {
        _id: appObj.scheme_id?._id || null,
        schemeName: appObj.scheme_id?.scheme_name || "Unknown",
        schemeType: appObj.scheme_id?.scheme_type || null,
        category: appObj.scheme_id?.category || null,
        department: appObj.scheme_id?.department || null,
        description: appObj.scheme_id?.scheme_description || null,
        objectives: appObj.scheme_id?.scheme_objectives || [],
        benefits: appObj.scheme_id?.scheme_benefits || [],
        eligibility: appObj.scheme_id?.scheme_eligibility || {},
        imageUrl: appObj.scheme_id?.scheme_image_file_url || null,
      },
      status: appObj.status,
      status_display: getStatusDisplay(appObj.status),
      verification_level: currentLevel,
      verification_stage: ApplicationModel.getStageNameFromLevel(currentLevel),
      verification_stage_display: getVerificationStageDisplay(currentLevel),
      next_verification_level: nextLevel,
      next_verification_stage: nextLevel ? ApplicationModel.getStageNameFromLevel(nextLevel) : null,
      date_applied: appObj.date_applied,
      form_data: appObj.form_data || {},
      documents_submitted: appObj.documents_submitted || [],
      current_verifier: appObj.current_verifier?.verified_by ? {
        name: appObj.current_verifier.verified_by_name,
        role: appObj.current_verifier.verified_by_role,
        roleLevel: appObj.current_verifier.verified_by_role_level,
        remarks: appObj.current_verifier.remarks,
        verifiedAt: appObj.current_verifier.verified_at,
      } : null,
      verification_history: (appObj.verification_history || []).map(history => ({
        stage: history.stage,
        verification_level: history.verification_level,
        verified_by: history.verified_by_name,
        verified_by_role: history.verified_by_role,
        verified_by_role_level: history.verified_by_role_level,
        action: history.action,
        action_display: getActionDisplay(history.action),
        remarks: history.remarks,
        verified_at: history.verified_at,
      })),
      remarks: appObj.remarks,
      last_updated: appObj.updatedAt,
      createdAt: appObj.createdAt,
    };

    res.status(200).json({
      status: "success",
      data: transformedApp,
    });
  } catch (error) {
    console.error("Error fetching application details:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid application ID or user ID",
      });
    }
    res.status(500).json({
      status: "error",
      message: "Failed to fetch application details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Helper functions for display text
function getStatusDisplay(status) {
  const statusMap = {
    "Applied": "Application Submitted",
    "Under Review": "Under Review",
    "Approved": "Approved",
    "Rejected": "Rejected",
    "Pending": "Pending Additional Information",
  };
  return statusMap[status] || status;
}

function getVerificationStageDisplay(level) {
  const stageMap = {
    0: "Application Submitted",
    7: "Post Operator Review",
    8: "Post Operator Review",
    1: "Admin Review",
    2: "Admin Review",
    6: "District Head Review",
    4: "Department Review",
    5: "Department Review",
    3: "Secretary Review",
    99: "Completed",
  };
  return stageMap[level] || "Unknown Stage";
}

function getActionDisplay(action) {
  const actionMap = {
    "Verified": "Verified",
    "Forwarded": "Forwarded to Next Level",
    "Rejected": "Rejected",
    "Returned": "Returned for Revision",
  };
  return actionMap[action] || action;
}

// PUT /api/applications/:applicationId/approve - Approve an application
// Query params: username, password (for admin auth)
router.put("/:applicationId/approve", adminAuth, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { remarks } = req.body;
    const admin = req.admin;

    const application = await Application.findById(applicationId)
      .populate("user_id")
      .populate("scheme_id");

    if (!application) {
      return res.status(404).json({
        status: "error",
        message: "Application not found",
      });
    }

    // Check if already approved or rejected
    if (application.status === "Approved") {
      return res.status(400).json({
        status: "error",
        message: "Application is already approved",
      });
    }

    if (application.status === "Rejected") {
      return res.status(400).json({
        status: "error",
        message: "Application is already rejected",
      });
    }

    // Get admin user details
    const adminUser = await AdminUser.findById(admin._id);
    if (!adminUser) {
      return res.status(404).json({
        status: "error",
        message: "Admin user not found",
      });
    }

    // Update application status
    application.status = "Approved";
    application.verification_stage = "Completed";

    // Add to verification history
    application.verification_history.push({
      stage: application.verification_stage,
      verified_by: admin._id,
      verified_by_name: admin.fullName,
      verified_by_role: admin.role,
      verified_by_role_level: admin.roleLevel,
      action: "Verified",
      remarks: remarks || "Application approved",
      verified_at: new Date(),
    });

    // Update current verifier
    application.current_verifier = {
      verified_by: admin._id,
      verified_by_name: admin.fullName,
      verified_by_role: admin.role,
      verified_by_role_level: admin.roleLevel,
      remarks: remarks || "Application approved",
      verified_at: new Date(),
    };

    // Update legacy fields
    application.reviewed_by = admin._id;
    application.reviewed_at = new Date();
    if (remarks) {
      application.remarks = remarks;
    }

    await application.save();

    const updatedApplication = await Application.findById(applicationId)
      .populate("user_id")
      .populate("scheme_id")
      .populate("current_verifier.verified_by", "fullName username role contactNumber")
      .populate("verification_history.verified_by", "fullName username role");

    res.status(200).json({
      status: "success",
      message: "Application approved successfully",
      data: updatedApplication,
    });
  } catch (error) {
    console.error("Error approving application:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid application ID",
      });
    }
    res.status(500).json({
      status: "error",
      message: "Failed to approve application",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST /api/applications/:applicationId/forward - Forward application to specific admin
// Query params: username, password (for admin auth)
router.post("/:applicationId/forward", adminAuth, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { forward_to_admin_id, remarks } = req.body;
    const admin = req.admin;

    if (!forward_to_admin_id) {
      return res.status(400).json({
        status: "error",
        message: "forward_to_admin_id is required",
      });
    }

    const application = await Application.findById(applicationId)
      .populate("user_id")
      .populate("scheme_id");

    if (!application) {
      return res.status(404).json({
        status: "error",
        message: "Application not found",
      });
    }

    // Get admin user details
    const adminUser = await AdminUser.findById(admin._id);
    if (!adminUser) {
      return res.status(404).json({
        status: "error",
        message: "Admin user not found",
      });
    }

    // Get target admin
    const targetAdmin = await AdminUser.findById(forward_to_admin_id);
    if (!targetAdmin) {
      return res.status(404).json({
        status: "error",
        message: "Target admin not found",
      });
    }

    if (!targetAdmin.isActive) {
      return res.status(400).json({
        status: "error",
        message: "Target admin account is inactive",
      });
    }

    // Get scheme department
    const scheme = await Scheme.findById(application.scheme_id);
    const schemeDepartment = scheme?.department;
    const targetAdminDepartment = targetAdmin.department;
    const currentAdminDepartment = adminUser.department;
    const adminRoleLevel = admin.roleLevel;
    const targetAdminLevel = AdminUser.ROLE_LEVELS[targetAdmin.role];

    // Validation: Admin must be in same department OR have higher authority
    // Super Admin/Admin (Level 1 or 2) can forward to anyone
    const isHigherAuthority = targetAdminLevel < adminRoleLevel;
    const isSameDepartment = schemeDepartment && targetAdminDepartment && 
                             schemeDepartment.toLowerCase() === targetAdminDepartment.toLowerCase();
    const isSuperAdminOrAdmin = adminRoleLevel <= 2;

    if (!isSuperAdminOrAdmin && !isSameDepartment && !isHigherAuthority) {
      return res.status(403).json({
        status: "error",
        message: `Cannot forward to this admin. Admin must be in the same department (${schemeDepartment}) or have higher authority.`,
        schemeDepartment: schemeDepartment,
        targetAdminDepartment: targetAdminDepartment,
        currentAdminLevel: adminRoleLevel,
        targetAdminLevel: targetAdminLevel,
      });
    }

    // Check if target admin has appropriate role level for current or next stage
    const currentStageReqs = getStageRequirements(application.verification_stage);
    const nextStageReqs = getNextStageRequirements(application.verification_stage);

    const canHandleCurrentStage = currentStageReqs.roleLevels.includes(targetAdminLevel);
    const canHandleNextStage = nextStageReqs && nextStageReqs.roleLevels.includes(targetAdminLevel);

    if (!canHandleCurrentStage && !canHandleNextStage) {
      return res.status(400).json({
        status: "error",
        message: `Target admin does not have appropriate role level for current or next verification stage.`,
        currentStage: application.verification_stage,
        currentStageRequiredLevels: currentStageReqs.roleLevels,
        nextStageRequiredLevels: nextStageReqs ? nextStageReqs.roleLevels : null,
        targetAdminLevel: targetAdminLevel,
      });
    }

    // Add to verification history
    application.verification_history.push({
      stage: application.verification_stage,
      verified_by: admin._id,
      verified_by_name: admin.fullName,
      verified_by_role: admin.role,
      verified_by_role_level: adminRoleLevel,
      action: "Forwarded",
      remarks: remarks || `Forwarded to ${targetAdmin.fullName}`,
      verified_at: new Date(),
    });

    // Assign to target admin
    application.current_verifier = {
      verified_by: targetAdmin._id,
      verified_by_name: targetAdmin.fullName,
      verified_by_role: targetAdmin.role,
      verified_by_role_level: targetAdminLevel,
      remarks: remarks || `Forwarded by ${admin.fullName}`,
      verified_at: null,
    };

    // Update status
    application.status = "Under Review";

    // Update legacy fields
    application.reviewed_by = admin._id;
    application.reviewed_at = new Date();
    if (remarks) {
      application.remarks = remarks;
    }

    await application.save();

    const updatedApplication = await Application.findById(applicationId)
      .populate("user_id", "demographics.fullName")
      .populate("scheme_id", "scheme_name department")
      .populate("current_verifier.verified_by", "fullName username role department contactNumber")
      .populate("verification_history.verified_by", "fullName username role");

    res.status(200).json({
      status: "success",
      message: `Application forwarded to ${targetAdmin.fullName} successfully`,
      data: updatedApplication,
    });
  } catch (error) {
    console.error("Error forwarding application:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid application ID or admin ID",
      });
    }
    res.status(500).json({
      status: "error",
      message: "Failed to forward application",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// PUT /api/applications/:applicationId/reject - Reject an application
// Query params: username, password (for admin auth)
router.put("/:applicationId/reject", adminAuth, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { remarks } = req.body;
    const admin = req.admin;

    const application = await Application.findById(applicationId)
      .populate("user_id")
      .populate("scheme_id");

    if (!application) {
      return res.status(404).json({
        status: "error",
        message: "Application not found",
      });
    }

    // Check if already approved or rejected
    if (application.status === "Approved") {
      return res.status(400).json({
        status: "error",
        message: "Application is already approved",
      });
    }

    if (application.status === "Rejected") {
      return res.status(400).json({
        status: "error",
        message: "Application is already rejected",
      });
    }

    // Get admin user details
    const adminUser = await AdminUser.findById(admin._id);
    if (!adminUser) {
      return res.status(404).json({
        status: "error",
        message: "Admin user not found",
      });
    }

    // Update application status
    application.status = "Rejected";
    application.verification_stage = "Completed";

    // Add to verification history
    application.verification_history.push({
      stage: application.verification_stage,
      verified_by: admin._id,
      verified_by_name: admin.fullName,
      verified_by_role: admin.role,
      verified_by_role_level: admin.roleLevel,
      action: "Rejected",
      remarks: remarks || "Application rejected",
      verified_at: new Date(),
    });

    // Update current verifier
    application.current_verifier = {
      verified_by: admin._id,
      verified_by_name: admin.fullName,
      verified_by_role: admin.role,
      verified_by_role_level: admin.roleLevel,
      remarks: remarks || "Application rejected",
      verified_at: new Date(),
    };

    // Update legacy fields
    application.reviewed_by = admin._id;
    application.reviewed_at = new Date();
    if (remarks) {
      application.remarks = remarks;
    }

    await application.save();

    const updatedApplication = await Application.findById(applicationId)
      .populate("user_id")
      .populate("scheme_id")
      .populate("current_verifier.verified_by", "fullName username role contactNumber")
      .populate("verification_history.verified_by", "fullName username role");

    res.status(200).json({
      status: "success",
      message: "Application rejected successfully",
      data: updatedApplication,
    });
  } catch (error) {
    console.error("Error rejecting application:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid application ID",
      });
    }
    res.status(500).json({
      status: "error",
      message: "Failed to reject application",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;

