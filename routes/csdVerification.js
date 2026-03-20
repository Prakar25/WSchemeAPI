const express = require("express");
const router = express.Router();
const PublicUser = require("../models/PublicUser");
const AdminUser = require("../models/AdminUser");
const Application = require("../models/Application");
const adminAuth = require("../middleware/adminAuth");

/**
 * Require CSCAdmin role to access CSC verification endpoints
 */
const requireCsdAdmin = (req, res, next) => {
  const role = req.admin?.role;
  if (role === AdminUser.ROLES.CSC_ADMIN) {
    return next();
  }
    return res.status(403).json({
    status: "error",
    message: "Only CSCAdmin can access this resource",
  });
};

/**
 * GET /api/csd/pending-applications
 * Paginated application list for CSC admin.
 * Query:
 *  - page (default 1)
 *  - limit (default 20, max 100)
 *  - status (optional CSV): csc_pending, approved
 *      examples: status=csc_pending OR status=approved OR status=csc_pending,approved
 *  - includeApproved (optional boolean): only used when status is not provided
 *      true => include approved along with CSC pending
 *      false => only CSC pending
 *  - aadhaarNumber (optional, 12 digits): when provided, return ALL applications of that user
 *    and segregate into CSC-bio-auth required vs others.
 *
 * Default behavior (without aadhaarNumber): returns CSC pending + approved.
 * Requires: admin auth, CSCAdmin role
 */
