const express = require("express");
const router = express.Router();
const PublicUser = require("../models/PublicUser");
const BeneficiaryPerson = require("../models/BeneficiaryPerson");
const Household = require("../models/Household");
const publicUserAuth = require("../middleware/publicUserAuth");
const {
  syncHouseholdFromPublicUser,
  syncPrimaryBeneficiaryFromPublicUser,
  addHouseholdFamilyMember,
  listHouseholdMembers,
  updateHouseholdMemberById,
  md5Hex,
} = require("../utils/householdService");
const {
  DOCUMENT_TYPES,
  applyBeneficiaryProfileFromBody,
  applyBeneficiaryDocumentsFromFiles,
  buildBeneficiaryApiUserPayload,
  loadActingBeneficiaryForRequest,
} = require("../utils/beneficiaryProfileService");

function publicUploadAbsPath(relativePath) {
  return path.join(__dirname, "..", "public", relativePath);
}
const { getCscVerificationMessage } = require("../utils/publicUserMessages");
const { buildKycFields } = require("../utils/kycStatus");
const { computeBeneficiaryKycLevel } = require("../utils/householdService");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

function buildPrimaryAccountUserPayload(user) {
  const kycLevel = computeBeneficiaryKycLevel(user);
  user.kycLevel = kycLevel;
  const cscVerificationStatus = user.status?.verificationStatus || "pending";
  return {
    _id: user._id,
    userId: user._id,
    beneficiaryPersonId: null,
    publicUserId: user._id,
    householdId: user.householdId || null,
    isPrimary: true,
    fullName: user.demographics?.fullName || null,
    contactEmail: user.contact?.email?.value || null,
    phoneNumber: user.contact?.mobile?.value || null,
    address: user.address || null,
    dob: user.demographics?.dob?.date || null,
    aadhaarNumber: user.aadhaarNumber || null,
    gender: user.demographics?.gender || null,
    familyDetails: user.familyDetails || [],
    documents: user.documents || null,
    ...buildKycFields(kycLevel, user),
    cscVerificationStatus,
    verificationStatus: cscVerificationStatus,
    accountStatusMessage: getCscVerificationMessage(cscVerificationStatus),
  };
}

function serializeHouseholdMember(p) {
  const kycLevel = computeBeneficiaryKycLevel(p);
  return {
    _id: p._id,
    householdId: p.householdId,
    isPrimary: p.isPrimary,
    relationToPrimary: p.relationToPrimary,
    aadhaarNumber: p.aadhaarNumber,
    demographics: p.demographics,
    address: p.address,
    contact: p.contact,
    ...buildKycFields(kycLevel, p),
  };
}

function rejectNonAccountHolderBeneficiary(beneficiaryPerson, res) {
  if (beneficiaryPerson && !beneficiaryPerson.isPrimary) {
    res.status(403).json({
      status: "error",
      message: "Only the account holder can manage household members.",
    });
    return true;
  }
  return false;
}

/**
 * GET /api/public-profile/household-members
 * List all BeneficiaryPerson records for the logged-in household (primary first).
 * Auth: same as other public-profile routes. Account holder only.
 */
