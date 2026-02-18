const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const router = express.Router();

const adminAuth = require("../middleware/adminAuth");
const requireRole = require("../middleware/requireRole");
const AdminUser = require("../models/AdminUser");
const PublicUser = require("../models/PublicUser");
const Application = require("../models/Application");
const Scheme = require("../models/Scheme");
const ApplicationModel = require("../models/Application");
const { hasAppliedToExcludedSchemes } = require("../utils/eligibilityUtils");

// Ensure temp directory exists
const tempDir = path.join(__dirname, "..", "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer for temporary file storage
const upload = multer({
  dest: tempDir, // Temporary folder for uploaded files
  fileFilter: (req, file, cb) => {
    // Accept only Excel and CSV files
    const allowedMimes = [
      "application/vnd.ms-excel", // .xls
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "text/csv", // .csv
      "application/vnd.ms-excel.sheet.macroEnabled.12", // .xlsm
    ];
    
    const fileExt = path.extname(file.originalname).toLowerCase();
    const allowedExts = [".xls", ".xlsx", ".csv"];

    if (
      allowedMimes.includes(file.mimetype) ||
      allowedExts.includes(fileExt)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only Excel (.xls, .xlsx) and CSV (.csv) files are allowed."
        ),
        false
      );
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * Helper function to parse Excel/CSV file
 */
function parseFile(filePath, fileExtension) {
  let workbook;
  
  if (fileExtension === ".csv") {
    workbook = xlsx.readFile(filePath, { type: "file" });
  } else {
    workbook = xlsx.readFile(filePath);
  }

  // Get the first sheet
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON
  const data = xlsx.utils.sheet_to_json(worksheet, { raw: false });

  return data;
}

/**
 * Helper function to normalize column names (handle variations)
 */
function normalizeColumnName(column) {
  if (!column) return "";
  
  const lower = column.toLowerCase().trim();
  
  // Aadhaar variations
  if (lower.includes("aadhaar") || lower.includes("aadhar") || lower.includes("uid")) {
    return "aadhaarNumber";
  }
  
  // Name variations
  if (lower.includes("name") && (lower.includes("full") || lower.includes("complete"))) {
    return "fullName";
  }
  
  // Date of Birth variations
  if (lower.includes("dob") || lower.includes("date of birth") || lower.includes("birth date")) {
    return "dob";
  }
  
  // Gender
  if (lower.includes("gender") || lower.includes("sex")) {
    return "gender";
  }
  
  // Address fields
  if (lower.includes("street") || lower.includes("address line 1")) {
    return "street";
  }
  if (lower.includes("locality") || lower.includes("village") || lower.includes("town")) {
    return "locality";
  }
  if (lower.includes("district")) {
    return "district";
  }
  if (lower.includes("state")) {
    return "state";
  }
  if (lower.includes("pincode") || lower.includes("pin code") || lower.includes("postal code")) {
    return "pincode";
  }
  
  // Contact
  if (lower.includes("mobile") || lower.includes("phone") || lower.includes("contact")) {
    return "mobile";
  }
  if (lower.includes("email") || lower.includes("e-mail")) {
    return "email";
  }
  
  return lower.replace(/\s+/g, "");
}

/**
 * Helper function to map Excel row to PublicUser structure
 */
function mapRowToUser(row) {
  const normalizedRow = {};
  
  // Normalize all column names
  Object.keys(row).forEach((key) => {
    const normalizedKey = normalizeColumnName(key);
    normalizedRow[normalizedKey] = row[key];
  });

  // Extract and validate Aadhaar
  const aadhaarNumber = String(normalizedRow.aadhaarNumber || "").trim().replace(/\s+/g, "");
  if (!aadhaarNumber || !/^\d{12}$/.test(aadhaarNumber)) {
    return { error: "Invalid Aadhaar number (must be 12 digits)", row };
  }

  // Extract full name
  const fullName = String(normalizedRow.fullName || "").trim();
  if (!fullName) {
    return { error: "Full name is required", row };
  }

  // Extract and parse date of birth
  let dob;
  const dobStr = String(normalizedRow.dob || "").trim();
  if (dobStr) {
    // Try to parse various date formats
    const parsedDate = new Date(dobStr);
    if (isNaN(parsedDate.getTime())) {
      return { error: "Invalid date of birth format", row };
    }
    dob = parsedDate;
  } else {
    return { error: "Date of birth is required", row };
  }

  // Extract and validate gender
  const genderStr = String(normalizedRow.gender || "").trim().toUpperCase();
  let gender = "O"; // Default to Other
  if (genderStr === "M" || genderStr === "MALE" || genderStr === "म" || genderStr === "पुरुष") {
    gender = "M";
  } else if (genderStr === "F" || genderStr === "FEMALE" || genderStr === "महिला") {
    gender = "F";
  }

  // Extract address
  const street = String(normalizedRow.street || "").trim();
  const locality = String(normalizedRow.locality || "").trim();
  const district = String(normalizedRow.district || "").trim();
  const state = String(normalizedRow.state || "").trim();
  const pincode = String(normalizedRow.pincode || "").trim().replace(/\s+/g, "");

  if (!locality || !district || !state || !pincode) {
    return { error: "Address fields (locality, district, state, pincode) are required", row };
  }

  if (!/^\d{6}$/.test(pincode)) {
    return { error: "Invalid pincode (must be 6 digits)", row };
  }

  // Extract contact
  const mobile = String(normalizedRow.mobile || "").trim().replace(/\s+/g, "");
  const email = String(normalizedRow.email || "").trim().toLowerCase();

  if (!mobile) {
    return { error: "Mobile number is required", row };
  }

  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    return { error: "Invalid email format", row };
  }

  // Generate Aadhaar hash (simple hash for demo, use proper encryption in production)
  const aadhaarHash = crypto
    .createHash("sha256")
    .update(aadhaarNumber)
    .digest("hex");

  return {
    aadhaarNumber,
    aadhaarHash,
    demographics: {
      fullName,
      dob: {
        date: dob,
        verified: true,
      },
      gender,
      photo: {
        stored: false,
        photoId: null,
      },
    },
    address: {
      careOf: "",
      house: "",
      street,
      locality,
      district,
      state,
      pincode,
      country: "India",
    },
    contact: {
      mobile: {
        value: mobile,
        verified: false,
      },
      email: email
        ? {
            value: email,
            verified: false,
          }
        : {
            value: `${aadhaarNumber}@temp.welfare.gov`, // Placeholder email
            verified: false,
          },
    },
    biometrics: {
      fingerprints: { stored: false, encryptedRef: null },
      iris: { stored: false, encryptedRef: null },
      face: { stored: false, encryptedRef: null },
    },
    status: {
      isActive: true,
      isDeactivated: false,
      reason: null,
    },
    kycLevel: "BASIC",
    audit: {
      createdAt: new Date(),
      lastUpdated: new Date(),
      updateCount: 0,
    },
    authentication: {
      lastAuthAt: null,
      authMethodsUsed: [],
    },
  };
}

/**
 * Helper function to find or create user
 */
async function findOrCreateUser(userData, streetForMatching) {
  try {
    // First, try to find by Aadhaar
    let user = await PublicUser.findOne({ aadhaarNumber: userData.aadhaarNumber });

    if (user) {
      // User exists - update if needed
      // You can add update logic here if needed
      return { user, isNew: false };
    }

    // Try to find by street address if provided
    if (streetForMatching) {
      user = await PublicUser.findOne({
        "address.street": streetForMatching,
        "demographics.fullName": userData.demographics.fullName,
      });

      if (user) {
        // Update Aadhaar if not set
        if (!user.aadhaarNumber) {
          user.aadhaarNumber = userData.aadhaarNumber;
          user.aadhaarHash = userData.aadhaarHash;
          await user.save();
        }
        return { user, isNew: false };
      }
    }

    // Create new user
    user = new PublicUser(userData);
    await user.save();
    return { user, isNew: true };
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error - try to find existing user
      const existingUser = await PublicUser.findOne({ aadhaarNumber: userData.aadhaarNumber });
      if (existingUser) {
        return { user: existingUser, isNew: false };
      }
    }
    throw error;
  }
}

/**
 * POST /api/bulk-upload/preview
 * Upload file, parse it, and return preview data
 */
router.post(
  "/preview",
  adminAuth,
  requireRole([
    AdminUser.ROLES.SUPER_ADMIN,
    AdminUser.ROLES.ADMIN,
    AdminUser.ROLES.DEPARTMENT_HEAD,
    AdminUser.ROLES.DEPARTMENT_SECRETARY,
  ]),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: "error",
          message: "No file uploaded",
        });
      }

      // Get scheme_id and department from request body
      const { scheme_id, department } = req.body;

      if (!scheme_id) {
        // Clean up file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          status: "error",
          message: "Scheme ID is required",
        });
      }

      // Verify scheme exists
      const scheme = await Scheme.findById(scheme_id);
      if (!scheme) {
        // Clean up file
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          status: "error",
          message: "Scheme not found",
        });
      }

      // Verify department matches (optional check)
      if (department && scheme.department !== department) {
        // Clean up file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          status: "error",
          message: "Department mismatch",
        });
      }

      // Parse the file
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      let parsedData;

      try {
        parsedData = parseFile(req.file.path, fileExtension);
      } catch (parseError) {
        // Clean up file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          status: "error",
          message: "Failed to parse file",
          error: parseError.message,
        });
      }

      if (!parsedData || parsedData.length === 0) {
        // Clean up file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          status: "error",
          message: "File is empty or contains no data",
        });
      }

      // Map rows to user structure and validate
      const mappedData = [];
      const errors = [];
      const redundancies = [];
      const aadhaarTracker = new Map(); // Track Aadhaar numbers within the file

      for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];
        const rowNumber = i + 2; // +2 because Excel rows start at 1, and header is row 1

        const mapped = mapRowToUser(row);
        
        if (mapped.error) {
          errors.push({
            row: rowNumber,
            error: mapped.error,
            data: mapped.row,
          });
        } else {
          const aadhaarNumber = mapped.aadhaarNumber;
          
          // Check for duplicate Aadhaar within the same file (redundancy check)
          if (aadhaarTracker.has(aadhaarNumber)) {
            const firstOccurrence = aadhaarTracker.get(aadhaarNumber);
            redundancies.push({
              row: rowNumber,
              aadhaarNumber: aadhaarNumber,
              fullName: mapped.demographics.fullName,
              error: `Duplicate entry: This Aadhaar number already appears in row ${firstOccurrence.row}. A user cannot avail the same scheme twice.`,
              type: "duplicate_in_file",
            });
            continue; // Skip this row
          }

          // Track this Aadhaar number
          aadhaarTracker.set(aadhaarNumber, { row: rowNumber, fullName: mapped.demographics.fullName });

          // Check if user already has an application for this scheme in database
          const existingUser = await PublicUser.findOne({
            aadhaarNumber: aadhaarNumber,
          });

          let existingApplication = null;
          if (existingUser) {
            existingApplication = await Application.findOne({
              user_id: existingUser._id,
              scheme_id: scheme_id,
            });

            // Check if user has applied to excluded schemes (scheme conflict check)
            if (scheme.excluded_schemes && scheme.excluded_schemes.length > 0) {
              const excludedCheck = await hasAppliedToExcludedSchemes(
                existingUser._id,
                scheme.excluded_schemes
              );

              if (excludedCheck.hasApplied) {
                // Get scheme names for better error message
                const excludedSchemeNames = await Scheme.find({
                  _id: { $in: excludedCheck.appliedSchemeIds },
                }).select("scheme_name");

                redundancies.push({
                  row: rowNumber,
                  aadhaarNumber: aadhaarNumber,
                  fullName: mapped.demographics.fullName,
                  error: `Scheme conflict: This user is already enrolled in incompatible scheme(s): ${excludedSchemeNames.map(s => s.scheme_name).join(", ")}. Cannot avail this scheme.`,
                  type: "excluded_scheme_conflict",
                  conflictingSchemes: excludedSchemeNames.map(s => ({
                    _id: s._id,
                    scheme_name: s.scheme_name,
                  })),
                });
                continue; // Skip this row
              }
            }
          }

          // If application already exists in database, flag as redundancy
          if (existingApplication) {
            redundancies.push({
              row: rowNumber,
              aadhaarNumber: aadhaarNumber,
              fullName: mapped.demographics.fullName,
              error: `Redundancy detected: This user (Aadhaar: ${aadhaarNumber.substring(0, 4)}-XXXX-${aadhaarNumber.substring(8)}) already has an application for this scheme in the database.`,
              type: "existing_application",
              existingApplicationId: existingApplication._id,
            });
            continue; // Skip this row
          }

          mappedData.push({
            row: rowNumber,
            userData: mapped,
            hasExistingUser: !!existingUser,
            hasExistingApplication: false, // We already filtered these out
          });
        }
      }

      // Store parsed data temporarily (using file path as identifier)
      // In production, you might want to use Redis or a database for this
      const previewId = `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Keep the file for confirmation phase
      // In production, move to a temporary storage with TTL

      res.status(200).json({
        status: "success",
        preview_id: previewId,
        file_path: req.file.path, // Store for confirmation phase
        scheme: {
          _id: scheme._id,
          scheme_name: scheme.scheme_name,
          department: scheme.department,
        },
        total_rows: parsedData.length,
        valid_rows: mappedData.length,
        error_rows: errors.length,
        redundancy_rows: redundancies.length,
        preview_data: mappedData.slice(0, 10), // First 10 rows as preview
        errors: errors.slice(0, 10), // First 10 errors as preview
        redundancies: redundancies.slice(0, 10), // First 10 redundancies as preview
        message: `Parsed ${parsedData.length} rows. ${mappedData.length} valid, ${errors.length} with errors, ${redundancies.length} redundancies detected.`,
        warnings: redundancies.length > 0 ? [
          `⚠️ ${redundancies.length} redundancy(ies) detected. These entries will be skipped during import.`,
          "A user cannot avail the same scheme twice (duplicate entries in file or existing application in database)."
        ] : [],
      });
    } catch (error) {
      console.error("Preview upload error:", error);
      
      // Clean up file if it exists
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        status: "error",
        message: "Failed to process file",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

/**
 * POST /api/bulk-upload/confirm
 * Confirm and save the bulk upload data to database
 */
router.post(
  "/confirm",
  adminAuth,
  requireRole([
    AdminUser.ROLES.SUPER_ADMIN,
    AdminUser.ROLES.ADMIN,
    AdminUser.ROLES.DEPARTMENT_HEAD,
    AdminUser.ROLES.DEPARTMENT_SECRETARY,
  ]),
  async (req, res) => {
    try {
      const { file_path, scheme_id, department } = req.body;

      if (!file_path || !scheme_id) {
        return res.status(400).json({
          status: "error",
          message: "File path and scheme ID are required",
        });
      }

      // Verify file exists
      if (!fs.existsSync(file_path)) {
        return res.status(404).json({
          status: "error",
          message: "File not found. Please upload again.",
        });
      }

      // Verify scheme exists
      const scheme = await Scheme.findById(scheme_id);
      if (!scheme) {
        return res.status(404).json({
          status: "error",
          message: "Scheme not found",
        });
      }

      // Verify department matches (optional check)
      if (department && scheme.department !== department) {
        return res.status(400).json({
          status: "error",
          message: "Department mismatch",
        });
      }

      // Parse the file again
      const fileExtension = path.extname(file_path).toLowerCase();
      const parsedData = parseFile(file_path, fileExtension);

      if (!parsedData || parsedData.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "File is empty or contains no data",
        });
      }

      // Get authorization levels from scheme
      // Note: Bulk uploaded beneficiaries are already approved, so we store the workflow but set status to "Approved"
      const authorizationLevels = scheme.authorization_levels || [];

      // Process all rows
      const results = {
        total: parsedData.length,
        success: 0,
        skipped: 0,
        errors: [],
        redundancies: [],
        created_users: 0,
        created_applications: 0,
        updated_users: 0,
      };

      // Track Aadhaar numbers within the file to detect duplicates
      const aadhaarTracker = new Map();

      for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];
        const rowNumber = i + 2; // +2 because Excel rows start at 1, and header is row 1

        try {
          // Map row to user structure
          const mapped = mapRowToUser(row);
          
          if (mapped.error) {
            results.errors.push({
              row: rowNumber,
              error: mapped.error,
            });
            results.skipped++;
            continue;
          }

          const aadhaarNumber = mapped.aadhaarNumber;

          // Check for duplicate Aadhaar within the same file (redundancy check)
          if (aadhaarTracker.has(aadhaarNumber)) {
            const firstOccurrence = aadhaarTracker.get(aadhaarNumber);
            results.redundancies.push({
              row: rowNumber,
              aadhaarNumber: aadhaarNumber,
              fullName: mapped.demographics.fullName,
              error: `Duplicate entry: This Aadhaar number already appears in row ${firstOccurrence.row}. A user cannot avail the same scheme twice.`,
              type: "duplicate_in_file",
            });
            results.skipped++;
            continue;
          }

          // Track this Aadhaar number
          aadhaarTracker.set(aadhaarNumber, { row: rowNumber, fullName: mapped.demographics.fullName });

          // Find or create user
          const { user, isNew } = await findOrCreateUser(mapped, mapped.address.street);
          
          if (isNew) {
            results.created_users++;
          } else {
            results.updated_users++;
          }

          // Check if user has applied to excluded schemes (scheme conflict check)
          if (scheme.excluded_schemes && scheme.excluded_schemes.length > 0) {
            const excludedCheck = await hasAppliedToExcludedSchemes(
              user._id,
              scheme.excluded_schemes
            );

            if (excludedCheck.hasApplied) {
              // Get scheme names for better error message
              const excludedSchemeNames = await Scheme.find({
                _id: { $in: excludedCheck.appliedSchemeIds },
              }).select("scheme_name");

              results.redundancies.push({
                row: rowNumber,
                aadhaarNumber: aadhaarNumber,
                fullName: mapped.demographics.fullName,
                error: `Scheme conflict: This user is already enrolled in incompatible scheme(s): ${excludedSchemeNames.map(s => s.scheme_name).join(", ")}. Cannot avail this scheme.`,
                type: "excluded_scheme_conflict",
                conflictingSchemes: excludedSchemeNames.map(s => ({
                  _id: s._id,
                  scheme_name: s.scheme_name,
                })),
              });
              results.skipped++;
              continue;
            }
          }

          // Check if application already exists in database (redundancy check)
          const existingApplication = await Application.findOne({
            user_id: user._id,
            scheme_id: scheme_id,
          });

          if (existingApplication) {
            results.redundancies.push({
              row: rowNumber,
              aadhaarNumber: aadhaarNumber,
              fullName: mapped.demographics.fullName,
              error: `Redundancy detected: This user (Aadhaar: ${aadhaarNumber.substring(0, 4)}-XXXX-${aadhaarNumber.substring(8)}) already has an application for this scheme in the database.`,
              type: "existing_application",
              existingApplicationId: existingApplication._id,
            });
            results.skipped++;
            continue;
          }

          // Create application
          // Bulk uploaded beneficiaries are already availing the scheme, so set status to "Approved" and verification level to 99 (Completed)
          await Application.create({
            user_id: user._id,
            scheme_id: scheme_id,
            status: "Approved",
            verification_level: 99, // Completed - these are existing beneficiaries
            verification_stage: ApplicationModel.getStageNameFromLevel(99), // "Completed"
            authorization_levels: authorizationLevels,
            authorization_level_index: authorizationLevels.length > 0 ? authorizationLevels.length - 1 : 0, // Set to last index since already approved
            form_data: {
              bulk_uploaded: true,
              uploaded_by: req.admin.username,
              uploaded_at: new Date(),
            },
            documents_submitted: [],
            date_applied: new Date(),
          });

          results.created_applications++;
          results.success++;
        } catch (error) {
          console.error(`Error processing row ${rowNumber}:`, error);
          results.errors.push({
            row: rowNumber,
            error: error.message || "Unknown error",
          });
          results.skipped++;
        }
      }

      // Clean up file after processing
      try {
        fs.unlinkSync(file_path);
      } catch (cleanupError) {
        console.error("Error cleaning up file:", cleanupError);
      }

      res.status(200).json({
        status: "success",
        message: "Bulk upload completed",
        results,
        warnings: results.redundancies.length > 0 ? [
          `⚠️ ${results.redundancies.length} redundancy(ies) detected and skipped.`,
          "A user cannot avail the same scheme twice (duplicate entries in file or existing application in database)."
        ] : [],
      });
    } catch (error) {
      console.error("Confirm upload error:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to confirm upload",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

module.exports = router;
