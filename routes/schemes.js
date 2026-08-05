const express = require("express");
const router = express.Router();
const Scheme = require("../models/Scheme");
const {
  enrichSchemeForResponse,
  normalizeSchemeDocumentsPayload,
} = require("../utils/documentTypeService");

// Derive field_key from title: "Scheme Name" -> "scheme_name"
function titleToFieldKey(title) {
  if (!title || typeof title !== "string") return "";
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

// Normalize scheme image URL for the frontend:
// Stored DB value is often `public/uploads/...`. Many frontends then prefix `/`,
// resulting in requests to `/public/uploads/...`. To avoid that (and prefer `/uploads/...`),
// we strip any leading `public/` (and any leading `/`) from scheme_image_file_url.
function normalizeSchemeImageUrl(url) {
  if (!url || typeof url !== "string") return url;

  // If it's already an absolute URL, keep as-is.
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  let normalized = url;
  if (normalized.startsWith("/")) normalized = normalized.slice(1);
  if (normalized.startsWith("public/")) normalized = normalized.slice("public/".length);
  return normalized;
}

// Normalize scheme_eligibility.custom_fields - form-style (label, type, required, options)
function normalizeEligibilityCustomFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields.map((f, i) => {
    const title = f.title ?? f.label ?? "";
    const field_key =
      f.field_key && String(f.field_key).trim()
        ? String(f.field_key).trim().toLowerCase().replace(/\s+/g, "_")
        : titleToFieldKey(title) || `field_${i}`;
    let options = f.options;
    if (typeof options === "string") options = options.split(",").map((s) => s.trim()).filter(Boolean);
    return {
      field_key,
      title: title || field_key,
      label: title || field_key,
      field_type: ["text", "number", "select", "date", "textarea", "checkbox"].includes(f.field_type ?? f.type)
        ? (f.field_type ?? f.type)
        : "text",
      required: !!f.required,
      options: Array.isArray(options) ? options : [],
    };
  });
}

// Normalize custom_form_fields: accepts title (display) or label, derives field_key from title
// Multiple fields are stored. Supports depends_on for conditional/sub-fields.
function normalizeCustomFormFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields.map((f, i) => {
    const title = f.title ?? f.label ?? "";
    const field_key =
      f.field_key && String(f.field_key).trim()
        ? String(f.field_key).trim().toLowerCase().replace(/\s+/g, "_")
        : titleToFieldKey(title);
    const field_type = f.field_type ?? f.type ?? "text";
    let options = f.options;
    if (typeof options === "string") {
      options = options.split(",").map((s) => s.trim()).filter(Boolean);
    }
    const normalized = {
      field_key: field_key || `field_${i}`,
      title: title || field_key,
      label: title || field_key,
      field_type,
      required: !!f.required,
      options: Array.isArray(options) ? options : [],
    };
    if (f.depends_on && f.depends_on.field_key) {
      normalized.depends_on = {
        field_key: String(f.depends_on.field_key).trim(),
        value: f.depends_on.value,
      };
    }
    return normalized;
  });
}
const Application = require("../models/Application");
const AdminUser = require("../models/AdminUser");
const { checkEligibility, hasAppliedToExcludedSchemes } = require("../utils/eligibilityUtils");
const {
  assertApplicantAllowedForSession,
  toEligibilitySubject,
  getApplicantIdsForExcludedSchemesCheck,
} = require("../utils/applicantResolver");
const { resolvePublicUserSessionFromRequest } = require("../utils/publicSessionAnchor");
const adminAuth = require("../middleware/adminAuth");
const requireRole = require("../middleware/requireRole");
const path = require("path");
const fs = require("fs");

// Parse age_group (e.g. "20-30", "70_and_above") into { minAge, maxAge } or null
function parseAgeGroup(ageGroup) {
  if (!ageGroup || ageGroup === "all" || ageGroup === "") return null;
  if (ageGroup === "70_and_above") return { minAge: 70, maxAge: 150 };
  const match = String(ageGroup).match(/^(\d+)-(\d+)$/);
  if (match) {
    const min = parseInt(match[1], 10);
    const max = parseInt(match[2], 10);
    if (!Number.isNaN(min) && !Number.isNaN(max)) return { minAge: min, maxAge: max };
  }
  return null;
}

