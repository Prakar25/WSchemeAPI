const express = require("express");
const router = express.Router();
const Application = require("../models/Application");
const Scheme = require("../models/Scheme");
const PublicUser = require("../models/PublicUser");
const AdminUser = require("../models/AdminUser");
const { checkEligibility } = require("../utils/eligibilityUtils");
const adminAuth = require("../middleware/adminAuth");
const requireRole = require("../middleware/requireRole");
const { requestOTP, verifyOTP } = require("../utils/otpService");

/**
 * Validate form_data against scheme.custom_form_fields.
 * Returns { valid: boolean, sanitizedFormData: object, errors: [{ field, message }] }.
 */
function validateFormData(formData, customFormFields) {
  const errors = [];
  const sanitized = {};

  if (!Array.isArray(customFormFields) || customFormFields.length === 0) {
    return { valid: true, sanitizedFormData: formData && typeof formData === "object" ? formData : {}, errors: [] };
  }

  const fieldMap = {};
  customFormFields.forEach((f) => { fieldMap[f.field_key] = f; });

  function isParentSatisfied(field, formData) {
    const dep = field.depends_on;
    if (!dep || !dep.field_key) return true;
    const parentValue = formData && formData[dep.field_key];
    const targetValue = dep.value;
    if (field.field_type === "checkbox" || fieldMap[dep.field_key]?.field_type === "checkbox") {
      const parentBool = parentValue === true || parentValue === 1 || parentValue === "true" || parentValue === "yes";
      const targetBool = targetValue === true || targetValue === 1 || targetValue === "true" || targetValue === "yes";
      return parentBool === targetBool;
    }
    return String(parentValue) === String(targetValue);
  }

  for (const field of customFormFields) {
    if (!isParentSatisfied(field, formData)) continue;

    const key = field.field_key;
    const type = field.field_type || field.type || "text";
    const label = field.title || field.label || key;
    const value = formData && formData[key];

    // Required check
    const isEmpty = value === undefined || value === null || value === "";
    const isCheckboxEmpty = type === "checkbox" && (value !== true && value !== false && value !== 1 && value !== 0);

    if (field.required) {
      if (type === "checkbox") {
        if (isCheckboxEmpty || value === false || value === 0) {
          errors.push({ field: key, message: `${label} is required` });
        }
      } else if (isEmpty) {
        errors.push({ field: key, message: `${label} is required` });
      }
    }

    if (errors.some((e) => e.field === key)) continue; // Skip further validation for this field if already errored

    if (isEmpty && !field.required) continue;

    // Type-specific validation
    if (type === "number") {
      const num = Number(value);
      if (field.required && (value === "" || value === null || Number.isNaN(num))) {
        errors.push({ field: key, message: `${label} must be a valid number` });
      } else if (!isEmpty && Number.isNaN(num)) {
        errors.push({ field: key, message: `${label} must be a valid number` });
      } else if (!isEmpty) {
        sanitized[key] = num;
      }
    } else if (type === "select") {
      const options = Array.isArray(field.options)
        ? field.options
        : (typeof field.options === "string" ? field.options.split(",").map((s) => s.trim()) : []);
      const trimmedValue = typeof value === "string" ? String(value).trim() : value;
      const invalidOption = options.length > 0 && trimmedValue !== "" && !options.includes(trimmedValue);
      if (invalidOption) {
        errors.push({ field: key, message: `Invalid option selected for ${label}` });
      } else if (!isEmpty) {
        sanitized[key] = trimmedValue;
      }
    } else if (type === "date") {
      const dateVal = value ? new Date(value) : null;
      if (field.required && (!value || !dateVal || Number.isNaN(dateVal.getTime()))) {
        errors.push({ field: key, message: `${label} must be a valid date` });
      } else if (!isEmpty && Number.isNaN(dateVal?.getTime())) {
        errors.push({ field: key, message: `${label} must be a valid date` });
      } else if (!isEmpty) {
        sanitized[key] = typeof value === "string" ? value : dateVal?.toISOString?.();
      }
    } else if (type === "checkbox") {
      sanitized[key] = !!value;
    } else {
      sanitized[key] = typeof value === "string" ? value.trim() : String(value);
    }
  }

  const valid = errors.length === 0;
  return {
    valid,
    sanitizedFormData: valid ? sanitized : (formData && typeof formData === "object" ? formData : {}),
    errors,
  };
}

/**
 * Map legacy workflow levels to sequential (1-4 for scheme auth, 1-5 for verification).
 * Used for authorization_levels: preserve 1,2,3,4; only map legacy 5,6,7,8,9.
 * - 1,2,3,4 -> unchanged (scheme authorization_levels)
 * - 5 (legacy) -> 3
 * - 6 (legacy) -> 3
 * - 7,8 (legacy) -> 4
 * - 9 (legacy) -> 5
 */
function mapOldAuthorizationLevelToNew(level) {
  const n = typeof level === "string" ? parseInt(level, 10) : level;
  if (!Number.isInteger(n)) return null;
  if ([1, 2, 3, 4].includes(n)) return n; // Scheme auth levels - never map these
  if (n === 8 || n === 7) return 4;
  if (n === 6 || n === 5) return 3;
  if (n === 9) return 5;
  return n;
}

