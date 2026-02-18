const express = require("express");
const router = express.Router();
const PublicUser = require("../models/PublicUser");
const publicUserAuth = require("../middleware/publicUserAuth");
const { getAccountStatusMessage } = require("../utils/publicUserMessages");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

/**
 * PUT /api/public-profile/update
 * Update user profile data
 * User identity: query params and/or body { userId }, { mobileNumber }
 */
router.put("/update", publicUserAuth, async (req, res) => {
  try {
    const user = req.publicUser;
    const {
      aadhaarNumber,
      fullName,
      dob,
      gender,
      email,
      careOf,
      house,
      street,
      locality,
      district,
      state,
      pincode,
      country,
    } = req.body;

    // Update demographics
    if (fullName !== undefined) {
      user.demographics.fullName = fullName.trim();
    }
    if (dob !== undefined) {
      user.demographics.dob.date = new Date(dob);
      user.demographics.dob.verified = false; // Reset verification when updated
    }
    if (gender !== undefined) {
      const upperGender = gender.toUpperCase();
      if (["M", "F", "O"].includes(upperGender)) {
        user.demographics.gender = upperGender;
      }
    }

    // Update Aadhaar number
    if (aadhaarNumber !== undefined) {
      // Validate Aadhaar format
      if (!/^\d{12}$/.test(aadhaarNumber)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid Aadhaar number. It must be a 12-digit number.",
        });
      }

      // Check if Aadhaar is already used by another user
      const existingUser = await PublicUser.findOne({
        aadhaarNumber: aadhaarNumber.trim(),
        _id: { $ne: user._id },
      });

      if (existingUser) {
        return res.status(400).json({
          status: "error",
          message: "Aadhaar number is already registered with another account.",
        });
      }

      user.aadhaarNumber = aadhaarNumber.trim();
      user.aadhaarHash = crypto.createHash("md5").update(aadhaarNumber.trim()).digest("hex");
    }

    // Update email
    if (email !== undefined) {
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid email format.",
        });
      }
      user.contact.email.value = email.trim().toLowerCase();
      user.contact.email.verified = false; // Reset verification when updated
    }

    // Update address
    if (careOf !== undefined) user.address.careOf = careOf.trim();
    if (house !== undefined) user.address.house = house.trim();
    if (street !== undefined) user.address.street = street.trim();
    if (locality !== undefined) user.address.locality = locality.trim();
    if (district !== undefined) user.address.district = district.trim();
    if (state !== undefined) user.address.state = state.trim();
    if (pincode !== undefined) {
      if (!/^\d{6}$/.test(pincode)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid pincode. It must be a 6-digit number.",
        });
      }
      user.address.pincode = pincode.trim();
    }
    if (country !== undefined) user.address.country = country.trim() || "India";

    // Update audit fields
    user.audit.lastUpdated = new Date();
    user.audit.updateCount = (user.audit.updateCount || 0) + 1;

    // Determine KYC level based on filled data
    let kycLevel = "BASIC";
    if (
      user.aadhaarNumber &&
      user.demographics.fullName &&
      user.demographics.dob?.date &&
      user.demographics.gender &&
      user.address.locality &&
      user.address.district &&
      user.address.state &&
      user.address.pincode
    ) {
      kycLevel = "FULL";
    } else if (
      user.demographics.fullName &&
      (user.demographics.dob?.date || user.demographics.gender || user.address.locality)
    ) {
      kycLevel = "PARTIAL";
    }
    user.kycLevel = kycLevel;

    // Set verification status to "pending" after profile completion
    // User needs to be bio-authenticated by CSDAdmin before verification
    // Only set to pending if not already verified or rejected
    if (user.status.verificationStatus === "pending" || !user.status.verificationStatus) {
      user.status.verificationStatus = "pending";
    }
    // If user updates profile after being verified/rejected, reset to pending
    // (unless they're just updating minor details - you can add logic here)
    // For now, we'll keep it simple: if status was verified/rejected and user updates,
    // it stays as is (CSDAdmin will need to re-verify if needed)

    await user.save();

    // Return updated user data
    const responseUser = {
      _id: user._id,
      userId: user._id,
      fullName: user.demographics?.fullName || null,
      contactEmail: user.contact?.email?.value || null,
      phoneNumber: user.contact?.mobile?.value || null,
      address: user.address || null,
      dob: user.demographics?.dob?.date || null,
      aadhaarNumber: user.aadhaarNumber || null,
      gender: user.demographics?.gender || null,
      kycLevel: user.kycLevel,
      documents: user.documents || null,
      verificationStatus: user.status?.verificationStatus || "pending",
      accountStatusMessage: getAccountStatusMessage(user.status?.verificationStatus),
    };

    return res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      user: responseUser,
    });
  } catch (error) {
    console.error("Profile update error:", error);

    // Handle duplicate key error (Aadhaar)
    if (error.code === 11000) {
      return res.status(400).json({
        status: "error",
        message: "Aadhaar number is already registered with another account.",
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

/**
 * POST /api/public-profile/submit-complete
 * Submit profile data + all documents in one request (one form submit).
 * User identity: query params { userId }, { mobileNumber }
 *
 * FormData:
 * - Profile: fullName, dob, gender, email, aadhaarNumber, careOf, house, street, locality, district, state, pincode, country
 * - Files (optional): aadhaarCard, birthCertificate, certificateOfIdentification
 */
const storageSubmitComplete = multer.diskStorage({
  destination: (req, file, cb) => {
    const folderPath = path.join(__dirname, "..", "public", "uploads", "public-user-documents");
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    cb(null, folderPath);
  },
  filename: (req, file, cb) => {
    const userId = req.userId || "unknown";
    const documentType = file.fieldname;
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname);
    cb(null, `${userId}_${documentType}_${uniqueSuffix}${fileExtension}`);
  },
});

const uploadSubmitComplete = multer({
  storage: storageSubmitComplete,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, WebP and PDF allowed."), false);
    }
  },
});

function applyProfileUpdates(user, body) {
  const {
    aadhaarNumber,
    fullName,
    dob,
    gender,
    email,
    careOf,
    house,
    street,
    locality,
    district,
    state,
    pincode,
    country,
  } = body;

  if (fullName !== undefined && fullName !== "") {
    user.demographics.fullName = String(fullName).trim();
  }
  if (dob !== undefined && dob !== "") {
    user.demographics.dob.date = new Date(dob);
    user.demographics.dob.verified = false;
  }
  if (gender !== undefined && gender !== "") {
    const upperGender = String(gender).toUpperCase();
    if (["M", "F", "O"].includes(upperGender)) {
      user.demographics.gender = upperGender;
    }
  }
  if (aadhaarNumber !== undefined && aadhaarNumber !== "") {
    const num = String(aadhaarNumber).trim();
    if (/^\d{12}$/.test(num)) {
      user.aadhaarNumber = num;
      user.aadhaarHash = crypto.createHash("md5").update(num).digest("hex");
    }
  }
  if (email !== undefined && email !== "") {
    const val = String(email).trim().toLowerCase();
    if (/^\S+@\S+\.\S+$/.test(val)) {
      user.contact.email.value = val;
      user.contact.email.verified = false;
    }
  }
  if (careOf !== undefined) user.address.careOf = String(careOf).trim();
  if (house !== undefined) user.address.house = String(house).trim();
  if (street !== undefined) user.address.street = String(street).trim();
  if (locality !== undefined) user.address.locality = String(locality).trim();
  if (district !== undefined) user.address.district = String(district).trim();
  if (state !== undefined) user.address.state = String(state).trim();
  if (pincode !== undefined && pincode !== "" && /^\d{6}$/.test(String(pincode))) {
    user.address.pincode = String(pincode).trim();
  }
  if (country !== undefined) user.address.country = String(country).trim() || "India";
}

function computeKycLevel(user) {
  if (
    user.aadhaarNumber &&
    user.demographics?.fullName &&
    user.demographics?.dob?.date &&
    user.demographics?.gender &&
    user.address?.locality &&
    user.address?.district &&
    user.address?.state &&
    user.address?.pincode
  ) {
    return "FULL";
  }
  if (
    user.demographics?.fullName &&
    (user.demographics?.dob?.date || user.demographics?.gender || user.address?.locality)
  ) {
    return "PARTIAL";
  }
  return "BASIC";
}

router.post(
  "/submit-complete",
  publicUserAuth,
  uploadSubmitComplete.fields([
    { name: "aadhaarCard", maxCount: 1 },
    { name: "birthCertificate", maxCount: 1 },
    { name: "certificateOfIdentification", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const user = req.publicUser;
      const body = req.body || {};

      // Aadhaar uniqueness check if provided
      const aadhaarNumber = body.aadhaarNumber != null ? String(body.aadhaarNumber).trim() : "";
      if (aadhaarNumber && /^\d{12}$/.test(aadhaarNumber)) {
        const existing = await PublicUser.findOne({
          aadhaarNumber,
          _id: { $ne: user._id },
        });
        if (existing) {
          return res.status(400).json({
            status: "error",
            message: "Aadhaar number is already registered with another account.",
          });
        }
      }

      applyProfileUpdates(user, body);

      const files = req.files || {};
      const documentTypes = ["aadhaarCard", "birthCertificate", "certificateOfIdentification"];

      for (const docType of documentTypes) {
        if (files[docType] && files[docType][0]) {
          const file = files[docType][0];
          const oldDoc = user.documents[docType];
          if (oldDoc?.filePath) {
            const oldPath = path.join(__dirname, "..", "public", oldDoc.filePath);
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          }
          const relativePath = `/public/uploads/public-user-documents/${file.filename}`;
          user.documents[docType] = {
            filePath: relativePath,
            uploadedAt: new Date(),
            verified: false,
          };
        }
      }

      user.kycLevel = computeKycLevel(user);
      user.status.verificationStatus = user.status.verificationStatus || "pending";
      user.audit.lastUpdated = new Date();
      user.audit.updateCount = (user.audit.updateCount || 0) + 1;

      await user.save();

      const responseUser = {
        _id: user._id,
        userId: user._id,
        fullName: user.demographics?.fullName || null,
        contactEmail: user.contact?.email?.value || null,
        phoneNumber: user.contact?.mobile?.value || null,
        address: user.address || null,
        dob: user.demographics?.dob?.date || null,
        aadhaarNumber: user.aadhaarNumber || null,
        gender: user.demographics?.gender || null,
      kycLevel: user.kycLevel,
      documents: user.documents || null,
      verificationStatus: user.status?.verificationStatus || "pending",
      accountStatusMessage: getAccountStatusMessage(user.status?.verificationStatus),
    };

    return res.status(200).json({
      status: "success",
      message: "Profile and documents saved successfully",
      user: responseUser,
    });
  } catch (error) {
    console.error("Submit complete error:", error);
      if (req.files) {
        Object.values(req.files).forEach((arr) => {
          (arr || []).forEach((f) => {
            if (f.path && fs.existsSync(f.path)) {
              fs.unlinkSync(f.path);
            }
          });
        });
      }
      if (error.code === 11000) {
        return res.status(400).json({
          status: "error",
          message: "Aadhaar number is already registered with another account.",
        });
      }
      return res.status(500).json({
        status: "error",
        message: "Internal server error",
      });
    }
  }
);

/**
 * GET /api/public-profile
 * Get current user profile
 * User identity: query params { userId }, optionally { mobileNumber }
 */
router.get("/", publicUserAuth, async (req, res) => {
  try {
    const user = req.publicUser;

    const responseUser = {
      _id: user._id,
      userId: user._id,
      fullName: user.demographics?.fullName || null,
      contactEmail: user.contact?.email?.value || null,
      phoneNumber: user.contact?.mobile?.value || null,
      address: user.address || null,
      dob: user.demographics?.dob?.date || null,
      aadhaarNumber: user.aadhaarNumber || null,
      gender: user.demographics?.gender || null,
      kycLevel: user.kycLevel,
      documents: user.documents || null,
      verificationStatus: user.status?.verificationStatus || "pending",
      accountStatusMessage: getAccountStatusMessage(user.status?.verificationStatus),
    };

    return res.status(200).json({
      status: "success",
      user: responseUser,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folderName = "public-user-documents";
    const folderPath = path.join(__dirname, "..", "public", "uploads", folderName);

    // Create folder if it doesn't exist
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    cb(null, folderPath);
  },
  filename: (req, file, cb) => {
    const userId = req.userId || "unknown";
    const documentType = req.body.documentType || "document";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname);
    const newFileName = `${userId}_${documentType}_${uniqueSuffix}${fileExtension}`;

    cb(null, newFileName);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and PDFs
    const allowedMimes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, WebP images and PDF files are allowed."
        ),
        false
      );
    }
  },
});