// GET /api/schemes - Get all schemes
// Optional query params: 
//   - filter_type: "scheme" or "applicant" (default: "applicant" if user_id is provided, otherwise "scheme")
//   - user_id: applicant id (PublicUser or BeneficiaryPerson) when filter_type=applicant
//   - publicUserId or mobileNumber: session anchor (required with user_id for applicant filter; aliases: accountId, sessionUserId)
//   - approved_only: Only return approved schemes (scheme filter - only works with filter_type="scheme")
//   - pending_approval: Return schemes pending approval AND approved schemes (scheme filter - only works with filter_type="scheme")
//   - category_id: Filter by category (ObjectId string)
//   - age_group: Filter by age range overlap. Values: "20-30", "30-40", "40-50", "50-60", "60-70", "70_and_above", "all"
router.get("/", async (req, res) => {
  try {
    const { user_id, approved_only, pending_approval, filter_type, category_id, age_group } = req.query;
    
    // Determine filter type: "scheme" or "applicant"
    // Default: "applicant" if user_id is provided, otherwise "scheme"
    const filterType = filter_type || (user_id ? "applicant" : "scheme");
    
    let query = {};
    
    // Scheme filters (only apply if filter_type is "scheme" or not specified when user_id is not provided)
    if (filterType === "scheme") {
      const approvedOnly = approved_only === "true" || approved_only === "1";
      const pendingApproval = pending_approval === "true" || pending_approval === "1";
      
      if (approvedOnly && pendingApproval) {
        // If both are true, show both pending and approved (pending_approval includes approved)
        query.approval_status = { $in: ["pending_department_head_approval", "approved"] };
      } else if (approvedOnly) {
        query.approval_status = "approved";
      } else if (pendingApproval) {
        // pending_approval shows both pending and approved schemes
        query.approval_status = { $in: ["pending_department_head_approval", "approved"] };
      }
    }

    // category_id: filter by category (scheme.category stores ObjectId string)
    if (category_id && String(category_id).trim() !== "") {
      query.category = String(category_id).trim();
    }

    // age_group: include schemes whose eligibility range overlaps with the selected age range
    const ageRange = parseAgeGroup(age_group);
    if (ageRange) {
      query["scheme_eligibility.lower_age_limit"] = { $lte: ageRange.maxAge };
      query["scheme_eligibility.upper_age_limit"] = { $gte: ageRange.minAge };
    }
    
    let schemes = await Scheme.find(query).sort({ createdAt: -1 });

    // Applicant filters (only apply if filter_type is "applicant")
    // Note: We return all schemes but add eligibility information for frontend to gray out ineligible ones
    if (filterType === "applicant" && user_id) {
      const session = await resolvePublicUserSessionFromRequest(req);
      if (!session.ok) {
        return res.status(session.status).json({ error: session.message });
      }
      const sessionUser = session.publicUser;
      const allowed = await assertApplicantAllowedForSession(sessionUser, user_id);
      if (!allowed.ok) {
        return res.status(allowed.status).json({ error: allowed.message });
      }
      const resolved = allowed.resolved;
      const subject = toEligibilitySubject(resolved);
      if (subject) {
        const exclusionIds = getApplicantIdsForExcludedSchemesCheck(resolved);
        const schemesWithEligibility = [];

        for (const scheme of schemes) {
          const eligibility = await checkEligibility(subject, scheme, exclusionIds);

          const schemeObj = scheme.toObject ? scheme.toObject() : scheme;

          schemeObj.isEligible = eligibility.eligible;
          if (!eligibility.eligible) {
            schemeObj.eligibilityReason = eligibility.reason || "Not eligible";
          }

          schemesWithEligibility.push(schemeObj);
        }

        schemes = schemesWithEligibility;
      }
    }

    const normalizedSchemes = await Promise.all(
      (schemes || []).map(async (scheme) => {
        const obj = scheme?.toObject ? scheme.toObject() : scheme;
        if (obj?.scheme_image_file_url) {
          obj.scheme_image_file_url = normalizeSchemeImageUrl(obj.scheme_image_file_url);
        }
        return enrichSchemeForResponse(obj);
      })
    );

    res.status(200).json(normalizedSchemes);
  } catch (error) {
    console.error("Error fetching schemes:", error);
    res.status(500).json({
      error: "Failed to fetch schemes",
      message: error.message,
    });
  }
});