router.get("/pending-applications", adminAuth, requireCsdAdmin, async (req, res) => {
  try {
    const page = Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1);
    const rawLimit = parseInt(String(req.query.limit || "20"), 10) || 20;
    const limit = Math.min(Math.max(rawLimit, 1), 100);
    const skip = (page - 1) * limit;
    const aadhaarNumber = String(req.query.aadhaarNumber || "").trim();

    if (aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber)) {
      return res.status(400).json({
        status: "error",
        message: "aadhaarNumber must be a 12-digit number",
      });
    }

    const statusParam = String(req.query.status || "").trim().toLowerCase();
    const includeApprovedParam = String(req.query.includeApproved || "").trim().toLowerCase();

    // Compatibility during level migration
    // Bio-auth is required only when:
    // - application is at CSC bio-auth verification levels (5,9)
    // - application is not rejected
    // - and the underlying PublicUser is NOT yet bio-auth verified
    const isCscBioAuthRequired = (app) => {
      if (app.status === "Bioauthentication") return true;
      return (
        [5, 9].includes(app.verification_level) &&
        app.status !== "Rejected" &&
        app.user_id?.status?.verificationStatus !== "verified"
      );
    };

    // Verified/completed when:
    // - application is approved, OR
    // - application is not at CSC bio-auth levels, OR
    // - underlying PublicUser is already bio-auth verified
    const isVerifiedOrCompleted = (app) => {
      if (app.status === "Bioauthentication") return false;
      return (
        app.status !== "Rejected" &&
        (app.status === "Approved" ||
          ![5, 9].includes(app.verification_level) ||
          app.user_id?.status?.verificationStatus === "verified")
      );
    };
    const cscPendingCondition = {
      verification_level: { $in: [5, 9] },
      status: { $ne: "Rejected" },
    };
    const approvedCondition = { status: "Approved" };

    let query = {};
    let searchedUser = null;

    // If aadhaar search is provided, fetch all applications for that user regardless of stage/status.
    if (aadhaarNumber) {
      searchedUser = await PublicUser.findOne({ aadhaarNumber }).select("_id aadhaarNumber demographics.fullName");
      if (!searchedUser) {
        return res.status(200).json({
          status: "success",
          message: "No user found for provided aadhaarNumber",
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: page > 1,
          },
          segregation: {
            needsCscVerificationCount: 0,
            verifiedOrCompletedCount: 0,
          },
          needsCscVerification: [],
          verifiedOrCompleted: [],
          pendingApplications: [],
          applications: [],
          needsCscBioAuth: [],
          others: [],
          count: 0,
        });
      }
      query = { user_id: searchedUser._id };
    } else {
      // Without Aadhaar: default queue = CSC pending + approved.
      // status query overrides includeApproved/default behavior.
      let requestedTypes = [];
      if (statusParam) {
        requestedTypes = statusParam
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s === "csc_pending" || s === "approved");
      } else if (includeApprovedParam === "false" || includeApprovedParam === "0") {
        requestedTypes = ["csc_pending"];
      } else {
        // default and includeApproved=true both land here
        requestedTypes = ["csc_pending", "approved"];
      }

      // Fallback to default if invalid status was sent
      if (requestedTypes.length === 0) {
        requestedTypes = ["csc_pending", "approved"];
      }

      const orConditions = [];
      if (requestedTypes.includes("csc_pending")) orConditions.push(cscPendingCondition);
      if (requestedTypes.includes("approved")) orConditions.push(approvedCondition);
      query = orConditions.length === 1 ? orConditions[0] : { $or: orConditions };
    }

    const [applications, total] = await Promise.all([
      Application.find(query)
        .populate("user_id", "aadhaarNumber demographics.fullName demographics.gender contact.mobile.value contact.email.value status.verificationStatus")
        .populate("scheme_id", "scheme_name department category")
        .sort({ date_applied: -1 })
        .skip(skip)
        .limit(limit),
      Application.countDocuments(query),
    ]);

    const list = applications.map((app) => {
      const needsCscBioAuth = isCscBioAuthRequired(app);
      const verifiedOrCompleted = isVerifiedOrCompleted(app);
      return {
        _id: app._id,
        applicantName: app.user_id?.demographics?.fullName || "Unknown",
        applicantAadhaarNumber: app.user_id?.aadhaarNumber || null,
        applicantMobile: app.user_id?.contact?.mobile?.value || null,
        schemeName: app.scheme_id?.scheme_name || "Unknown",
        schemeId: app.scheme_id?._id || null,
        date_applied: app.date_applied,
        verification_level: app.verification_level,
        verification_stage: needsCscBioAuth ? "CSC Admin Review" : "Non CSC Stage",
        needsCscBioAuth,
        verifiedOrCompleted,
        status: app.status,
      };
    });

    const needsCscVerification = list.filter((a) => a.needsCscBioAuth);
    const verifiedOrCompletedList = list.filter((a) => a.verifiedOrCompleted);
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    return res.status(200).json({
      status: "success",
      ...(searchedUser
        ? {
            searchedUser: {
              _id: searchedUser._id,
              aadhaarNumber: searchedUser.aadhaarNumber || aadhaarNumber,
              fullName: searchedUser.demographics?.fullName || null,
            },
          }
        : {}),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      segregation: {
        needsCscVerificationCount: needsCscVerification.length,
        verifiedOrCompletedCount: verifiedOrCompletedList.length,
      },
      // Two sets for frontend
      needsCscVerification,
      verifiedOrCompleted: verifiedOrCompletedList,
      // Backward compatibility
      pendingApplications: list,
      applications: list,
      needsCscBioAuth: needsCscVerification,
      others: verifiedOrCompletedList,
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
 * List public users with verificationStatus "pending" (for CSCAdmin)
 * Requires: admin auth (x-admin-username, x-admin-password), CSCAdmin role
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
 * Approve or reject a pending public user (CSCAdmin only)
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

    // If this (approve/reject) came from an application bioauthentication queue,
    // update the related applications accordingly.
    const ApplicationModel = require("../models/Application");
    const appsToUpdate = await Application.find({
      user_id: user._id,
      status: "Bioauthentication",
      verification_level: { $in: [5, 9] },
    });

    if (actionLower === "approve") {
      // Directly complete queued applications after bio-auth is done.
      for (const app of appsToUpdate) {
        app.status = "Approved";
        app.verification_level = 99;
        app.verification_stage = "Completed";
        app.authorization_level_index = Array.isArray(app.authorization_levels) && app.authorization_levels.length > 0 ? app.authorization_levels.length - 1 : 0;

        app.current_verifier = {
          verified_by: csdAdminId,
          verified_by_name: req.admin.fullName,
          verified_by_role: req.admin.role,
          verified_by_role_level: req.admin.roleLevel,
          remarks: "Bioauthentication completed by CSCAdmin",
          verified_at: new Date(),
        };

        // Keep verification history consistent: CSC bio-auth + completion
        app.verification_history.push({
          stage: ApplicationModel.getStageNameFromLevel(5),
          verified_by: csdAdminId,
          verified_by_name: req.admin.fullName,
          verified_by_role: req.admin.role,
          verified_by_role_level: req.admin.roleLevel,
          action: "Verified",
          remarks: "Bioauthentication completed by CSCAdmin",
          verified_at: new Date(),
        });

        app.verification_history.push({
          stage: "Completed",
          verified_by: csdAdminId,
          verified_by_name: req.admin.fullName,
          verified_by_role: req.admin.role,
          verified_by_role_level: req.admin.roleLevel,
          action: "Verified",
          remarks: "Completed after bioauthentication",
          verified_at: new Date(),
        });

        app.reviewed_by = csdAdminId;
        app.reviewed_at = new Date();

        await app.save();
      }
    } else {
      // Mark queued applications as rejected when CSC rejects bio-auth.
      for (const app of appsToUpdate) {
        app.status = "Rejected";
        app.verification_level = 5;
        app.verification_stage = ApplicationModel.getStageNameFromLevel(5);
        app.authorization_level_index = 0;
        app.current_verifier = {
          verified_by: null,
          verified_by_name: null,
          verified_by_role: null,
          verified_by_role_level: null,
          remarks: null,
          verified_at: null,
        };

        app.verification_history.push({
          stage: ApplicationModel.getStageNameFromLevel(5),
          verified_by: csdAdminId,
          verified_by_name: req.admin.fullName,
          verified_by_role: req.admin.role,
          verified_by_role_level: req.admin.roleLevel,
          action: "Rejected",
          remarks: rejectionReason ? `Bioauthentication rejected: ${String(rejectionReason).trim()}` : "Bioauthentication rejected by CSCAdmin",
          verified_at: new Date(),
        });

        app.reviewed_by = csdAdminId;
        app.reviewed_at = new Date();

        await app.save();
      }
    }

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