/**
 * POST /api/public-profile/upload-document
 * Upload a document (Aadhaar Card, Birth Certificate, or Certificate of Identification)
 *
 * User identity: query params { userId }, { mobileNumber } (FormData body not parsed before auth)
 *
 * FormData Body:
 * - file: The document file
 * - documentType: aadhaarCard | birthCertificate | certificateOfIdentification
 * - userId, mobileNumber (optional in body; query params also accepted)
 */
router.post(
  "/upload-document",
  publicUserAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: "error",
          message: "No file uploaded.",
        });
      }

      const { documentType } = req.body;
      const user = req.publicUser;

      // Validate document type
      const validDocumentTypes = [
        "aadhaarCard",
        "birthCertificate",
        "certificateOfIdentification",
      ];
      if (!documentType || !validDocumentTypes.includes(documentType)) {
        // Delete uploaded file if document type is invalid
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          status: "error",
          message: `Invalid document type. Must be one of: ${validDocumentTypes.join(", ")}`,
        });
      }

      // Delete old file if exists
      const documentField = user.documents[documentType];
      if (documentField?.filePath) {
        const oldFilePath = path.join(
          __dirname,
          "..",
          "public",
          documentField.filePath
        );
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }

      // Update document path
      const relativePath = `/public/uploads/public-user-documents/${req.file.filename}`;
      user.documents[documentType] = {
        filePath: relativePath,
        uploadedAt: new Date(),
        verified: false, // Admin will verify later
      };

      // Update audit fields
      user.audit.lastUpdated = new Date();
      user.audit.updateCount = (user.audit.updateCount || 0) + 1;

      await user.save();

      // Return updated user data with documents
      const responseUser = {
        _id: user._id,
        userId: user._id,
        fullName: user.demographics?.fullName || null,
        contactEmail: user.contact?.email?.value || null,
        phoneNumber: user.contact?.mobile?.value || null,
        address: user.address || null,
        dob: user.demographics?.dob?.date || null,
        aadhaarNumber: user.aadhaarNumber || null,
        gender: user.demographics?.gender || null,
        kycLevel: user.kycLevel,
        verificationStatus: user.status?.verificationStatus || "pending",
        accountStatusMessage: getAccountStatusMessage(user.status?.verificationStatus),
        documents: user.documents || null,
      };

      return res.status(200).json({
        status: "success",
        message: "Document uploaded successfully",
        document: {
          type: documentType,
          filePath: relativePath,
          uploadedAt: user.documents[documentType].uploadedAt,
        },
        user: responseUser, // Include updated user data
      });
    } catch (error) {
      console.error("Document upload error:", error);

      // Delete file if error occurred
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(500).json({
        status: "error",
        message: "Internal server error",
      });
    }
  }
);