// GET /api/schemes/simple - Get simple list of schemes for dropdowns (e.g., excluded_schemes)
// Optional query params: approved_only (default: false) - Only return approved schemes
router.get("/simple", async (req, res) => {
  try {
    const { approved_only } = req.query;
    const approvedOnly = approved_only === "true" || approved_only === "1";

    let query = {};
    if (approvedOnly) {
      query.approval_status = "approved";
    }

    const schemes = await Scheme.find(query)
      .select("_id scheme_name department category approval_status")
      .sort({ scheme_name: 1 });

    const schemeList = schemes.map((scheme) => ({
      _id: scheme._id,
      scheme_name: scheme.scheme_name,
      department: scheme.department,
      category: scheme.category,
      approval_status: scheme.approval_status,
    }));

    res.status(200).json({
      status: "success",
      schemes: schemeList,
      count: schemeList.length,
    });
  } catch (error) {
    console.error("Error fetching schemes list:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch schemes list",
      message: error.message,
    });
  }
});

// GET /api/schemes/:id - Get a single scheme by ID (includes custom_form_fields)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const scheme = await Scheme.findById(id);

    if (!scheme) {
      return res.status(404).json({
        status: "error",
        error: "Scheme not found",
        message: `No scheme found with ID: ${id}`,
      });
    }

    // Normalize scheme image URL for frontend
    const schemeObj = scheme?.toObject ? scheme.toObject() : scheme;
    if (schemeObj && schemeObj.scheme_image_file_url) {
      schemeObj.scheme_image_file_url = normalizeSchemeImageUrl(
        schemeObj.scheme_image_file_url
      );
    }

    res.status(200).json(await enrichSchemeForResponse(schemeObj));
  } catch (error) {
    console.error("Error fetching scheme:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        error: "Invalid scheme ID",
        message: "Invalid ID format",
      });
    }
    res.status(500).json({
      status: "error",
      error: "Failed to fetch scheme",
      message: error.message,
    });
  }
});

// POST /api/schemes - Create a new scheme
router.post("/", async (req, res) => {
  try {
    const schemeData = { ...req.body };
    if (schemeData.custom_form_fields !== undefined) {
      schemeData.custom_form_fields = normalizeCustomFormFields(schemeData.custom_form_fields);
    }
    if (schemeData.scheme_eligibility && schemeData.scheme_eligibility.custom_fields !== undefined) {
      schemeData.scheme_eligibility.custom_fields = normalizeEligibilityCustomFields(
        schemeData.scheme_eligibility.custom_fields
      );
    }

    let normalizedData;
    try {
      normalizedData = await normalizeSchemeDocumentsPayload(schemeData);
    } catch (e) {
      if (e.code === "UNKNOWN_DOCUMENT_TYPE") {
        return res.status(422).json({
          error: "Unknown document type",
          message: e.message,
          unknown_types: e.unknown,
        });
      }
      if (e.code === "NO_REQUIRED_DOCUMENTS") {
        return res.status(422).json({
          error: "No required documents",
          message: e.message,
        });
      }
      if (e.code === "INVALID_PROFILE_DOCUMENT_TYPE") {
        return res.status(422).json({
          error: "Invalid profile document type",
          message: e.message,
          invalid_types: e.invalid,
        });
      }
      throw e;
    }

    const scheme = await Scheme.create(normalizedData);

    res.status(200).json(await enrichSchemeForResponse(scheme));
  } catch (error) {
    console.error("Error creating scheme:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(422).json({
        error: "Validation error",
        message: messages.join(", "),
      });
    }
    res.status(500).json({
      error: "Failed to create scheme",
      message: error.message,
    });
  }
});

