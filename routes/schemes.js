const express = require("express");
const router = express.Router();
const Scheme = require("../models/Scheme");
const Application = require("../models/Application");
const PublicUser = require("../models/PublicUser");
const AdminUser = require("../models/AdminUser");
const { checkEligibility, hasAppliedToExcludedSchemes } = require("../utils/eligibilityUtils");
const adminAuth = require("../middleware/adminAuth");
const requireRole = require("../middleware/requireRole");
const path = require("path");
const fs = require("fs");

// GET /api/schemes - Get all schemes
// Optional query params: 
//   - filter_type: "scheme" or "applicant" (default: "applicant" if user_id is provided, otherwise "scheme")
//   - user_id: Filter based on excluded schemes (applicant filter - only works with filter_type="applicant")
//   - approved_only: Only return approved schemes (scheme filter - only works with filter_type="scheme")
//   - pending_approval: Return schemes pending approval AND approved schemes (scheme filter - only works with filter_type="scheme")
router.get("/", async (req, res) => {
  try {
    const { user_id, approved_only, pending_approval, filter_type } = req.query;
    
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
    
    let schemes = await Scheme.find(query).sort({ createdAt: -1 });

    // Applicant filters (only apply if filter_type is "applicant")
    // Note: We return all schemes but add eligibility information for frontend to gray out ineligible ones
    if (filterType === "applicant" && user_id) {
      const user = await PublicUser.findById(user_id);
      if (user) {
        const schemesWithEligibility = [];
        
        for (const scheme of schemes) {
          // Check eligibility for this scheme
          const eligibility = await checkEligibility(user, scheme, user_id);
          
          // Convert scheme to plain object to add eligibility field
          const schemeObj = scheme.toObject ? scheme.toObject() : scheme;
          
          // Add eligibility information to each scheme
          schemeObj.isEligible = eligibility.eligible;
          if (!eligibility.eligible) {
            schemeObj.eligibilityReason = eligibility.reason || "Not eligible";
          }
          
          schemesWithEligibility.push(schemeObj);
        }
        
        schemes = schemesWithEligibility;
      }
    }

    res.status(200).json(schemes);
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

// POST /api/schemes - Create a new scheme
router.post("/", async (req, res) => {
  try {
    const schemeData = req.body;

    // Create new scheme
    const scheme = await Scheme.create(schemeData);

    res.status(200).json(scheme);
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
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        existingScheme[key] = updateData[key];
      }
    });

    // Save the scheme (this will trigger pre-save hooks and validators)
    const scheme = await existingScheme.save();

    res.status(200).json({
      status: "success",
      message: "Scheme updated successfully",
      scheme: scheme,
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
// Only Department Head, Department Secretary, or Super Admin can approve
router.put("/:id/approve", adminAuth, requireRole([
  AdminUser.ROLES.DEPARTMENT_HEAD,
  AdminUser.ROLES.DEPARTMENT_SECRETARY,
  AdminUser.ROLES.SUPER_ADMIN
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
// Only Department Head, Department Secretary, or Super Admin can reject
router.put("/:id/reject", adminAuth, requireRole([
  AdminUser.ROLES.DEPARTMENT_HEAD,
  AdminUser.ROLES.DEPARTMENT_SECRETARY,
  AdminUser.ROLES.SUPER_ADMIN
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
