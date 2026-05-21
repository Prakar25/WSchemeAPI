const crypto = require("crypto");
const mongoose = require("mongoose");
const Household = require("../models/Household");
const BeneficiaryPerson = require("../models/BeneficiaryPerson");
const PublicUser = require("../models/PublicUser");

function md5Hex(s) {
  return crypto.createHash("md5").update(String(s)).digest("hex");
}

/**
 * Ensure a Household exists for this PublicUser and a primary BeneficiaryPerson exists.
 * Idempotent; safe to call multiple times.
 */
async function ensureHouseholdForPublicUser(publicUser) {
  if (!publicUser?._id) return null;

  let household = publicUser.householdId ? await Household.findById(publicUser.householdId) : null;
  if (!household) {
    household = await Household.findOne({ publicUserId: publicUser._id });
  }
  if (!household) {
    const mobile = publicUser.contact?.mobile?.value?.trim();
    if (!mobile) return null;

    household = await Household.create({
      publicUserId: publicUser._id,
      contact: {
        mobile: {
          value: mobile,
          verified: !!publicUser.contact?.mobile?.verified,
        },
      },
      status: {
        isActive: publicUser.status?.isActive !== false,
        isDeactivated: !!publicUser.status?.isDeactivated,
        reason: publicUser.status?.reason || null,
        verificationStatus: publicUser.status?.verificationStatus || "verified",
        verifiedBy: publicUser.status?.verifiedBy || null,
        verifiedAt: publicUser.status?.verifiedAt || null,
        rejectionReason: publicUser.status?.rejectionReason || null,
      },
      authentication: {
        lastAuthAt: publicUser.authentication?.lastAuthAt || null,
        authMethodsUsed: publicUser.authentication?.authMethodsUsed || [],
      },
      audit: {
        createdAt: publicUser.audit?.createdAt || new Date(),
        lastUpdated: new Date(),
        updateCount: publicUser.audit?.updateCount || 0,
      },
    });

    publicUser.householdId = household._id;
    await publicUser.save();
  } else if (!publicUser.householdId) {
    publicUser.householdId = household._id;
    await publicUser.save();
  }

  const existingPrimary = await BeneficiaryPerson.findOne({
    householdId: household._id,
    isPrimary: true,
  });
  if (!existingPrimary) {
    const aadhaar = publicUser.aadhaarNumber?.trim() || undefined;
    await BeneficiaryPerson.create({
      householdId: household._id,
      isPrimary: true,
      relationToPrimary: "self",
      aadhaarNumber: aadhaar,
      aadhaarHash: aadhaar ? md5Hex(aadhaar) : undefined,
      demographics: {
        fullName: publicUser.demographics?.fullName,
        dob: {
          date: publicUser.demographics?.dob?.date,
          verified: !!publicUser.demographics?.dob?.verified,
        },
        gender: publicUser.demographics?.gender,
        photo: publicUser.demographics?.photo || { stored: false, photoId: null },
      },
      address: publicUser.address || {},
      economicStatus: publicUser.economicStatus,
      contact: {
        email: publicUser.contact?.email
          ? {
              value: publicUser.contact.email.value,
              verified: !!publicUser.contact.email.verified,
            }
          : undefined,
      },
      kycLevel: publicUser.kycLevel || "BASIC",
    });
  }

  return household;
}

/**
 * Sync household status/flags from PublicUser (single source of truth for OTP account).
 */
async function syncHouseholdFromPublicUser(publicUser) {
  if (!publicUser?.householdId) return;
  const h = await Household.findById(publicUser.householdId);
  if (!h) return;
  h.contact.mobile.value = publicUser.contact?.mobile?.value?.trim() || h.contact.mobile.value;
  h.contact.mobile.verified = !!publicUser.contact?.mobile?.verified;
  h.status.isActive = publicUser.status?.isActive !== false;
  h.status.isDeactivated = !!publicUser.status?.isDeactivated;
  h.status.reason = publicUser.status?.reason || null;
  h.status.verificationStatus = publicUser.status?.verificationStatus || h.status.verificationStatus;
  h.status.verifiedBy = publicUser.status?.verifiedBy || null;
  h.status.verifiedAt = publicUser.status?.verifiedAt || null;
  h.status.rejectionReason = publicUser.status?.rejectionReason || null;
  h.authentication.lastAuthAt = publicUser.authentication?.lastAuthAt || h.authentication.lastAuthAt;
  h.authentication.authMethodsUsed = publicUser.authentication?.authMethodsUsed || h.authentication.authMethodsUsed;
  h.audit.lastUpdated = new Date();
  h.audit.updateCount = (h.audit.updateCount || 0) + 1;
  await h.save();
}