// POST /api/schemes/update - Update a scheme
router.post("/update", async (req, res) => {
  try {
    const { _id, ...updateData } = req.body;

    if (!_id) {
      return res.status(400).json({
        status: "error",
        error: "Scheme ID is required",
        message: "Please provide _id in the request body",
      });
    }

    // Find the scheme first
    const existingScheme = await Scheme.findById(_id);
    if (!existingScheme) {
      return res.status(404).json({
        status: "error",
        error: "Scheme not found",
        message: `No scheme found with ID: ${_id}`,
      });
    }

    // Update the scheme fields
    if (updateData.custom_form_fields !== undefined) {
      updateData.custom_form_fields = normalizeCustomFormFields(updateData.custom_form_fields);
    }
    if (updateData.scheme_eligibility && updateData.scheme_eligibility.custom_fields !== undefined) {
      updateData.scheme_eligibility.custom_fields = normalizeEligibilityCustomFields(
        updateData.scheme_eligibility.custom_fields
      );
    }
    if (
      updateData.scheme_required_document_types !== undefined ||
      updateData.scheme_profile_document_types !== undefined
    ) {
      try {
        const normalizedUpdate = await normalizeSchemeDocumentsPayload(updateData, existingScheme);
        if (updateData.scheme_required_document_types !== undefined) {
          updateData.scheme_required_document_types = normalizedUpdate.scheme_required_document_types;
        }
        if (updateData.scheme_profile_document_types !== undefined) {
          updateData.scheme_profile_document_types = normalizedUpdate.scheme_profile_document_types;
        }
      } catch (e) {
        if (e.code === "INVALID_PROFILE_DOCUMENT_TYPE") {
          return res.status(422).json({
            status: "error",
            error: "Invalid profile document type",
            message: e.message,
            invalid_types: e.invalid,
          });
        }
        if (e.code === "NO_REQUIRED_DOCUMENTS") {
          return res.status(422).json({
            status: "error",
            error: "No required documents",
            message: e.message,
          });
        }
        throw e;
      }
    }

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        existingScheme[key] = updateData[key];
      }
    });

    const scheme = await existingScheme.save();

    res.status(200).json({
      status: "success",
      message: "Scheme updated successfully",
      scheme: await enrichSchemeForResponse(scheme),
    });
  } catch (error) {
    console.error("Error updating scheme:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        error: "Invalid scheme ID",
        message: `Invalid ID format: ${error.value}`,
      });
    }
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(422).json({
        status: "error",
        error: "Validation error",
        message: messages.join(", "),
        errors: messages,
      });
    }
    res.status(500).json({
      status: "error",
      error: "Failed to update scheme",
      message: error.message,
    });
  }
});

// POST /api/schemes/deleteImage - Delete image from a scheme
router.post("/deleteImage", async (req, res) => {
  try {
    const { _id } = req.body;

    if (!_id) {
      return res.status(400).json({
        error: "Scheme ID is required",
      });
    }

    // Find the scheme
    const scheme = await Scheme.findById(_id);

    if (!scheme) {
      return res.status(404).json({
        error: "Scheme not found",
      });
    }

    // Get the image file path
    const imagePath = scheme.scheme_image_file_url;

    // Delete the image file from server if it exists
    if (imagePath) {
      // Remove 'public' prefix if present to get the relative path
      const relativePath = imagePath.startsWith("public")
        ? imagePath.substring(7) // Remove 'public' (7 characters)
        : imagePath.startsWith("/")
        ? imagePath.substring(1)
        : imagePath;

      const fullFilePath = path.join(__dirname, "..", "public", relativePath);

      // Check if file exists and delete it
      if (fs.existsSync(fullFilePath)) {
        fs.unlinkSync(fullFilePath);
      }
    }

    // Update scheme to remove image URL
    scheme.scheme_image_file_url = null;
    await scheme.save();

    res.status(200).json({
      message: "Image deleted successfully",
      data: scheme,
    });
  } catch (error) {
    console.error("Error deleting scheme image:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid scheme ID",
      });
    }
    res.status(500).json({
      error: "Failed to delete image",
      message: error.message,
    });
  }
});

// POST /api/schemes/delete - Delete a scheme by _id from body
router.post("/delete", async (req, res) => {
  try {
    const { _id } = req.body;

    if (!_id) {
      return res.status(400).json({
        error: "Scheme ID is required",
      });
    }

    // Find the scheme
    const scheme = await Scheme.findById(_id);

    if (!scheme) {
      return res.status(404).json({
        error: "Scheme not found",
      });
    }

    // Delete associated image file if it exists
    if (scheme.scheme_image_file_url) {
      const imagePath = scheme.scheme_image_file_url;
      const relativePath = imagePath.startsWith("public")
        ? imagePath.substring(7)
        : imagePath.startsWith("/")
        ? imagePath.substring(1)
        : imagePath;

      const fullFilePath = path.join(__dirname, "..", "public", relativePath);

      if (fs.existsSync(fullFilePath)) {
        fs.unlinkSync(fullFilePath);
      }
    }

    // Delete the scheme
    await Scheme.findByIdAndDelete(_id);

    res.status(200).json({
      message: "Scheme deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting scheme:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid scheme ID",
      });
    }
    res.status(500).json({
      error: "Failed to delete scheme",
      message: error.message,
    });
  }
});