// POST /api/applications/apply - Apply to a scheme
// Universal rule: only public users with verificationStatus === "verified" can apply; others get 403
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

    // Registration is OTP-based; CSC center verification is not required to apply.
    const verificationStatus = user.status?.verificationStatus || "verified";
    if (verificationStatus === "rejected") {
      return res.status(403).json({
        status: "error",
        message: "Your account verification was rejected. You cannot apply to schemes. Please contact support.",
        verificationStatus,
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

    // Validate form_data against scheme.custom_form_fields
    const customFormFields = scheme.custom_form_fields || [];
    const validation = validateFormData(form_data, customFormFields);
    if (!validation.valid) {
      return res.status(422).json({
        status: "error",
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    // Use sanitized form_data (only keys from custom_form_fields; validated values)
    const sanitizedFormData = validation.sanitizedFormData;

    // Get authorization levels from scheme (workflow sequence)
    const authorizationLevels = (scheme.authorization_levels || [])
      .map(mapOldAuthorizationLevelToNew)
      .filter((v) => v === 1 || v === 2 || v === 3 || v === 4);

    // Applications ALWAYS start at CSC Admin (level 5) first
    let initialVerificationLevel = 5;
    let authorizationLevelIndex = 0;

    // Create application - starts at first authorization level or default
    // Get ApplicationModel helper functions (getStageNameFromLevel is exported from the model)
    const ApplicationModel = require("../models/Application");
    
    const application = await Application.create({
      user_id,
      scheme_id,
      status: "Applied",
      verification_level: initialVerificationLevel,
      verification_stage: ApplicationModel.getStageNameFromLevel(initialVerificationLevel),
      authorization_levels: authorizationLevels, // Store the workflow sequence
      authorization_level_index: authorizationLevelIndex, // Start at first level
      form_data: sanitizedFormData,
      documents_submitted: documents_submitted || [],
    });

    const populatedApplication = await Application.findById(application._id)
      .populate("user_id", "demographics.fullName")
      .populate({
        path: "scheme_id",
        select: "scheme_name scheme_type category department",
        populate: [
          { path: "category", select: "category_name category_display_name" },
          { path: "department", select: "department_name department_display_name" }
        ]
      });

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

/**
 * POST /api/applications/bioauthentication/queue
 * Admin can shift selected applications to CSC for re-bioauthentication.
 * Body: { applicationIds: string[] }
 *
 * What it does:
 * - Sets Application.status = "Bioauthentication"
 * - Resets verification back to CSC Admin Review (verification_level = 5)
 * - Resets associated PublicUser verificationStatus to "pending" so CSCAdmin can re-verify bio-auth
 */
router.post("/bioauthentication/queue", adminAuth, async (req, res) => {
  try {
    const { applicationIds } = req.body;
    const admin = req.admin;

    const ids = Array.isArray(applicationIds) ? applicationIds : [];
    if (ids.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "applicationIds (non-empty array) is required",
      });
    }

    // CSCAdmin should not be the one queueing bio-auth
    if (admin?.roleLevel === 5) {
      return res.status(403).json({
        status: "error",
        message: "CSCAdmin cannot queue applications for bioauthentication.",
      });
    }

    const ApplicationModel = require("../models/Application");

    // Fetch applications + users
    const applications = await Application.find({ _id: { $in: ids } }).populate("user_id", "status audit");

    const results = {
      updated: [],
      skipped: [],
    };

    // Process sequentially (safe for audit/history). Can be optimized to bulk later.
    for (const app of applications) {
      const user = app.user_id;
      if (!user || !user._id) {
        results.skipped.push({ applicationId: app._id, reason: "missing_public_user" });
        continue;
      }

      // Prevent queueing if already completed/approved
      if (app.verification_level === 99 || app.status === "Approved") {
        results.skipped.push({ applicationId: app._id, reason: "already_completed" });
        continue;
      }

      const prevStage = app.verification_stage || ApplicationModel.getStageNameFromLevel(app.verification_level || 0);

      // Reset PublicUser to pending so CSCAdmin can re-bio-auth
      user.status.verificationStatus = "pending";
      user.status.verifiedBy = null;
      user.status.verifiedAt = null;
      user.status.rejectionReason = null;
      if (user.audit) {
        user.audit.lastUpdated = new Date();
        user.audit.updateCount = (user.audit.updateCount || 0) + 1;
      }
      await user.save();

      // Reset application to CSC stage for application verification
      app.status = "Bioauthentication";
      app.verification_level = 5;
      app.verification_stage = "CSC_Admin_Review";
      app.authorization_level_index = 0;
      app.current_verifier = {
        verified_by: null,
        verified_by_name: null,
        verified_by_role: null,
        verified_by_role_level: null,
        remarks: null,
        verified_at: null,
      };

      // Track this as a return-for-revision event in history
      app.verification_history.push({
        stage: prevStage,
        verified_by: admin._id,
        verified_by_name: admin.fullName,
        verified_by_role: admin.role,
        verified_by_role_level: admin.roleLevel,
        action: "Returned",
        remarks: "Sent for CSC re-bioauthentication",
        verified_at: new Date(),
      });

      await app.save();
      results.updated.push(app._id);
    }

    return res.status(200).json({
      status: "success",
      message: "Bioauthentication queue updated",
      data: results,
      count: results.updated.length,
    });
  } catch (error) {
    console.error("Error queueing bioauthentication:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to queue bioauthentication",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * POST /api/applications/bioauthentication/requeue
 * Move Approved / Benefit Transferred applications back to CSC for re-bioauthentication.
 *
 * Body: { applicationIds: string[], remarks?: string }
 *
 * What it does:
 * - Sets Application.status = "Bioauthentication"
 * - Sets Application.verification_level = 5 (CSC_Admin_Review)
 * - Clears current_verifier
 * - Resets associated PublicUser verificationStatus to "pending" so CSCAdmin queue can pick it up
 * - Adds an audit entry to verification_history
 */
router.post("/bioauthentication/requeue", adminAuth, async (req, res) => {
  try {
    const { applicationIds, remarks } = req.body;
    const admin = req.admin;

    const ids = Array.isArray(applicationIds) ? applicationIds : [];
    if (ids.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "applicationIds (non-empty array) is required",
      });
    }

    // CSCAdmin should not be the one queueing bio-auth
    if (admin?.roleLevel === 5) {
      return res.status(403).json({
        status: "error",
        message: "CSCAdmin cannot requeue applications for bioauthentication.",
      });
    }

    const ApplicationModel = require("../models/Application");

    // Fetch applications + users
    const applications = await Application.find({ _id: { $in: ids } }).populate("user_id", "status audit");

    const results = {
      updated: [],
      skipped: [],
    };

    for (const app of applications) {
      const user = app.user_id;
      if (!user || !user._id) {
        results.skipped.push({ applicationId: app._id, reason: "missing_public_user" });
        continue;
      }

      // Only allow requeue from Approved / Benefit Transferred / Completed (99)
      const eligible =
        app.status === "Approved" ||
        app.status === "Benefit Transferred" ||
        app.verification_level === 99;
      if (!eligible) {
        results.skipped.push({
          applicationId: app._id,
          reason: "not_eligible",
          status: app.status,
          verification_level: app.verification_level,
        });
        continue;
      }

      // Skip if already in CSC bio-auth flow
      if (app.status === "Bioauthentication" && [5, 9].includes(app.verification_level)) {
        results.skipped.push({ applicationId: app._id, reason: "already_in_bioauthentication" });
        continue;
      }

      const prevStage = app.verification_stage || ApplicationModel.getStageNameFromLevel(app.verification_level || 0);
      const prevStatus = app.status || null;

      // Reset PublicUser to pending so CSCAdmin can re-bio-auth
      user.status = user.status || {};
      user.status.verificationStatus = "pending";
      user.status.verifiedBy = null;
      user.status.verifiedAt = null;
      user.status.rejectionReason = null;
      if (user.audit) {
        user.audit.lastUpdated = new Date();
        user.audit.updateCount = (user.audit.updateCount || 0) + 1;
      }
      await user.save();

      // Reset application to CSC stage for re-bioauthentication
      app.status = "Bioauthentication";
      app.verification_level = 5;
      app.verification_stage = "CSC_Admin_Review";
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
        stage: prevStage,
        verified_by: admin._id,
        verified_by_name: admin.fullName,
        verified_by_role: admin.role,
        verified_by_role_level: admin.roleLevel,
        action: "Returned",
        remarks: `Re-bioauthentication requested (prev status: ${prevStatus || "unknown"}).${remarks ? ` ${String(remarks).trim()}` : ""}`,
        verified_at: new Date(),
      });

      await app.save();
      results.updated.push(app._id);
    }

    return res.status(200).json({
      status: "success",
      message: "Bioauthentication requeue updated",
      data: results,
      count: results.updated.length,
    });
  } catch (error) {
    console.error("Error requeueing bioauthentication:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to requeue bioauthentication",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * PUT /api/applications/:id/mark-benefit-transferred
 * Mark an application as "Benefit Transferred".
 *
 * Auth: Admin/Super Admin only.
 * Body: { remarks?: string }
 *
 * Notes:
 * - Does not change verification_level/stage (it is a post-approval status marker).
 * - Adds a verification_history entry for audit trail.
 */
router.put(
  "/:id/mark-benefit-transferred",
  adminAuth,
  requireRole([AdminUser.ROLES.SUPER_ADMIN, AdminUser.ROLES.ADMIN]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { remarks } = req.body || {};
      const admin = req.admin;

      const application = await Application.findById(id)
        .populate("user_id", "demographics.fullName")
        .populate("scheme_id", "scheme_name");

      if (!application) {
        return res.status(404).json({ status: "error", message: "Application not found" });
      }

      // Only allow marking after approval (or if already marked)
      if (application.status !== "Approved" && application.status !== "Benefit Transferred") {
        return res.status(400).json({
          status: "error",
          message: 'Only "Approved" applications can be marked as "Benefit Transferred".',
          currentStatus: application.status,
        });
      }

      const prevStatus = application.status;
      application.status = "Benefit Transferred";
      if (remarks && String(remarks).trim()) {
        application.remarks = String(remarks).trim();
      }

      // Audit entry (reuse verification_history structure)
      const ApplicationModel = require("../models/Application");
      const currentLevel = ApplicationModel.normalizeVerificationLevel(application.verification_level || 0);
      application.verification_history.push({
        stage: ApplicationModel.getStageNameFromLevel(currentLevel),
        verification_level: currentLevel,
        verified_by: admin._id,
        verified_by_name: admin.fullName,
        verified_by_role: admin.role,
        verified_by_role_level: admin.roleLevel,
        action: "Verified",
        remarks: `Marked as Benefit Transferred (prev status: ${prevStatus}).${remarks && String(remarks).trim() ? ` ${String(remarks).trim()}` : ""}`,
        verified_at: new Date(),
      });

      await application.save();

      return res.status(200).json({
        status: "success",
        message: "Application marked as Benefit Transferred",
        data: {
          _id: application._id,
          status: application.status,
          schemeName: application.scheme_id?.scheme_name || null,
          applicantName: application.user_id?.demographics?.fullName || null,
        },
      });
    } catch (error) {
      console.error("Error marking Benefit Transferred:", error);
      if (error.name === "CastError") {
        return res.status(400).json({ status: "error", message: "Invalid application ID" });
      }
      return res.status(500).json({ status: "error", message: "Failed to mark Benefit Transferred" });
    }
  }
);

// GET /api/applications - Get applications (with filters)
// All admins can VIEW applications, but department filtering applies:
// - Secretary (level 3) and above (Admin level 2, Super Admin level 1) can view ALL departments
// - Below Secretary (level > 3) can only view their own department
router.get("/", adminAuth, async (req, res) => {
  try {
    const {
      user_id,
      scheme_id,
      status,
      verification_stage,
      verification_level,
      assigned_to_me,
      search,
      district,
    } = req.query;
    const adminRoleLevel = req.admin.roleLevel;
    const adminDepartmentId = req.admin.departmentId;

    const query = {};

    // Normalize status filter coming from frontend (case-insensitive)
    const normalizeStatus = (v) => {
      if (v === undefined || v === null) return null;
      const s = String(v).trim().toLowerCase();
      if (s === "applied") return "Applied";
      if (s === "under review" || s === "under_review") return "Under Review";
      if (s === "approved") return "Approved";
      if (s === "benefit transferred" || s === "benefit_transferred" || s === "benefit-transferred") return "Benefit Transferred";
      if (s === "rejected") return "Rejected";
      if (s === "pending") return "Pending";
      if (s === "bioauthentication" || s === "bio-authentication" || s === "bio_authentication")
        return "Bioauthentication";
      return String(v).trim();
    };

    if (user_id) {
      query.user_id = user_id;
    }

    if (scheme_id) {
      query.scheme_id = scheme_id;
    }

    if (status) query.status = normalizeStatus(status);

    if (verification_stage) {
      query.verification_stage = verification_stage;
    }

    // Filter by current verifier if assigned_to_me is true
    if (assigned_to_me === "true") {
      query["current_verifier.verified_by"] = req.admin._id;
    }

    // verification_level filter: e.g. verification_level=5 or verification_level=5,9
    if (verification_level) {
      const levels = String(verification_level)
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n));
      if (levels.length > 0) query.verification_level = levels.length === 1 ? levels[0] : { $in: levels };
    }

    // Optional district filter (applicant's district from PublicUser.address.district)
    // Accepted values (canonical list): Gangtok, Gyalshing, Mangan, Namchi, Pakyong, Soreng
    // Matching is case-insensitive and exact by default.
    if (district && String(district).trim().length > 0) {
      const d = String(district).trim();
      const districtRegex = new RegExp(`^${d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
      const districtUsers = await PublicUser.find({ "address.district": districtRegex }).select("_id");
      const districtUserIds = districtUsers.map((u) => u._id);
      // If there are no users in this district, return empty result set quickly.
      if (districtUserIds.length === 0) {
        return res.status(200).json({ status: "success", data: [], count: 0 });
      }
      // If an explicit user_id is provided, ensure it belongs to this district.
      if (query.user_id) {
        const explicitId = String(query.user_id);
        const allowed = new Set(districtUserIds.map((id) => String(id)));
        if (!allowed.has(explicitId)) {
          return res.status(200).json({ status: "success", data: [], count: 0 });
        }
      } else {
        query.user_id = { $in: districtUserIds };
      }
    }

    // Optional search text across:
    // - PublicUser.demographics.fullName
    // - PublicUser.aadhaarNumber
    // - PublicUser.contact.mobile.value
    // - Scheme.scheme_name
    if (search && String(search).trim().length > 0) {
      const term = String(search).trim();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");

      const [userMatches, schemeMatches] = await Promise.all([
        PublicUser.find({
          $or: [
            { "demographics.fullName": regex },
            { aadhaarNumber: regex },
            { "contact.mobile.value": regex },
          ],
        }).select("_id"),
        Scheme.find({ scheme_name: regex }).select("_id"),
      ]);

      const userIds = userMatches.map((u) => u._id);
      const schemeIds = schemeMatches.map((s) => s._id);

      const orConditions = [];
      // If district filter already constrained user_id, intersect with search userIds (to keep results correct).
      if (userIds.length > 0) {
        const existingUserIdFilter = query.user_id && typeof query.user_id === "object" ? query.user_id : null;
        if (existingUserIdFilter && Array.isArray(existingUserIdFilter.$in)) {
          const allowed = new Set(existingUserIdFilter.$in.map((id) => String(id)));
          const intersected = userIds.filter((id) => allowed.has(String(id)));
          if (intersected.length > 0) orConditions.push({ user_id: { $in: intersected } });
        } else {
          orConditions.push({ user_id: { $in: userIds } });
        }
      }
      if (schemeIds.length > 0) orConditions.push({ scheme_id: { $in: schemeIds } });

      // If no matches for search term, return empty result set.
      query.$or = orConditions.length > 0 ? orConditions : [];
    }

    // CSC Admin (level 5): by default only show CSC-stage apps they can verify.
    // Pass show_all=true to see all department applications.
    if (
      adminRoleLevel === 5 &&
      !verification_stage &&
      !verification_level &&
      req.query.show_all !== "true"
    ) {
      query.verification_level = { $in: [5, 9] };
      query.status = { $ne: "Rejected" };
    }

    // NOTE: Removed verification level filtering for other admins - all admins can VIEW applications
    // Verification/acceptance restrictions are still enforced in the verify endpoint

    // Fetch applications
    const applications = await Application.find(query)
      .populate("user_id", "demographics.fullName demographics.gender demographics.dob aadhaarNumber contact")
      .populate({
        path: "scheme_id",
        select: "scheme_name scheme_type category department",
      })
      .populate("current_verifier.verified_by", "fullName username role")
      .sort({ createdAt: -1 });
    
    // Apply department filtering after population
    // DistrictHQ Head (level 3) and above can see all departments
    // Below DistrictHQ Head (level > 3) can only see their own department
    let filteredApplications = applications;
    if (adminRoleLevel > 3 && adminDepartmentId) {
      // Filter by department for roles below Secretary
      // Compare department IDs (ObjectId strings) - direct string comparison
      filteredApplications = applications.filter(app => {
        const schemeDept = app.scheme_id?.department;
        if (!schemeDept) return false;
        // Direct string comparison (ObjectId strings are case-sensitive)
        return schemeDept.trim() === adminDepartmentId.trim();
      });
    }
    // If roleLevel <= 3 (Secretary, Admin, Super Admin), show all applications (no filtering)
    
    // Transform to include applicant name and verification info
    const transformedApplications = filteredApplications.map(app => {
      const appObj = app.toObject();
      return {
        ...appObj,
        // Alias for admin UI convenience
        documents_submitted: appObj.documents_submitted || [],
        documents: appObj.documents_submitted || [],
        applicantName: app.user_id?.demographics?.fullName || "Unknown",
        applicantId: app.user_id?._id || null,
        schemeName: app.scheme_id?.scheme_name || "Unknown",
        schemeId: app.scheme_id?._id || null,
      };
    });

    res.status(200).json({
      status: "success",
      data: transformedApplications,
      count: transformedApplications.length,
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

// GET /api/applications/scheme/:scheme_id - Get all applicants for a specific scheme
router.get("/scheme/:scheme_id", async (req, res) => {
  try {
    const { scheme_id } = req.params;
    const { district, search } = req.query;

    // Check if scheme exists
    const scheme = await Scheme.findById(scheme_id);
    if (!scheme) {
      return res.status(404).json({
        status: "error",
        message: "Scheme not found",
      });
    }

    // Optional district filter: applicant's PublicUser.address.district
    // Optional search: matches PublicUser (name/aadhaar/mobile) within this scheme
    let userIdConstraint = null; // { $in: ObjectId[] } or null
    if (district && String(district).trim().length > 0) {
      const d = String(district).trim();
      const districtRegex = new RegExp(`^${d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
      const users = await PublicUser.find({ "address.district": districtRegex }).select("_id");
      const ids = users.map((u) => u._id);
      if (ids.length === 0) {
        return res.status(200).json({
          status: "success",
          scheme: {
            _id: scheme._id,
            scheme_name: scheme.scheme_name,
            category: scheme.category,
            department: scheme.department,
          },
          applicants: [],
          total_applicants: 0,
          count_by_status: { Applied: 0, "Under Review": 0, Approved: 0, Rejected: 0, Pending: 0 },
        });
      }
      userIdConstraint = { $in: ids };
    }

    if (search && String(search).trim().length > 0) {
      const term = String(search).trim();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      const users = await PublicUser.find({
        $or: [
          { "demographics.fullName": regex },
          { aadhaarNumber: regex },
          { "contact.mobile.value": regex },
        ],
      }).select("_id");
      const ids = users.map((u) => u._id);
      if (ids.length === 0) {
        return res.status(200).json({
          status: "success",
          scheme: {
            _id: scheme._id,
            scheme_name: scheme.scheme_name,
            category: scheme.category,
            department: scheme.department,
          },
          applicants: [],
          total_applicants: 0,
          count_by_status: { Applied: 0, "Under Review": 0, Approved: 0, Rejected: 0, Pending: 0 },
        });
      }
      if (userIdConstraint && Array.isArray(userIdConstraint.$in)) {
        const allowed = new Set(userIdConstraint.$in.map((id) => String(id)));
        const intersected = ids.filter((id) => allowed.has(String(id)));
        if (intersected.length === 0) {
          return res.status(200).json({
            status: "success",
            scheme: {
              _id: scheme._id,
              scheme_name: scheme.scheme_name,
              category: scheme.category,
              department: scheme.department,
            },
            applicants: [],
            total_applicants: 0,
            count_by_status: { Applied: 0, "Under Review": 0, Approved: 0, Rejected: 0, Pending: 0 },
          });
        }
        userIdConstraint = { $in: intersected };
      } else {
        userIdConstraint = { $in: ids };
      }
    }

    // Find all applications for this scheme
    const appQuery = { scheme_id };
    if (userIdConstraint) appQuery.user_id = userIdConstraint;

    const applications = await Application.find(appQuery)
      .populate("user_id", "demographics.fullName demographics.gender demographics.dob aadhaarNumber contact address")
      .populate({
        path: "scheme_id",
        select: "scheme_name scheme_type category department scheme_description",
      })
      .populate("current_verifier.verified_by", "fullName username role")
      .sort({ createdAt: -1 });

    // Get ApplicationModel helper functions
    const ApplicationModel = require("../models/Application");
    
    // Transform applications to simple table format (essential fields only)
    const applicants = applications.map(app => {
      const appObj = app.toObject();
      const user = app.user_id;
      
      // Get verification stage from level (always derive from level for consistency)
      let verificationStage = "";
      if (appObj.verification_level !== undefined && appObj.verification_level !== null) {
        verificationStage = ApplicationModel.getStageNameFromLevel(appObj.verification_level);
      }
      
      return {
        application_id: appObj._id?.toString() || "",
        full_name: user?.demographics?.fullName || "",
        status: appObj.status || "",
        date_applied: appObj.date_applied || appObj.createdAt,
        verification_stage: verificationStage,
        // Include submitted documents for admin view
        documents_submitted: appObj.documents_submitted || [],
        documents: appObj.documents_submitted || [],
      };
    });

    res.status(200).json({
      status: "success",
      scheme: {
        _id: scheme._id,
        scheme_name: scheme.scheme_name,
        category: scheme.category,
        department: scheme.department,
      },
      applicants: applicants,
      total_applicants: applicants.length,
      count_by_status: {
        Applied: applicants.filter(a => a.status === "Applied").length,
        "Under Review": applicants.filter(a => a.status === "Under Review").length,
        Approved: applicants.filter(a => a.status === "Approved").length,
        "Benefit Transferred": applicants.filter(a => a.status === "Benefit Transferred").length,
        Rejected: applicants.filter(a => a.status === "Rejected").length,
        Pending: applicants.filter(a => a.status === "Pending").length,
      },
    });
  } catch (error) {
    console.error("Error fetching scheme applicants:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid scheme ID",
      });
    }
    res.status(500).json({
      status: "error",
      message: "Failed to fetch scheme applicants",
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
    const currentLevel = ApplicationModel.normalizeVerificationLevel(application.verification_level || 0);
    const requiredRoleLevels = ApplicationModel.getRequiredRoleLevels(currentLevel);

    // Get next level: 5(CSC)→4(District Overlookers)→3(DistrictHQ Head)→1/2(Admin)→99
    let nextLevel = null;
    if (currentLevel === 5) nextLevel = 4;
    else if (currentLevel === 4) nextLevel = 3;
    else if (currentLevel === 3) nextLevel = 1;
    else if (currentLevel === 1 || currentLevel === 2) nextLevel = 99;
    
    const nextRequiredRoleLevels = nextLevel ? ApplicationModel.getRequiredRoleLevels(nextLevel) : [];

    const adminRoleLevel = req.admin?.roleLevel ?? 999;
    const canVerify = requiredRoleLevels.includes(adminRoleLevel);

    const currentStage = ApplicationModel.getStageNameFromLevel(currentLevel);
    const nextStage = nextLevel ? ApplicationModel.getStageNameFromLevel(nextLevel) : null;

    const appObj = application.toObject();
    const transformedApp = {
      ...appObj,
      applicantName: application.user_id?.demographics?.fullName || "Unknown",
      applicantId: application.user_id?._id || null,
      schemeName: application.scheme_id?.scheme_name || "Unknown",
      schemeId: application.scheme_id?._id || null,
      documents_submitted: appObj.documents_submitted || [],
      documents: appObj.documents_submitted || [],
      // Application's current stage (not admin level)
      verification_level: currentLevel,
      verification_stage: currentStage,
      currentVerificationLevel: currentLevel,
      currentStage,
      required_role_levels: requiredRoleLevels,
      requiredRoleLevels,
      // Application's next stage
      next_verification_level: nextLevel,
      next_verification_stage: nextStage,
      nextVerificationLevel: nextLevel,
      nextStage,
      next_required_role_levels: nextRequiredRoleLevels,
      nextRequiredRoleLevels: nextRequiredRoleLevels,
      // Logged-in admin's role level and permission
      canVerify,
      currentAdminLevel: adminRoleLevel,
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

// Helper function to get stage requirements (sequential levels 1-5)
function getStageRequirements(stage) {
  const requirements = {
    Applied: { roleLevels: [5], roleNames: ["CSC Admin"] },
    CSC_Admin_Review: { roleLevels: [5], roleNames: ["CSC Admin"] },
    District_Overlookers_Review: { roleLevels: [4], roleNames: ["District Overlookers"] },
    Admin_Review: { roleLevels: [1, 2], roleNames: ["Super Admin", "Admin"] },
    District_Head_Review: { roleLevels: [3], roleNames: ["DistrictHQ Head"] },
    Completed: { roleLevels: [], roleNames: [] },
  };
  return requirements[stage] || { roleLevels: [], roleNames: [] };
}

// Helper function to get next stage requirements
function getNextStageRequirements(stage) {
  const nextStages = {
    Applied: "CSC_Admin_Review",
    CSC_Admin_Review: "District_Overlookers_Review",
    District_Overlookers_Review: "District_Head_Review",
    District_Head_Review: "Admin_Review",
    Admin_Review: "Completed",
    Completed: null,
  };
  return nextStages[stage] ? getStageRequirements(nextStages[stage]) : null;
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
    const currentLevel = ApplicationModel.normalizeVerificationLevel(application.verification_level || 0);

    // Get next level: 5(CSC)→4(District Overlookers)→3(DistrictHQ Head)→1/2(Admin)→99
    let nextLevel = null;
    if (currentLevel === 5) nextLevel = 4;
    else if (currentLevel === 4) nextLevel = 3;
    else if (currentLevel === 3) nextLevel = 1;
    else if (currentLevel === 1 || currentLevel === 2) nextLevel = 99;

    if (!nextLevel || nextLevel === 99) {
      const currentRequiredRoleLevels = ApplicationModel.getRequiredRoleLevels(currentLevel);
      const currentAdminCanVerify = currentRequiredRoleLevels.includes(req.admin.roleLevel);
      return res.status(200).json({
        status: "success",
        message: "No next stage available (application is at final stage)",
        data: [],
        next_verification_level: null,
        next_verification_stage: null,
        nextVerificationLevel: null,
        nextStage: null,
        currentAdminLevel: req.admin.roleLevel,
        currentVerificationLevel: currentLevel,
        currentStage: ApplicationModel.getStageNameFromLevel(currentLevel),
        higherAuthorityLevels: [],
        currentAdminCanVerify,
      });
    }
    
    const nextRequiredRoleLevels = ApplicationModel.getRequiredRoleLevels(nextLevel);
    const currentRequiredRoleLevels = ApplicationModel.getRequiredRoleLevels(currentLevel);

    // Get current admin level
    const currentAdminLevel = req.admin.roleLevel;
    const currentAdminCanVerify = currentRequiredRoleLevels.includes(currentAdminLevel);

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

    const currentStage = ApplicationModel.getStageNameFromLevel(currentLevel);
    const nextStage = ApplicationModel.getStageNameFromLevel(nextLevel);

    res.status(200).json({
      status: "success",
      data: adminsWithLevel,
      // Application's current stage (number and name)
      current_verification_level: currentLevel,
      current_verification_stage: currentStage,
      currentVerificationLevel: currentLevel,
      currentStage,
      // Application's next stage
      next_verification_level: nextLevel,
      next_verification_stage: nextStage,
      nextVerificationLevel: nextLevel,
      nextStage,
      required_role_levels: nextRequiredRoleLevels,
      requiredRoleLevels: nextRequiredRoleLevels,
      // Logged-in admin's role level (not application stage)
      currentAdminLevel,
      // Role levels that are higher authority than current admin (for "forward to" list)
      higherAuthorityLevels: higherAuthorityLevels,
      currentAdminCanVerify,
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
    Applied: "CSC_Admin_Review",
    CSC_Admin_Review: "District_Overlookers_Review",
    District_Overlookers_Review: "District_Head_Review",
    District_Head_Review: "Admin_Review",
    Admin_Review: "Completed",
    Completed: null,
  };
  return nextStages[stage] || null;
}

// POST /api/applications/:id/send-completion-otp - Send OTP to admin's mobile to verify authority before completing
router.post("/:id/send-completion-otp", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const admin = req.admin;

    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ status: "error", message: "Application not found" });
    }

    const adminUser = await AdminUser.findById(admin._id).select("contactNumber");
    const mobileNumber = adminUser?.contactNumber?.trim();
    if (!mobileNumber) {
      return res.status(400).json({
        status: "error",
        message: "Your admin account has no phone number. Add contactNumber to complete applications.",
      });
    }

    const ApplicationModel = require("../models/Application");
    const currentLevel = ApplicationModel.normalizeVerificationLevel(application.verification_level || 0);
    const isAdminReview = currentLevel === 1 || currentLevel === 2;
    const requiredRoleLevels = ApplicationModel.getRequiredRoleLevels(currentLevel);
    const canVerify = requiredRoleLevels.includes(admin.roleLevel);

    if (!isAdminReview || !canVerify) {
      return res.status(403).json({
        status: "error",
        message: "Only Super Admin or Admin can send completion OTP when application is at Admin_Review stage.",
        verification_level: currentLevel,
      });
    }

    const purpose = `application_complete_${id}_${admin._id}`;
    const result = await requestOTP(mobileNumber, purpose);

    if (!result.success) {
      return res.status(400).json({
        status: "error",
        message: result.message || "Failed to send OTP",
      });
    }

    res.status(200).json({
      status: "success",
      message: "OTP sent to your registered mobile number. Enter it to complete the application.",
      ...(process.env.NODE_ENV !== "production" && result.otp ? { otp: result.otp } : {}),
    });
  } catch (error) {
    console.error("Send completion OTP error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to send OTP",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

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
    
    // If verification_level is not set, derive from verification_stage
    if (currentLevel === null || currentLevel === undefined) {
      const stageMap = {
        Applied: 0,
        CSC_Admin_Review: 5,
        District_Overlookers_Review: 4,
        Admin_Review: 1,
        District_Head_Review: 3,
        Completed: 99,
      };
      currentLevel = stageMap[application.verification_stage] ?? 5;
      application.verification_level = currentLevel;
    }
    // Normalize levels to sequential (1-5) for logic
    currentLevel = ApplicationModel.normalizeVerificationLevel(currentLevel);
    
    const adminRoleLevel = admin.roleLevel;

    // Use scheme's authorization_levels as source of truth (follows [1,3] etc); fallback to application if scheme has none
    const schemeId = application.scheme_id?._id ?? application.scheme_id;
    const schemeDoc =
      application.scheme_id?.authorization_levels !== undefined
        ? application.scheme_id
        : await Scheme.findById(schemeId).select("authorization_levels");
    const schemeAuthLevels = (schemeDoc?.authorization_levels || [])
      .map(mapOldAuthorizationLevelToNew)
      .filter((v) => v === 1 || v === 2 || v === 3 || v === 4);
    const authorizationLevels =
      schemeAuthLevels.length > 0
        ? schemeAuthLevels
        : (application.authorization_levels || [])
            .map(mapOldAuthorizationLevelToNew)
            .filter((v) => v === 1 || v === 2 || v === 3 || v === 4);
    const authorizationLevelIndex = application.authorization_level_index || 0;
    
    // Check if using scheme-specific workflow or default workflow
    const useSchemeWorkflow = authorizationLevels.length > 0;
    
    // Get required role levels for current verification level
    // Who can verify is determined by the current verification_level (stage), not by scheme index
    let requiredRoleLevels = ApplicationModel.getRequiredRoleLevels(currentLevel);
    
    // Check if admin can verify at this level
    const canVerify = requiredRoleLevels.includes(adminRoleLevel);
    
    // Determine next level based on workflow type and action
    let nextLevel = null;
    let nextAuthorizationLevelIndex = authorizationLevelIndex;
    
    if (canVerify) {
      if (action === "Verified" || action === "Forwarded") {
        // CSC Admin (5) always forwards to District Overlookers (4) first
        if (currentLevel === 5) {
          nextLevel = 4;
          nextAuthorizationLevelIndex = 0;
        } else if (useSchemeWorkflow) {
          if (authorizationLevelIndex < authorizationLevels.length) {
            let reverseIndex = authorizationLevels.length - 1 - authorizationLevelIndex;
            nextLevel = authorizationLevels[reverseIndex];
            nextAuthorizationLevelIndex = authorizationLevelIndex + 1;
          }
          // Complete when: no next level, or we've finished scheme sequence, or next would repeat current (duplicate levels in scheme)
          if (
            nextLevel === null ||
            nextAuthorizationLevelIndex >= authorizationLevels.length ||
            nextLevel === currentLevel
          ) {
            nextLevel = 99;
          }
        } else {
          // Default workflow: 5(CSC) → 4(District Overlookers) → 3(DistrictHQ Head) → 1/2(Admin) → 99
          if (currentLevel === 5) {
            nextLevel = 4;
          } else if (currentLevel === 4) {
            nextLevel = 3;
          } else if (currentLevel === 3) {
            nextLevel = 1;
          } else if (currentLevel === 1 || currentLevel === 2) {
            nextLevel = 99;
          } else if (currentLevel === 99) {
            nextLevel = 99;
          }
        }
      } else if (action === "Returned") {
        if (useSchemeWorkflow) {
          // Return one step (reverse order): at index 1 go back to 7; at index 2 go to auth[last-1]; etc.
          if (authorizationLevelIndex > 1) {
            nextAuthorizationLevelIndex = authorizationLevelIndex - 1;
            const reverseIndex = authorizationLevels.length - 1 - (authorizationLevelIndex - 1);
            nextLevel = authorizationLevels[reverseIndex];
          } else if (authorizationLevelIndex === 1) {
            nextAuthorizationLevelIndex = 0;
            nextLevel = 4; // Back to District Overlookers
          } else {
            nextLevel = currentLevel; // Already at 7, can't go back
          }
        } else {
          // Return (one step back): 1/2→3, 3→4, 4→5, 5→stay
          if (currentLevel === 1 || currentLevel === 2) {
            nextLevel = 3;
          } else if (currentLevel === 3) {
            nextLevel = 4;
          } else if (currentLevel === 4) {
            nextLevel = 5;
          } else if (currentLevel === 5) {
            nextLevel = currentLevel;
          }
        }
      }
    }

    if (!canVerify) {
      const stageName = ApplicationModel.getStageNameFromLevel(currentLevel);
      const isCscStage = currentLevel === 5;
      const isCscAdmin = adminRoleLevel === 5;
      let message = `You don't have permission to verify applications at verification level ${currentLevel}. Required role levels: ${requiredRoleLevels.join(", ")}`;
      let reason = "role_mismatch";
      let statusCode = 403;

      if (currentLevel === 99) {
        message = "This application is already completed.";
        reason = "already_completed";
        statusCode = 409;
      }
      if (isCscAdmin && !isCscStage) {
        message =
          "This application is not at CSC Admin (bio-auth) stage. Only applications pending CSC verification can be verified by CSC Admin.";
        reason = "application_not_at_csc_stage";
        statusCode = 403;
      }
      return res.status(statusCode).json({
        status: "error",
        reason,
        message,
        verification_level: currentLevel,
        verification_stage: stageName,
        required_role_levels: requiredRoleLevels,
        your_role_level: adminRoleLevel,
      });
    }

    // At Admin_Review (level 1/2), OTP verification required - admin must verify their identity via OTP to their phone
    const isAdminReview = currentLevel === 1 || currentLevel === 2;
    if (
      (action === "Verified" || action === "Forwarded") &&
      nextLevel === 99 &&
      isAdminReview
    ) {
      const { otp } = req.body;
      const mobileNumber = adminUser?.contactNumber?.trim();

      if (!mobileNumber) {
        return res.status(400).json({
          status: "error",
          reason: "no_phone",
          message: "Your admin account has no phone number. Add contactNumber to complete applications.",
        });
      }
      if (!otp || typeof otp !== "string" || !otp.trim()) {
        return res.status(400).json({
          status: "error",
          reason: "otp_required",
          message:
            "OTP verification required. Send OTP first via POST /api/applications/:id/send-completion-otp, then provide otp in the request body.",
        });
      }

      const purpose = `application_complete_${id}_${admin._id}`;
      const verification = verifyOTP(mobileNumber, otp.trim(), purpose);
      if (!verification.valid) {
        return res.status(400).json({
          status: "error",
          reason: "otp_invalid",
          message: verification.message,
        });
      }
    }

    // Handle rejection: reset to first stage (District Overlookers) so applicant can revise and re-submit
    if (action === "Rejected") {
      application.status = "Rejected";
      application.verification_level = 4; // District Overlookers - first stage after CSC Admin
      application.verification_stage = "District_Overlookers_Review";
      application.authorization_level_index = 0;
      application.current_verifier = {
        verified_by: null,
        verified_by_name: null,
        verified_by_role: null,
        verified_by_role_level: null,
        remarks: null,
        verified_at: null,
      };
    } else if (nextLevel === 99) {
      // Verification completed successfully - set status to Approved
      application.status = "Approved";
      if (isAdminReview) application.completion_otp_verified_at = new Date();
    } else {
      // Moving to next stage - no longer "just applied"
      application.status = "Under Review";
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

    // Update current verifier (skip for Rejected - already cleared above)
    if (action === "Rejected") {
      // current_verifier already set in Rejected block
    } else if (nextLevel !== null && nextLevel !== 99) {
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

    // Update verification level and authorization index
    if (nextLevel !== null) {
      application.verification_level = nextLevel;
      application.verification_stage = ApplicationModel.getStageNameFromLevel(nextLevel);
      if (useSchemeWorkflow) {
        application.authorization_level_index = nextAuthorizationLevelIndex;
        // Fix corrupt authorization_levels: sync to scheme's [1,3] etc
        if (
          schemeAuthLevels.length > 0 &&
          JSON.stringify(application.authorization_levels) !== JSON.stringify(authorizationLevels)
        ) {
          application.authorization_levels = authorizationLevels;
        }
      }
    }
    
    // Ensure verification_level is always set
    if (!application.verification_level && application.verification_level !== 0) {
      application.verification_level = 4; // Default to District Overlookers level
    }

    // Update reviewed_by, reviewed_at, remarks
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
      // Alias for admin UI convenience
      documents_submitted: appObj.documents_submitted || [],
      documents: appObj.documents_submitted || [],
      verification_level: updatedApplication.verification_level || 4,
      verification_stage: ApplicationModel.getStageNameFromLevel(updatedApplication.verification_level || 4),
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
      .populate({
        path: "scheme_id",
        select: "scheme_name scheme_type category department",
        populate: [
          { path: "category", select: "category_name category_display_name" },
          { path: "department", select: "department_name department_display_name" }
        ]
      })
      .select("status verification_level date_applied scheme_id createdAt updatedAt")
      .sort({ createdAt: -1 });

    const ApplicationModel = require("../models/Application");
    
    // Count by status
    const statusCounts = {
      total: applications.length,
      applied: 0,
      under_review: 0,
      bioauthentication: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
    };

    // Count by verification stage
    const stageCounts = {
      applied: 0,
      csc_admin_review: 0,
      district_overlookers_review: 0,
      admin_review: 0,
      district_head_review: 0,
      completed: 0,
    };

    const summary = applications.map(app => {
      const status = app.status;
      const level = ApplicationModel.normalizeVerificationLevel(app.verification_level || 0);
      
      // Update status counts
      if (status === "Applied") statusCounts.applied++;
      else if (status === "Under Review") statusCounts.under_review++;
      else if (status === "Bioauthentication") statusCounts.bioauthentication++;
      else if (status === "Approved") statusCounts.approved++;
      else if (status === "Rejected") statusCounts.rejected++;
      else if (status === "Pending") statusCounts.pending++;

      // Update stage counts (sequential levels 1-5)
      if (level === 0) stageCounts.applied++;
      else if (level === 5) stageCounts.csc_admin_review++;
      else if (level === 4) stageCounts.district_overlookers_review++;
      else if (level === 1 || level === 2) stageCounts.admin_review++;
      else if (level === 3) stageCounts.district_head_review++;
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
      const currentLevel = ApplicationModel.normalizeVerificationLevel(app.verification_level || 0);
      
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
    const currentLevel = ApplicationModel.normalizeVerificationLevel(application.verification_level || 0);

    // Get next level: 5→4→3→1/2→99
    let nextLevel = null;
    if (currentLevel === 5) nextLevel = 4;
    else if (currentLevel === 4) nextLevel = 1;
    else if (currentLevel === 1 || currentLevel === 2) nextLevel = 3;
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
    "Bioauthentication": "Bioauthentication Required",
  };
  return statusMap[status] || status;
}

function getVerificationStageDisplay(level) {
  const AppModel = require("../models/Application");
  const normalized = AppModel.normalizeVerificationLevel(level);
  const stageMap = {
    0: "Application Submitted",
    5: "CSC Admin Review",
    4: "District Overlookers Review",
    1: "Admin Review",
    2: "Admin Review",
    3: "District Head Review",
    99: "Completed",
  };
  return stageMap[normalized] || "Unknown Stage";
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
// When at Admin_Review, OTP verification is required. Send OTP via POST /:id/send-completion-otp first.
router.put("/:applicationId/approve", adminAuth, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { remarks, otp } = req.body;
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

    const ApplicationModel = require("../models/Application");
    const currentLevel = ApplicationModel.normalizeVerificationLevel(application.verification_level || 0);
    const isAdminReview = currentLevel === 1 || currentLevel === 2;
    // Only Super Admin or Admin can use the approve endpoint
    const canApprove = admin.roleLevel <= 2;

    if (!canApprove) {
      return res.status(403).json({
        status: "error",
        message: "Only Super Admin or Admin can approve applications.",
      });
    }

    // At Admin_Review stage, OTP verification required - admin must verify their identity via OTP to their phone
    if (isAdminReview) {
      const adminUserDoc = await AdminUser.findById(admin._id).select("contactNumber");
      const mobileNumber = adminUserDoc?.contactNumber?.trim();
      if (!mobileNumber) {
        return res.status(400).json({
          status: "error",
          reason: "no_phone",
          message: "Your admin account has no phone number. Add contactNumber to complete applications.",
        });
      }
      if (!otp || typeof otp !== "string" || !otp.trim()) {
        return res.status(400).json({
          status: "error",
          reason: "otp_required",
          message:
            "OTP verification required. Send OTP first via POST /api/applications/:id/send-completion-otp, then provide otp in the request body.",
        });
      }
      const purpose = `application_complete_${applicationId}_${admin._id}`;
      const verification = verifyOTP(mobileNumber, otp.trim(), purpose);
      if (!verification.valid) {
        return res.status(400).json({
          status: "error",
          reason: "otp_invalid",
          message: verification.message,
        });
      }
    }

    // Update application status
    application.status = "Approved";
    application.verification_level = 99;
    application.verification_stage = "Completed";
    if (isAdminReview) application.completion_otp_verified_at = new Date();

    // Add to verification history
    application.verification_history.push({
      stage: ApplicationModel.getStageNameFromLevel(currentLevel),
      verification_level: currentLevel,
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

    // Update reviewed_by, reviewed_at
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
      data: {
        ...updatedApplication.toObject(),
        documents: updatedApplication.documents_submitted || [],
      },
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
    const ApplicationModel = require("../models/Application");
    const currentLevel = ApplicationModel.normalizeVerificationLevel(application.verification_level || 0);
    const currentStage = ApplicationModel.getStageNameFromLevel(currentLevel);
    const currentStageReqs = getStageRequirements(currentStage);
    const nextStageReqs = getNextStageRequirements(currentStage);

    const canHandleCurrentStage = currentStageReqs.roleLevels.includes(targetAdminLevel);
    const canHandleNextStage = nextStageReqs && nextStageReqs.roleLevels.includes(targetAdminLevel);

    if (!canHandleCurrentStage && !canHandleNextStage) {
      return res.status(400).json({
        status: "error",
        message: `Target admin does not have appropriate role level for current or next verification stage.`,
        currentStage,
        currentStageRequiredLevels: currentStageReqs.roleLevels,
        nextStageRequiredLevels: nextStageReqs ? nextStageReqs.roleLevels : null,
        targetAdminLevel: targetAdminLevel,
      });
    }

    // Add to verification history
    application.verification_history.push({
      stage: currentStage,
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

    // Update reviewed_by, reviewed_at
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
      data: {
        ...updatedApplication.toObject(),
        documents: updatedApplication.documents_submitted || [],
      },
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

    // Update reviewed_by, reviewed_at
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
      data: {
        ...updatedApplication.toObject(),
        documents: updatedApplication.documents_submitted || [],
      },
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

