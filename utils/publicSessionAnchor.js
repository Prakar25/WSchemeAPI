const mongoose = require("mongoose");
const PublicUser = require("../models/PublicUser");
const BeneficiaryPerson = require("../models/BeneficiaryPerson");
const Household = require("../models/Household");

/**
 * Normalize to 10-digit Indian mobile as stored on PublicUser.contact.mobile.value.
 */
function normalizeIndianMobile(value) {
  if (value === undefined || value === null || value === "") return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) return last10;
  }
  const t = String(value).trim();
  if (/^[6-9]\d{9}$/.test(t)) return t;
  return null;
}

function sessionPublicUserIdFromReq(req) {
  const q = req.query || {};
  const b = req.body || {};
  const id =
    q.publicUserId ??
    q.accountId ??
    q.sessionUserId ??
    b.publicUserId ??
    b.accountId ??
    b.sessionUserId;
  if (!id) return null;
  const s = String(id).trim();
  return s || null;
}

function sessionMobileFromReq(req) {
  const q = req.query || {};
  const b = req.body || {};
  const raw = q.mobileNumber ?? b.mobileNumber;
  return normalizeIndianMobile(raw);
}

/** Legacy client param: userId / user_id (PublicUser or BeneficiaryPerson _id). */
function sessionLegacyApplicantIdFromReq(req) {
  const q = req.query || {};
  const b = req.body || {};
  const id = q.userId ?? q.user_id ?? b.userId ?? b.user_id;
  if (!id) return null;
  const s = String(id).trim();
  return s || null;
}

async function resolvePublicUserFromLegacyApplicantId(applicantId) {
  if (!mongoose.Types.ObjectId.isValid(applicantId)) {
    return { ok: false, status: 400, message: "Invalid userId format." };
  }

  const publicUser = await PublicUser.findById(applicantId);
  if (publicUser) {
    if (!publicUser.status?.isActive || publicUser.status?.isDeactivated) {
      return { ok: false, status: 403, message: "Your account is inactive. Please contact support." };
    }
    return { ok: true, publicUser };
  }

  const person = await BeneficiaryPerson.findById(applicantId).select("householdId").lean();
  if (!person?.householdId) {
    return { ok: false, status: 404, message: "User not found for userId." };
  }

  const household = await Household.findById(person.householdId).select("publicUserId").lean();
  if (!household?.publicUserId) {
    return { ok: false, status: 404, message: "Household account not found for this userId." };
  }

  const owner = await PublicUser.findById(household.publicUserId);
  if (!owner) {
    return { ok: false, status: 404, message: "Session account not found for this userId." };
  }
  if (!owner.status?.isActive || owner.status?.isDeactivated) {
    return { ok: false, status: 403, message: "Your account is inactive. Please contact support." };
  }

  return { ok: true, publicUser: owner };
}

/**
 * Resolve OTP account for citizen APIs. Prefer publicUserId from login; mobileNumber still supported.
 * If both are sent, they must match the same account.
 *
 * Backward compatibility: when only userId / user_id is sent (legacy dashboard), resolve the OTP
 * PublicUser from that id (direct account or household owner for a BeneficiaryPerson).
 *
 * @param {object} [options]
 * @param {string} [options.fallbackApplicantId] - e.g. :user_id path param when query has no anchor
 */
async function resolvePublicUserSessionFromRequest(req, options = {}) {
  const idRaw = sessionPublicUserIdFromReq(req);
  const mobile = sessionMobileFromReq(req);
  let legacyId = sessionLegacyApplicantIdFromReq(req);

  if (!idRaw && !mobile && !legacyId && options.fallbackApplicantId) {
    legacyId = String(options.fallbackApplicantId).trim() || null;
  }

  if (!idRaw && !mobile && legacyId) {
    return resolvePublicUserFromLegacyApplicantId(legacyId);
  }

  if (!idRaw && !mobile) {
    return {
      ok: false,
      status: 400,
      message:
        "Session anchor required: send publicUserId (PublicUser _id from login) or mobileNumber with each request.",
    };
  }

  if (idRaw && !mongoose.Types.ObjectId.isValid(idRaw)) {
    return { ok: false, status: 400, message: "Invalid publicUserId format." };
  }

  let user = null;
  if (idRaw) {
    user = await PublicUser.findById(idRaw);
    if (!user) {
      return { ok: false, status: 404, message: "Session account not found for publicUserId." };
    }
    if (mobile && user.contact?.mobile?.value !== mobile) {
      return {
        ok: false,
        status: 403,
        message: "mobileNumber does not match this publicUserId account.",
      };
    }
  } else {
    user = await PublicUser.findOne({ "contact.mobile.value": mobile });
    if (!user) {
      return { ok: false, status: 404, message: "User not found for this mobile number." };
    }
  }

  if (!user.status?.isActive || user.status?.isDeactivated) {
    return { ok: false, status: 403, message: "Your account is inactive. Please contact support." };
  }

  return { ok: true, publicUser: user };
}

module.exports = {
  normalizeIndianMobile,
  sessionPublicUserIdFromReq,
  sessionMobileFromReq,
  sessionLegacyApplicantIdFromReq,
  resolvePublicUserSessionFromRequest,
};