/**
 * POST /api/public-profile/upload-documents-batch
 * Upload multiple documents at once (Aadhaar Card, Birth Certificate, Certificate of Identification)
 *
 * User identity: query params { userId }, { mobileNumber }
 *
 * FormData Body:
 * - aadhaarCard: File (optional)
 * - birthCertificate: File (optional)
 * - certificateOfIdentification: File (optional)
 *
 * All files are optional - only upload the ones you want to update.
 */
router.post(
  "/upload-documents-batch",
  publicUserAuth,
  upload.fields([
    { name: "aadhaarCard", maxCount: 1 },
    { name: "birthCertificate", maxCount: 1 },
    { name: "certificateOfIdentification", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
    const user = req.publicUser;
    const files = req.files || {};
    const uploadedDocuments = [];
    const errors = [];

    // Process each document type
    const documentTypes = [
      "aadhaarCard",
      "birthCertificate",
      "certificateOfIdentification",
    ];

    for (const documentType of documentTypes) {
      if (files[documentType] && files[documentType][0]) {
        const file = files[documentType][0];

        try {
          // Delete old file if exists
          const documentField = user.documents[documentType];
          if (documentField?.filePath) {
            const oldFilePath = path.join(
              __dirname,
              "..",
              "public",
              documentField.filePath
            );
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
            }
          }

          // Update document path
          const relativePath = `/public/uploads/public-user-documents/${file.filename}`;
          user.documents[documentType] = {
            filePath: relativePath,
            uploadedAt: new Date(),
            verified: false, // Admin will verify later
          };

          uploadedDocuments.push({
            type: documentType,
            filePath: relativePath,
            uploadedAt: user.documents[documentType].uploadedAt,
          });
        } catch (error) {
          console.error(`Error processing ${documentType}:`, error);
          // Delete file if error occurred
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
          errors.push({
            type: documentType,
            error: error.message || "Failed to process document",
          });
        }
      }
    }

    // If no files were uploaded
    if (uploadedDocuments.length === 0 && Object.keys(files).length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No files uploaded. Please select at least one document to upload.",
      });
    }

    // Update audit fields
    if (uploadedDocuments.length > 0) {
      user.audit.lastUpdated = new Date();
      user.audit.updateCount = (user.audit.updateCount || 0) + 1;
      await user.save();
    }

    // Return updated user data with documents
    const responseUser = {
      _id: user._id,
      userId: user._id,
      fullName: user.demographics?.fullName || null,
      contactEmail: user.contact?.email?.value || null,
      phoneNumber: user.contact?.mobile?.value || null,
      address: user.address || null,
      dob: user.demographics?.dob?.date || null,
      aadhaarNumber: user.aadhaarNumber || null,
      gender: user.demographics?.gender || null,
      kycLevel: user.kycLevel,
      verificationStatus: user.status?.verificationStatus || "pending",
      accountStatusMessage: getAccountStatusMessage(user.status?.verificationStatus),
      documents: user.documents || null,
    };

    return res.status(200).json({
      status: "success",
      message: `${uploadedDocuments.length} document(s) uploaded successfully`,
      uploadedDocuments: uploadedDocuments,
      errors: errors.length > 0 ? errors : undefined,
      user: responseUser, // Include updated user data with documents
    });
  } catch (error) {
    console.error("Batch document upload error:", error);

    // Delete any uploaded files if error occurred
    if (req.files) {
      Object.values(req.files).forEach((fileArray) => {
        fileArray.forEach((file) => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
  }
);

/**
 * DELETE /api/public-profile/delete-document
 * Delete a document
 * User identity: query params and/or body { userId }, { mobileNumber }
 * Body: { documentType, userId (optional) }
 */
router.delete("/delete-document", publicUserAuth, async (req, res) => {
  try {
    const { documentType } = req.body;
    const user = req.publicUser;

    // Validate document type
    const validDocumentTypes = [
      "aadhaarCard",
      "birthCertificate",
      "certificateOfIdentification",
    ];
    if (!documentType || !validDocumentTypes.includes(documentType)) {
      return res.status(400).json({
        status: "error",
        message: `Invalid document type. Must be one of: ${validDocumentTypes.join(", ")}`,
      });
    }

    // Delete file from server
    const documentField = user.documents[documentType];
    if (documentField?.filePath) {
      const filePath = path.join(__dirname, "..", "public", documentField.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Clear document field
    user.documents[documentType] = {
      filePath: null,
      uploadedAt: null,
      verified: false,
    };

    // Update audit fields
    user.audit.lastUpdated = new Date();
    user.audit.updateCount = (user.audit.updateCount || 0) + 1;

    await user.save();

    return res.status(200).json({
      status: "success",
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Document delete error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

module.exports = router;