/**
 * Copy primary PublicUser profile onto the primary BeneficiaryPerson (keeps them in sync).
 */
async function syncPrimaryBeneficiaryFromPublicUser(publicUser) {
  if (!publicUser?.householdId) return;
  const bp = await BeneficiaryPerson.findOne({ householdId: publicUser.householdId, isPrimary: true });
  if (!bp) return;

  bp.demographics = {
    fullName: publicUser.demographics?.fullName,
    dob: {
      date: publicUser.demographics?.dob?.date,
      verified: !!publicUser.demographics?.dob?.verified,
    },
    gender: publicUser.demographics?.gender,
    photo: publicUser.demographics?.photo || { stored: false, photoId: null },
  };
  bp.address = publicUser.address || bp.address;
  bp.kycLevel = computeBeneficiaryKycLevel(bp);
  if (publicUser.aadhaarNumber) {
    bp.aadhaarNumber = publicUser.aadhaarNumber.trim();
    bp.aadhaarHash = md5Hex(bp.aadhaarNumber);
  }
  if (publicUser.contact?.email?.value) {
    bp.contact = bp.contact || {};
    bp.contact.email = {
      value: publicUser.contact.email.value,
      verified: !!publicUser.contact.email.verified,
    };
  }
  bp.audit.lastUpdated = new Date();
  bp.audit.updateCount = (bp.audit.updateCount || 0) + 1;
  await bp.save();
}

function computeBeneficiaryKycLevel(bp) {
  if (
    bp.aadhaarNumber &&
    bp.demographics?.fullName &&
    bp.demographics?.dob?.date &&
    bp.demographics?.gender &&
    bp.address?.locality &&
    bp.address?.district &&
    bp.address?.state &&
    bp.address?.pincode
  ) {
    return "FULL";
  }
  if (
    bp.demographics?.fullName &&
    (bp.demographics?.dob?.date || bp.demographics?.gender || bp.address?.locality)
  ) {
    return "PARTIAL";
  }
  return "BASIC";
}

/** Recompute kycLevel from profile fields (each household member has their own). */
async function refreshBeneficiaryKycLevel(bp, options = {}) {
  const next = computeBeneficiaryKycLevel(bp);
  const changed = bp.kycLevel !== next;
  bp.kycLevel = next;
  if (options.persist && changed) {
    bp.audit = bp.audit || {};
    bp.audit.lastUpdated = new Date();
    await bp.save();
  }
  return { kycLevel: next, changed };
}

function mergeAddressFromBody(bp, body) {
  bp.address = bp.address || {};
  const pairs = [
    ["careOf", "careOf"],
    ["house", "house"],
    ["street", "street"],
    ["locality", "locality"],
    ["district", "district"],
    ["state", "state"],
    ["country", "country"],
  ];
  for (const [key, field] of pairs) {
    if (body[key] !== undefined) {
      bp.address[field] = String(body[key]).trim();
    }
  }
  if (body.pincode !== undefined) {
    const p = String(body.pincode).trim();
    if (/^\d{6}$/.test(p)) {
      bp.address.pincode = p;
    } else if (body.pincode === "" || body.pincode === null) {
      bp.address.pincode = undefined;
    }
  }
}

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

/**
 * Mutates a non-primary BeneficiaryPerson from request body (demographics, relation, address, email).
 * Does not set aadhaarNumber — handle that separately when changing Aadhaar.
 */
