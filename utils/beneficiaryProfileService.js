const PublicUser = require("../models/PublicUser");
const BeneficiaryPerson = require("../models/BeneficiaryPerson");
const Household = require("../models/Household");
const { md5Hex, computeBeneficiaryKycLevel, refreshBeneficiaryKycLevel } = require("./householdService");
const { getCscVerificationMessage } = require("./publicUserMessages");
const { buildKycFields } = require("./kycStatus");

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
const {
  getProfileReusableKeys,
  validateDocumentTypeKey,
  documentsObjectToPlain,
} = require("./documentTypeService");

async function ensureBeneficiaryDocuments(bp) {
  if (!bp.documents || typeof bp.documents !== "object") {
    bp.documents = {};
  }
  const keys = await getProfileReusableKeys();
  for (const key of keys) {
    if (!bp.documents[key]) {
      bp.documents[key] = { filePath: null, uploadedAt: null, verified: false };
    }
  }
}

/**
 * Apply profile fields from PUT /update or POST /submit-complete body onto a BeneficiaryPerson.
 */
async function applyBeneficiaryProfileFromBody(bp, body, sessionPublicUser) {
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
  } = body || {};

  if (familyDetails !== undefined) {
    return {
      ok: false,
      status: 400,
      message: "Family details can only be updated from the account holder (primary) profile.",
    };
  }

  if (fullName !== undefined && fullName !== "") {
    bp.demographics = bp.demographics || {};
    bp.demographics.fullName = String(fullName).trim();
  }
  if (dob !== undefined && dob !== "") {
    bp.demographics = bp.demographics || {};
    bp.demographics.dob = bp.demographics.dob || {};
    bp.demographics.dob.date = new Date(dob);
    bp.demographics.dob.verified = false;
  }
  if (gender !== undefined && gender !== "") {
    const upperGender = String(gender).toUpperCase();
    if (["M", "F", "O"].includes(upperGender)) {
      bp.demographics = bp.demographics || {};
      bp.demographics.gender = upperGender;
    }
  }

  if (aadhaarNumber !== undefined && aadhaarNumber !== "") {
    const trimmed = String(aadhaarNumber).trim();
    if (!/^\d{12}$/.test(trimmed)) {
      return { ok: false, status: 400, message: "Invalid Aadhaar number. It must be a 12-digit number." };
    }
    const existingUser = await PublicUser.findOne({
      aadhaarNumber: trimmed,
      _id: { $ne: sessionPublicUser._id },
    });
    if (existingUser) {
      return {
        ok: false,
        status: 400,
        message: "Aadhaar number is already registered with another account.",
      };
    }
    const otherBp = await BeneficiaryPerson.findOne({
      aadhaarNumber: trimmed,
      _id: { $ne: bp._id },
    });
    if (otherBp) {
      return {
        ok: false,
        status: 400,
        message: "Aadhaar number is already registered to another beneficiary profile.",
      };
    }
    bp.aadhaarNumber = trimmed;
    bp.aadhaarHash = md5Hex(trimmed);
  }

  if (email !== undefined) {
    const em = String(email).trim().toLowerCase();
    if (em === "") {
      bp.contact = bp.contact || {};
      bp.contact.email = undefined;
    } else if (!EMAIL_REGEX.test(em)) {
      return { ok: false, status: 400, message: "Invalid email format." };
    } else {
      bp.contact = bp.contact || {};
      bp.contact.email = { value: em, verified: false };
    }
  }

  const addressFields = [
    ["careOf", "careOf"],
    ["house", "house"],
    ["street", "street"],
    ["locality", "locality"],
    ["district", "district"],
    ["state", "state"],
    ["country", "country"],
  ];
  for (const [key, field] of addressFields) {
    if (body[key] !== undefined) {
      bp.address = bp.address || {};
      bp.address[field] = String(body[key]).trim();
    }
  }
  if (pincode !== undefined && pincode !== "") {
    if (!/^\d{6}$/.test(String(pincode))) {
      return { ok: false, status: 400, message: "Invalid pincode. It must be a 6-digit number." };
    }
    bp.address = bp.address || {};
    bp.address.pincode = String(pincode).trim();
  }

  bp.kycLevel = computeBeneficiaryKycLevel(bp);
  bp.audit = bp.audit || {};
  bp.audit.lastUpdated = new Date();
  bp.audit.updateCount = (bp.audit.updateCount || 0) + 1;

  return { ok: true };
}