// PUT /api/schemes/:id/approve - Approve a scheme
// Department Head, Department Secretary, Admin, or Super Admin can approve
router.put("/:id/approve", adminAuth, requireRole([
  AdminUser.ROLES.SUPER_ADMIN,
  AdminUser.ROLES.ADMIN,
  AdminUser.ROLES.DISTRICTHQ_HEAD,
  AdminUser.ROLES.DISTRICT_OVERLOOKERS,
]), async (req, res) => {
  try {
    const schemeId = req.params.id;
    const admin = req.admin; // Set by adminAuth middleware

    // Find the scheme
    const scheme = await Scheme.findById(schemeId);

    if (!scheme) {
      return res.status(404).json({
        status: "error",
        error: "Scheme not found",
      });
    }

    // Check if scheme is already approved
    if (scheme.approval_status === "approved") {
      return res.status(400).json({
        status: "error",
        error: "Scheme is already approved",
      });
    }

    // Check if scheme is rejected (can't approve a rejected scheme)
    if (scheme.approval_status === "rejected") {
      return res.status(400).json({
        status: "error",
        error: "Cannot approve a rejected scheme",
      });
    }

    // Update scheme approval status
    scheme.approval_status = "approved";
    scheme.department_head_approval = {
      approved_by: admin._id,
      approved_by_username: admin.username,
      approved_at: new Date(),
      rejection_reason: null,
    };

    await scheme.save();

    res.status(200).json({
      status: "success",
      message: "Scheme approved successfully",
      scheme: scheme,
    });
  } catch (error) {
    console.error("Error approving scheme:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        error: "Invalid scheme ID",
      });
    }
    res.status(500).json({
      status: "error",
      error: "Failed to approve scheme",
      message: error.message,
    });
  }
});

// PUT /api/schemes/:id/reject - Reject a scheme
// Department Head, Department Secretary, Admin, or Super Admin can reject
router.put("/:id/reject", adminAuth, requireRole([
  AdminUser.ROLES.SUPER_ADMIN,
  AdminUser.ROLES.ADMIN,
  AdminUser.ROLES.DISTRICTHQ_HEAD,
  AdminUser.ROLES.DISTRICT_OVERLOOKERS,
]), async (req, res) => {
  try {
    const schemeId = req.params.id;
    const admin = req.admin; // Set by adminAuth middleware
    const { rejection_reason } = req.body;

    // Find the scheme
    const scheme = await Scheme.findById(schemeId);

    if (!scheme) {
      return res.status(404).json({
        status: "error",
        error: "Scheme not found",
      });
    }

    // Check if scheme is already rejected
    if (scheme.approval_status === "rejected") {
      return res.status(400).json({
        status: "error",
        error: "Scheme is already rejected",
      });
    }

    // Check if scheme is already approved (can't reject an approved scheme)
    if (scheme.approval_status === "approved") {
      return res.status(400).json({
        status: "error",
        error: "Cannot reject an approved scheme",
      });
    }

    // Update scheme approval status
    scheme.approval_status = "rejected";
    scheme.department_head_approval = {
      approved_by: admin._id,
      approved_by_username: admin.username,
      approved_at: new Date(),
      rejection_reason: rejection_reason || "Rejected by admin",
    };

    await scheme.save();

    res.status(200).json({
      status: "success",
      message: "Scheme rejected successfully",
      scheme: scheme,
    });
  } catch (error) {
    console.error("Error rejecting scheme:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        error: "Invalid scheme ID",
      });
    }
    res.status(500).json({
      status: "error",
      error: "Failed to reject scheme",
      message: error.message,
    });
  }
});

// DELETE /api/schemes/:id - Delete a scheme
router.delete("/:id", async (req, res) => {
  try {
    const scheme = await Scheme.findById(req.params.id);

    if (!scheme) {
      return res.status(404).json({
        error: "Scheme not found",
      });
    }

    // Delete associated image file if it exists
    if (scheme.scheme_image_file_url) {
      const imagePath = scheme.scheme_image_file_url;
      const relativePath = imagePath.startsWith("public")
        ? imagePath.substring(7)
        : imagePath.startsWith("/")
        ? imagePath.substring(1)
        : imagePath;

      const fullFilePath = path.join(__dirname, "..", "public", relativePath);

      if (fs.existsSync(fullFilePath)) {
        fs.unlinkSync(fullFilePath);
      }
    }

    // Delete the scheme
    await Scheme.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: "Scheme deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting scheme:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid scheme ID",
      });
    }
    res.status(500).json({
      error: "Failed to delete scheme",
      message: error.message,
    });
  }
});

module.exports = router;