function patchNonPrimaryBeneficiaryFromBody(bp, body) {
  if (body.fullName !== undefined) {
    bp.demographics = bp.demographics || {};
    bp.demographics.fullName = String(body.fullName).trim();
  }
  if (body.dob !== undefined && body.dob !== null && body.dob !== "") {
    bp.demographics = bp.demographics || {};
    bp.demographics.dob = bp.demographics.dob || {};
    bp.demographics.dob.date = new Date(body.dob);
    bp.demographics.dob.verified = false;
  }
  if (body.gender !== undefined && body.gender !== null && body.gender !== "") {
    const upperGender = String(body.gender).toUpperCase();
    if (!["M", "F", "O"].includes(upperGender)) {
      return { ok: false, status: 400, message: "Invalid gender. Use M, F, or O." };
    }
    bp.demographics = bp.demographics || {};
    bp.demographics.gender = upperGender;
  }
  if (body.relationToPrimary !== undefined) {
    const rel = String(body.relationToPrimary).trim();
    if (!rel) {
      return { ok: false, status: 400, message: "relationToPrimary cannot be empty." };
    }
    bp.relationToPrimary = rel.slice(0, 64);
  }
  mergeAddressFromBody(bp, body);
  if (body.email !== undefined) {
    const em = String(body.email).trim().toLowerCase();
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

  if (!bp.demographics?.fullName) {
    return { ok: false, status: 400, message: "Full name is required." };
  }
  if (!bp.demographics?.gender) {
    return { ok: false, status: 400, message: "Gender is required." };
  }
  return { ok: true };
}

async function listHouseholdMembers(publicUser) {
  await ensureHouseholdForPublicUser(publicUser);
  const user = await PublicUser.findById(publicUser._id).select("householdId");
  const hid = user?.householdId;
  if (!hid) {
    return { ok: true, members: [] };
  }
  const members = await BeneficiaryPerson.find({ householdId: hid }).sort({
    isPrimary: -1,
    createdAt: 1,
  });
  for (const m of members) {
    await refreshBeneficiaryKycLevel(m, { persist: true });
  }
  return { ok: true, members };
}

/**
 * Update a household BeneficiaryPerson by _id. Primary member must use main profile APIs.
 * Optional body.aadhaarNumber changes Aadhaar with the same uniqueness rules as create.
 */
async function updateHouseholdMemberById(publicUser, memberId, body) {
  if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
    return { ok: false, status: 400, message: "Invalid member id." };
  }

  await ensureHouseholdForPublicUser(publicUser);
  await syncHouseholdFromPublicUser(publicUser);

  const user = await PublicUser.findById(publicUser._id).select("householdId");
  const hid = user?.householdId;
  if (!hid) {
    return { ok: false, status: 500, message: "Could not ensure household for this account." };
  }

  const bp = await BeneficiaryPerson.findById(memberId);
  if (!bp) {
    return { ok: false, status: 404, message: "Household member not found." };
  }
  if (String(bp.householdId) !== String(hid)) {
    return { ok: false, status: 403, message: "This member does not belong to your household." };
  }
  if (bp.isPrimary) {
    return {
      ok: false,
      status: 400,
      message: "The primary member cannot be updated here. Use the main profile update API.",
    };
  }

  if (body?.aadhaarNumber !== undefined) {
    const raw = body.aadhaarNumber;
    if (raw === null || String(raw).trim() === "") {
      return { ok: false, status: 400, message: "Aadhaar number cannot be removed." };
    }
    const trimmed = String(raw).trim();
    if (!/^\d{12}$/.test(trimmed)) {
      return { ok: false, status: 400, message: "Invalid Aadhaar number. It must be a 12-digit number." };
    }
    if (trimmed !== (bp.aadhaarNumber || "").trim()) {
      const otherPu = await PublicUser.findOne({
        aadhaarNumber: trimmed,
        _id: { $ne: publicUser._id },
      });
      if (otherPu) {
        return {
          ok: false,
          status: 400,
          message: "This Aadhaar is already registered with another mobile account.",
        };
      }
      const conflict = await BeneficiaryPerson.findOne({
        aadhaarNumber: trimmed,
        _id: { $ne: bp._id },
      });
      if (conflict) {
        if (String(conflict.householdId) !== String(hid)) {
          return {
            ok: false,
            status: 400,
            message:
              "This Aadhaar is already registered to another household. Use the mobile number linked to that beneficiary.",
          };
        }
        return {
          ok: false,
          status: 400,
          message: "Another household member already has this Aadhaar number.",
        };
      }
      bp.aadhaarNumber = trimmed;
      bp.aadhaarHash = md5Hex(trimmed);
    }
  }

  const patchResult = patchNonPrimaryBeneficiaryFromBody(bp, body || {});
  if (!patchResult.ok) {
    return { ok: false, status: patchResult.status, message: patchResult.message };
  }

  bp.kycLevel = computeBeneficiaryKycLevel(bp);
  bp.audit.lastUpdated = new Date();
  bp.audit.updateCount = (bp.audit.updateCount || 0) + 1;
  await bp.save();
  return { ok: true, person: bp };
}

/**
 * Add or update a non-primary BeneficiaryPerson under the caller's household (same Aadhaar in household = update).
 * Caller must be the OTP PublicUser; use publicUserAuth without impersonating a non-primary profile.
 *
 * Body: aadhaarNumber (12 digits), fullName, gender (M|F|O), relationToPrimary (optional),
 * dob (optional), email (optional), address fields optional (careOf, house, street, locality, district, state, pincode, country).
 */