/**
 * Persist uploaded files onto bp.documents. files: multer map { aadhaarCard: [file], ... }.
 */
async function applyBeneficiaryDocumentsFromFiles(bp, files, unlinkFs, pathJoin) {
  await ensureBeneficiaryDocuments(bp);
  const saved = [];
  const docTypes = Object.keys(files || {});

  for (const docType of docTypes) {
    const valid = await validateDocumentTypeKey(docType);
    if (!valid.ok) continue;
    const arr = files?.[docType];
    if (!arr?.[0]) continue;
    const file = arr[0];
    const oldDoc = bp.documents[docType];
    if (oldDoc?.filePath && unlinkFs && pathJoin) {
      const oldPath = pathJoin(oldDoc.filePath);
      if (unlinkFs(oldPath)) {
        /* deleted */
      }
    }
    const relativePath = `/public/uploads/public-user-documents/${file.filename}`;
    bp.documents[docType] = {
      filePath: relativePath,
      uploadedAt: new Date(),
      verified: false,
    };
    saved.push({ type: docType, filePath: relativePath, uploadedAt: bp.documents[docType].uploadedAt });
  }

  return saved;
}

async function getHouseholdVerificationStatus(bp, sessionPublicUser) {
  const hh = await Household.findById(bp.householdId).select("status.verificationStatus").lean();
  return hh?.status?.verificationStatus || sessionPublicUser.status?.verificationStatus || "pending";
}

async function buildBeneficiaryApiUserPayload(bp, sessionPublicUser) {
  await refreshBeneficiaryKycLevel(bp, { persist: true });
  const cscVerificationStatus = await getHouseholdVerificationStatus(bp, sessionPublicUser);
  return {
    _id: bp._id,
    userId: bp._id,
    beneficiaryPersonId: bp._id,
    publicUserId: sessionPublicUser._id,
    householdId: bp.householdId?._id || bp.householdId,
    isPrimary: !!bp.isPrimary,
    fullName: bp.demographics?.fullName || null,
    contactEmail: bp.contact?.email?.value || sessionPublicUser.contact?.email?.value || null,
    phoneNumber: sessionPublicUser.contact?.mobile?.value || null,
    address: bp.address || null,
    dob: bp.demographics?.dob?.date || null,
    aadhaarNumber: bp.aadhaarNumber || null,
    gender: bp.demographics?.gender || null,
    familyDetails: bp.isPrimary ? sessionPublicUser.familyDetails || [] : [],
    documents: documentsObjectToPlain(bp.documents),
    ...buildKycFields(bp.kycLevel, bp),
    cscVerificationStatus,
    verificationStatus: cscVerificationStatus,
    accountStatusMessage: getCscVerificationMessage(cscVerificationStatus),
  };
}

async function loadActingBeneficiaryForRequest(req, sessionPublicUser) {
  if (!req.beneficiaryPerson?._id) return null;
  const bp = await BeneficiaryPerson.findById(req.beneficiaryPerson._id);
  if (!bp) {
    return { ok: false, status: 404, message: "Beneficiary profile not found." };
  }
  if (String(bp.householdId) !== String(sessionPublicUser.householdId)) {
    return { ok: false, status: 403, message: "Access denied for this profile." };
  }
  await ensureBeneficiaryDocuments(bp);
  await refreshBeneficiaryKycLevel(bp, { persist: true });
  return { ok: true, person: bp };
}

module.exports = {
  ensureBeneficiaryDocuments,
  applyBeneficiaryProfileFromBody,
  applyBeneficiaryDocumentsFromFiles,
  buildBeneficiaryApiUserPayload,
  loadActingBeneficiaryForRequest,
};