router.get("/household-members", publicUserAuth, async (req, res) => {
  try {
    if (rejectNonAccountHolderBeneficiary(req.beneficiaryPerson, res)) return;

    const result = await listHouseholdMembers(req.publicUser);
    const members = (result.members || []).map(serializeHouseholdMember);

    return res.status(200).json({
      status: "success",
      members,
    });
  } catch (error) {
    console.error("List household members error:", error);
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

/**
 * PUT /api/public-profile/household-members/:memberId
 * Update a non-primary household member by Mongo _id.
 * Body: same optional fields as PATCH-style update — fullName, gender, dob, relationToPrimary, email,
 * address fields (careOf, house, street, locality, district, state, pincode, country), and optionally aadhaarNumber.
 * Primary member cannot be updated here (use PUT /api/public-profile/update).
 */
router.put("/household-members/:memberId", publicUserAuth, async (req, res) => {
  try {
    if (rejectNonAccountHolderBeneficiary(req.beneficiaryPerson, res)) return;

    const result = await updateHouseholdMemberById(
      req.publicUser,
      req.params.memberId,
      req.body || {}
    );
    if (!result.ok) {
      return res.status(result.status).json({ status: "error", message: result.message });
    }

    return res.status(200).json({
      status: "success",
      message: "Household member updated.",
      member: serializeHouseholdMember(result.person),
    });
  } catch (error) {
    console.error("Update household member error:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        status: "error",
        message: "This Aadhaar is already registered to another beneficiary profile.",
      });
    }
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

/**
 * POST /api/public-profile/household-members
 * Add a non-primary BeneficiaryPerson to the logged-in household, or update one if the same Aadhaar already exists in this household.
 *
 * Auth: publicUserAuth — `userId` (PublicUser _id) or `mobileNumber` in query and/or body.
 * Only the OTP account holder may call this (not when acting as a non-primary beneficiary profile).
 *
 * JSON body:
 * - aadhaarNumber (required, 12 digits)
 * - fullName (required on create; optional on update — must remain set)
 * - gender (required on create: M | F | O; optional on update)
 * - relationToPrimary (optional, default "member", max 64 chars)
 * - dob (optional, parseable date)
 * - email (optional)
 * - careOf, house, street, locality, district, state, pincode (6 digits), country (optional address fields)
 */
router.post("/household-members", publicUserAuth, async (req, res) => {
  try {
    if (rejectNonAccountHolderBeneficiary(req.beneficiaryPerson, res)) return;

    const result = await addHouseholdFamilyMember(req.publicUser, req.body || {});
    if (!result.ok) {
      return res.status(result.status).json({ status: "error", message: result.message });
    }

    const member = serializeHouseholdMember(result.person);

    return res.status(result.created ? 201 : 200).json({
      status: "success",
      message: result.created ? "Household member added." : "Household member updated.",
      created: result.created,
      member,
    });
  } catch (error) {
    console.error("Add household member error:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        status: "error",
        message: "This Aadhaar is already registered to another beneficiary profile.",
      });
    }
    return res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

/**
 * PUT /api/public-profile/update
 * Update user profile data
 * User identity: query params and/or body { userId }, { mobileNumber }
 */
router.put("/update", publicUserAuth, async (req, res) => {
  try {
    const user = req.publicUser;
    const beneficiaryPerson = req.beneficiaryPerson || null;
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
      familyDetails,
    } = req.body;

    if (beneficiaryPerson) {
      const bp = await BeneficiaryPerson.findById(beneficiaryPerson._id);
      if (!bp) {
        return res.status(404).json({ status: "error", message: "Beneficiary profile not found." });
      }
      if (String(bp.householdId) !== String(user.householdId)) {
        return res.status(403).json({ status: "error", message: "Access denied for this profile." });
      }

      const applied = await applyBeneficiaryProfileFromBody(bp, req.body, user);
      if (!applied.ok) {
        return res.status(applied.status).json({ status: "error", message: applied.message });
      }
      await bp.save();

      if (bp.isPrimary) {
        user.demographics = user.demographics || {};
        if (fullName !== undefined) user.demographics.fullName = fullName.trim();
        if (dob !== undefined) {
          user.demographics.dob = user.demographics.dob || {};
          user.demographics.dob.date = new Date(dob);
          user.demographics.dob.verified = false;
        }
        if (gender !== undefined) {
          const upperGender = gender.toUpperCase();
          if (["M", "F", "O"].includes(upperGender)) user.demographics.gender = upperGender;
        }
        if (aadhaarNumber !== undefined) {
          const trimmed = aadhaarNumber.trim();
          user.aadhaarNumber = trimmed;
          user.aadhaarHash = crypto.createHash("md5").update(trimmed).digest("hex");
        }
        if (email !== undefined) {
          user.contact.email.value = email.trim().toLowerCase();
          user.contact.email.verified = false;
        }
        if (careOf !== undefined) user.address.careOf = careOf.trim();
        if (house !== undefined) user.address.house = house.trim();
        if (street !== undefined) user.address.street = street.trim();
        if (locality !== undefined) user.address.locality = locality.trim();
        if (district !== undefined) user.address.district = district.trim();
        if (state !== undefined) user.address.state = state.trim();
        if (pincode !== undefined) user.address.pincode = pincode.trim();
        if (country !== undefined) user.address.country = country.trim() || "India";
        user.kycLevel = bp.kycLevel;
        user.audit.lastUpdated = new Date();
        user.audit.updateCount = (user.audit.updateCount || 0) + 1;
        await user.save();
      }

      await syncHouseholdFromPublicUser(user);
      if (bp.isPrimary) await syncPrimaryBeneficiaryFromPublicUser(user);

      return res.status(200).json({
        status: "success",
        message: "Profile updated successfully",
        user: await buildBeneficiaryApiUserPayload(bp, user),
      });
    }

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

      const trimmed = aadhaarNumber.trim();
      const existingUser = await PublicUser.findOne({
        aadhaarNumber: trimmed,
        _id: { $ne: user._id },
      });
      if (existingUser) {
        return res.status(400).json({
          status: "error",
          message: "Aadhaar number is already registered with another account.",
        });
      }

      const bpOther = await BeneficiaryPerson.findOne({
        aadhaarNumber: trimmed,
        ...(beneficiaryPerson ? { _id: { $ne: beneficiaryPerson._id } } : {}),
      });
      if (bpOther) {
        const sameHousehold =
          user.householdId && String(bpOther.householdId) === String(user.householdId);
        const primary = sameHousehold
          ? await BeneficiaryPerson.findOne({ householdId: user.householdId, isPrimary: true })
          : null;
        const allowedPrimarySync =
          sameHousehold && primary && String(primary._id) === String(bpOther._id) && !beneficiaryPerson;
        if (!allowedPrimarySync) {
          return res.status(400).json({
            status: "error",
            message: "Aadhaar number is already registered to another beneficiary profile.",
          });
        }
      }

      user.aadhaarNumber = trimmed;
      user.aadhaarHash = crypto.createHash("md5").update(trimmed).digest("hex");
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

    // Update family details
    if (familyDetails !== undefined && Array.isArray(familyDetails)) {
      const valid = familyDetails.every(
        (f) =>
          f &&
          typeof f === "object" &&
          typeof f.name === "string" &&
          f.name.trim() &&
          typeof f.relationWithApplicant === "string" &&
          f.relationWithApplicant.trim() &&
          typeof f.age === "number" &&
          !Number.isNaN(f.age) &&
          f.age >= 0
      );
      if (valid) {
        user.familyDetails = familyDetails.map((f) => ({
          name: String(f.name).trim(),
          relationWithApplicant: String(f.relationWithApplicant).trim(),
          age: Number(f.age),
          occupation: f.occupation != null ? String(f.occupation).trim() : "",
        }));
      }
    }

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
    await syncHouseholdFromPublicUser(user);
    await syncPrimaryBeneficiaryFromPublicUser(user);

    return res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      user: buildPrimaryAccountUserPayload(user),
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
 * Session: publicUserId or mobileNumber in query; when completing a household member profile,
 * also pass userId = that BeneficiaryPerson _id (same as profile switch / "Applying as").
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
    familyDetails,
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

  let parsedFamilyDetails = familyDetails;
  if (typeof familyDetails === "string") {
    try {
      parsedFamilyDetails = JSON.parse(familyDetails);
    } catch {
      parsedFamilyDetails = [];
    }
  }
  if (parsedFamilyDetails !== undefined && Array.isArray(parsedFamilyDetails)) {
    const valid = parsedFamilyDetails.every(
      (f) =>
        f &&
        typeof f === "object" &&
        typeof f.name === "string" &&
        f.name.trim() &&
        typeof f.relationWithApplicant === "string" &&
        f.relationWithApplicant.trim() &&
        (typeof f.age === "number" || (typeof f.age === "string" && !Number.isNaN(Number(f.age)))) &&
        Number(f.age) >= 0
    );
    if (valid) {
      user.familyDetails = parsedFamilyDetails.map((f) => ({
        name: String(f.name).trim(),
        relationWithApplicant: String(f.relationWithApplicant).trim(),
        age: Number(f.age),
        occupation: f.occupation != null ? String(f.occupation).trim() : "",
      }));
    }
  }
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
      const files = req.files || {};
      const unlinkOld = (rel) => {
        const p = publicUploadAbsPath(rel);
        if (fs.existsSync(p)) fs.unlinkSync(p);
        return true;
      };

      const acting = await loadActingBeneficiaryForRequest(req, user);
      if (acting && !acting.ok) {
        return res.status(acting.status).json({ status: "error", message: acting.message });
      }

      if (acting?.person) {
        const bp = acting.person;
        const applied = await applyBeneficiaryProfileFromBody(bp, body, user);
        if (!applied.ok) {
          return res.status(applied.status).json({ status: "error", message: applied.message });
        }
        applyBeneficiaryDocumentsFromFiles(bp, files, unlinkOld, publicUploadAbsPath);
        await bp.save();

        if (bp.isPrimary) {
          applyProfileUpdates(user, body);
          for (const docType of DOCUMENT_TYPES) {
            if (files[docType]?.[0] && bp.documents[docType]) {
              user.documents[docType] = { ...bp.documents[docType] };
            }
          }
          user.kycLevel = bp.kycLevel;
          user.status.verificationStatus = user.status.verificationStatus || "pending";
          user.audit.lastUpdated = new Date();
          user.audit.updateCount = (user.audit.updateCount || 0) + 1;
          await user.save();
          await syncPrimaryBeneficiaryFromPublicUser(user);
        }

        return res.status(200).json({
          status: "success",
          message: "Profile and documents saved successfully",
          user: await buildBeneficiaryApiUserPayload(bp, user),
        });
      }

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

      for (const docType of DOCUMENT_TYPES) {
        if (files[docType] && files[docType][0]) {
          const file = files[docType][0];
          const oldDoc = user.documents[docType];
          if (oldDoc?.filePath) {
            unlinkOld(oldDoc.filePath);
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
      await syncPrimaryBeneficiaryFromPublicUser(user);

      return res.status(200).json({
        status: "success",
        message: "Profile and documents saved successfully",
        user: buildPrimaryAccountUserPayload(user),
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
 * Session: `publicUserId` (PublicUser _id from login) OR `mobileNumber` in query and/or body, plus optional `userId` for acting as a household member.
 * When userId is a BeneficiaryPerson, `user` in the JSON uses that id so the client "Applying as" header matches.
 */
router.get("/", publicUserAuth, async (req, res) => {
  try {
    const user = req.publicUser;
    const beneficiaryPerson = req.beneficiaryPerson;

    if (beneficiaryPerson) {
      const loaded = await loadActingBeneficiaryForRequest(req, user);
      if (!loaded.ok) {
        return res.status(loaded.status).json({ status: "error", message: loaded.message });
      }
      return res.status(200).json({
        status: "success",
        user: await buildBeneficiaryApiUserPayload(loaded.person, user),
      });
    }

    return res.status(200).json({
      status: "success",
      user: buildPrimaryAccountUserPayload(user),
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

      if (!documentType || !DOCUMENT_TYPES.includes(documentType)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          status: "error",
          message: `Invalid document type. Must be one of: ${DOCUMENT_TYPES.join(", ")}`,
        });
      }

      const acting = await loadActingBeneficiaryForRequest(req, user);
      if (acting && !acting.ok) {
        fs.unlinkSync(req.file.path);
        return res.status(acting.status).json({ status: "error", message: acting.message });
      }

      const relativePath = `/public/uploads/public-user-documents/${req.file.filename}`;
      const docPayload = {
        filePath: relativePath,
        uploadedAt: new Date(),
        verified: false,
      };

      if (acting?.person) {
        const bp = acting.person;
        const oldDoc = bp.documents?.[documentType];
        if (oldDoc?.filePath) {
          const oldFilePath = publicUploadAbsPath(oldDoc.filePath);
          if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
        }
        bp.documents[documentType] = docPayload;
        bp.audit.lastUpdated = new Date();
        bp.audit.updateCount = (bp.audit.updateCount || 0) + 1;
        await bp.save();

        return res.status(200).json({
          status: "success",
          message: "Document uploaded successfully",
          document: { type: documentType, filePath: relativePath, uploadedAt: docPayload.uploadedAt },
          user: await buildBeneficiaryApiUserPayload(bp, user),
        });
      }

      const documentField = user.documents[documentType];
      if (documentField?.filePath) {
        const oldFilePath = publicUploadAbsPath(documentField.filePath);
        if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
      }

      user.documents[documentType] = docPayload;
      user.audit.lastUpdated = new Date();
      user.audit.updateCount = (user.audit.updateCount || 0) + 1;
      await user.save();

      return res.status(200).json({
        status: "success",
        message: "Document uploaded successfully",
        document: {
          type: documentType,
          filePath: relativePath,
          uploadedAt: user.documents[documentType].uploadedAt,
        },
        user: buildPrimaryAccountUserPayload(user),
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
    const errors = [];

    const acting = await loadActingBeneficiaryForRequest(req, user);
    if (acting && !acting.ok) {
      return res.status(acting.status).json({ status: "error", message: acting.message });
    }

    const unlinkOld = (rel) => {
      const p = publicUploadAbsPath(rel);
      if (fs.existsSync(p)) fs.unlinkSync(p);
      return true;
    };

    if (acting?.person) {
      const bp = acting.person;
      const uploadedDocuments = applyBeneficiaryDocumentsFromFiles(
        bp,
        files,
        unlinkOld,
        publicUploadAbsPath
      );

      if (uploadedDocuments.length === 0 && Object.keys(files).length === 0) {
        return res.status(400).json({
          status: "error",
          message: "No files uploaded. Please select at least one document to upload.",
        });
      }

      if (uploadedDocuments.length > 0) {
        bp.audit.lastUpdated = new Date();
        bp.audit.updateCount = (bp.audit.updateCount || 0) + 1;
        await bp.save();
      }

      return res.status(200).json({
        status: "success",
        message: `${uploadedDocuments.length} document(s) uploaded successfully`,
        uploadedDocuments,
        errors: errors.length > 0 ? errors : undefined,
        user: await buildBeneficiaryApiUserPayload(bp, user),
      });
    }

    const uploadedDocuments = [];

    for (const documentType of DOCUMENT_TYPES) {
      if (files[documentType] && files[documentType][0]) {
        const file = files[documentType][0];
        try {
          const documentField = user.documents[documentType];
          if (documentField?.filePath) {
            unlinkOld(documentField.filePath);
          }
          const relativePath = `/public/uploads/public-user-documents/${file.filename}`;
          user.documents[documentType] = {
            filePath: relativePath,
            uploadedAt: new Date(),
            verified: false,
          };
          uploadedDocuments.push({
            type: documentType,
            filePath: relativePath,
            uploadedAt: user.documents[documentType].uploadedAt,
          });
        } catch (error) {
          console.error(`Error processing ${documentType}:`, error);
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          errors.push({
            type: documentType,
            error: error.message || "Failed to process document",
          });
        }
      }
    }

    if (uploadedDocuments.length === 0 && Object.keys(files).length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No files uploaded. Please select at least one document to upload.",
      });
    }

    if (uploadedDocuments.length > 0) {
      user.audit.lastUpdated = new Date();
      user.audit.updateCount = (user.audit.updateCount || 0) + 1;
      await user.save();
    }

    return res.status(200).json({
      status: "success",
      message: `${uploadedDocuments.length} document(s) uploaded successfully`,
      uploadedDocuments,
      errors: errors.length > 0 ? errors : undefined,
      user: buildPrimaryAccountUserPayload(user),
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

    if (!documentType || !DOCUMENT_TYPES.includes(documentType)) {
      return res.status(400).json({
        status: "error",
        message: `Invalid document type. Must be one of: ${DOCUMENT_TYPES.join(", ")}`,
      });
    }

    const acting = await loadActingBeneficiaryForRequest(req, user);
    if (acting && !acting.ok) {
      return res.status(acting.status).json({ status: "error", message: acting.message });
    }

    const clearDoc = { filePath: null, uploadedAt: null, verified: false };

    if (acting?.person) {
      const bp = acting.person;
      const documentField = bp.documents?.[documentType];
      if (documentField?.filePath) {
        const filePath = publicUploadAbsPath(documentField.filePath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      bp.documents[documentType] = clearDoc;
      bp.audit.lastUpdated = new Date();
      bp.audit.updateCount = (bp.audit.updateCount || 0) + 1;
      await bp.save();

      return res.status(200).json({
        status: "success",
        message: "Document deleted successfully",
        user: await buildBeneficiaryApiUserPayload(bp, user),
      });
    }

    const documentField = user.documents[documentType];
    if (documentField?.filePath) {
      const filePath = publicUploadAbsPath(documentField.filePath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    user.documents[documentType] = clearDoc;
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