async function addHouseholdFamilyMember(publicUser, body) {
  await ensureHouseholdForPublicUser(publicUser);
  await syncHouseholdFromPublicUser(publicUser);

  const user = await PublicUser.findById(publicUser._id).select("householdId");
  const hid = user?.householdId;
  if (!hid) {
    return { ok: false, status: 500, message: "Could not ensure household for this account." };
  }

  const aadhaarRaw = body?.aadhaarNumber;
  if (aadhaarRaw === undefined || aadhaarRaw === null || String(aadhaarRaw).trim() === "") {
    return { ok: false, status: 400, message: "Aadhaar number is required." };
  }
  const trimmedAadhaar = String(aadhaarRaw).trim();
  if (!/^\d{12}$/.test(trimmedAadhaar)) {
    return { ok: false, status: 400, message: "Invalid Aadhaar number. It must be a 12-digit number." };
  }

  const otherPu = await PublicUser.findOne({
    aadhaarNumber: trimmedAadhaar,
    _id: { $ne: publicUser._id },
  });
  if (otherPu) {
    return {
      ok: false,
      status: 400,
      message: "This Aadhaar is already registered with another mobile account.",
    };
  }

  const globalBp = await BeneficiaryPerson.findOne({ aadhaarNumber: trimmedAadhaar });
  if (globalBp) {
    if (String(globalBp.householdId) !== String(hid)) {
      return {
        ok: false,
        status: 400,
        message:
          "This Aadhaar is already registered to another household. Use the mobile number linked to that beneficiary.",
      };
    }
    if (globalBp.isPrimary) {
      return {
        ok: false,
        status: 400,
        message: "This Aadhaar is the primary household member. Update the main profile instead.",
      };
    }

    const patchRes = patchNonPrimaryBeneficiaryFromBody(globalBp, body);
    if (!patchRes.ok) {
      return { ok: false, status: patchRes.status, message: patchRes.message };
    }

    globalBp.kycLevel = computeBeneficiaryKycLevel(globalBp);
    globalBp.audit.lastUpdated = new Date();
    globalBp.audit.updateCount = (globalBp.audit.updateCount || 0) + 1;
    await globalBp.save();
    return { ok: true, person: globalBp, created: false };
  }

  const fullName = body.fullName !== undefined ? String(body.fullName).trim() : "";
  if (!fullName) {
    return { ok: false, status: 400, message: "Full name is required." };
  }
  if (body.gender === undefined || body.gender === null || body.gender === "") {
    return { ok: false, status: 400, message: "Gender is required." };
  }
  const upperGender = String(body.gender).toUpperCase();
  if (!["M", "F", "O"].includes(upperGender)) {
    return { ok: false, status: 400, message: "Invalid gender. Use M, F, or O." };
  }

  const relationToPrimary =
    body.relationToPrimary != null && String(body.relationToPrimary).trim()
      ? String(body.relationToPrimary).trim().slice(0, 64)
      : "member";

  const demographics = {
    fullName,
    gender: upperGender,
    photo: { stored: false, photoId: null },
  };
  if (body.dob !== undefined && body.dob !== null && body.dob !== "") {
    demographics.dob = { date: new Date(body.dob), verified: false };
  }

  const address = {
    careOf: body.careOf !== undefined ? String(body.careOf).trim() : "",
    house: body.house !== undefined ? String(body.house).trim() : "",
    street: body.street !== undefined ? String(body.street).trim() : "",
    locality: body.locality !== undefined ? String(body.locality).trim() : "",
    district: body.district !== undefined ? String(body.district).trim() : "",
    state: body.state !== undefined ? String(body.state).trim() : "",
    country: body.country !== undefined ? String(body.country).trim() || "India" : "India",
  };
  if (body.pincode !== undefined && /^\d{6}$/.test(String(body.pincode).trim())) {
    address.pincode = String(body.pincode).trim();
  }

  let contact = {};
  if (body.email !== undefined && body.email !== null && String(body.email).trim() !== "") {
    const em = String(body.email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(em)) {
      return { ok: false, status: 400, message: "Invalid email format." };
    }
    contact = { email: { value: em, verified: false } };
  }

  const person = await BeneficiaryPerson.create({
    householdId: hid,
    isPrimary: false,
    relationToPrimary,
    aadhaarNumber: trimmedAadhaar,
    aadhaarHash: md5Hex(trimmedAadhaar),
    demographics,
    address,
    contact,
    kycLevel: "BASIC",
    audit: {
      createdAt: new Date(),
      lastUpdated: new Date(),
      updateCount: 0,
    },
  });
  person.kycLevel = computeBeneficiaryKycLevel(person);
  await person.save();

  return { ok: true, person, created: true };
}

module.exports = {
  ensureHouseholdForPublicUser,
  syncHouseholdFromPublicUser,
  syncPrimaryBeneficiaryFromPublicUser,
  addHouseholdFamilyMember,
  listHouseholdMembers,
  updateHouseholdMemberById,
  computeBeneficiaryKycLevel,
  refreshBeneficiaryKycLevel,
  md5Hex,
};
