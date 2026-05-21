const PublicUser = require("../models/PublicUser");
const BeneficiaryPerson = require("../models/BeneficiaryPerson");
const Household = require("../models/Household");

function householdIdString(ref) {
  if (!ref) return null;
  if (typeof ref === "object" && ref._id) return String(ref._id);
  return String(ref);
}

/**
 * Resolve an applicant id to either BeneficiaryPerson or PublicUser.
 * ObjectIds never collide across collections, but we still return explicit kind.
 */
async function resolveApplicantById(id) {
  if (!id) return null;
  const person = await BeneficiaryPerson.findById(id).populate("householdId");
  if (person) {
    return { kind: "BeneficiaryPerson", person, household: person.householdId, publicUser: null };
  }
  const publicUser = await PublicUser.findById(id);
  if (publicUser) {
    return { kind: "PublicUser", person: null, household: null, publicUser };
  }
  return null;
}

/**
 * Ensure requestedApplicantId (PublicUser or BeneficiaryPerson) belongs to the OTP session account.
 * BeneficiaryPerson must live on a household owned by sessionPublicUser.
 */
async function assertApplicantAllowedForSession(sessionPublicUser, requestedApplicantId) {
  if (!sessionPublicUser?._id) {
    return { ok: false, status: 401, message: "Session account is required." };
  }
  if (!requestedApplicantId) {
    return { ok: false, status: 400, message: "Applicant id is required." };
  }

  const resolved = await resolveApplicantById(requestedApplicantId);
  if (!resolved) {
    return { ok: false, status: 404, message: "Applicant not found." };
  }

  if (resolved.kind === "PublicUser") {
    if (String(resolved.publicUser._id) !== String(sessionPublicUser._id)) {
      return {
        ok: false,
        status: 403,
        message: "This profile does not belong to the signed-in mobile account.",
      };
    }
    return { ok: true, resolved };
  }

  let household = resolved.household;
  if (!household?.publicUserId) {
    household = await Household.findById(householdIdString(resolved.person.householdId))
      .select("publicUserId")
      .lean();
  }
  const ownerId = household?.publicUserId ? String(household.publicUserId) : null;
  if (!ownerId || ownerId !== String(sessionPublicUser._id)) {
    return {
      ok: false,
      status: 403,
      message: "Applicant is not linked to the signed-in mobile account.",
    };
  }

  const personHouseholdId = householdIdString(resolved.person.householdId);
  const sessionHouseholdId = householdIdString(sessionPublicUser.householdId);
  if (sessionHouseholdId && personHouseholdId !== sessionHouseholdId) {
    return {
      ok: false,
      status: 403,
      message: "Applicant is not in this account household.",
    };
  }

  return { ok: true, resolved };
}

/**
 * Shape used by eligibility helpers (expects demographics.dob.date, demographics.gender, address, economicStatus, aadhaarNumber, status.verificationStatus).
 */
function toEligibilitySubject(resolved) {
  if (!resolved) return null;
  if (resolved.kind === "PublicUser") return resolved.publicUser;

  const p = resolved.person;
  const h = resolved.household;
  return {
    _id: p._id,
    demographics: p.demographics,
    address: p.address,
    economicStatus: p.economicStatus,
    aadhaarNumber: p.aadhaarNumber,
    status: {
      verificationStatus: h?.status?.verificationStatus || "verified",
      isActive: h?.status?.isActive !== false,
      isDeactivated: !!h?.status?.isDeactivated,
    },
  };
}

function applicantRefModelForResolved(resolved) {
  if (!resolved) return "PublicUser";
  return resolved.kind === "BeneficiaryPerson" ? "BeneficiaryPerson" : "PublicUser";
}

/**
 * PublicUser account linked to an application (for CSC / bio-auth flags on the OTP account).
 */
async function getPublicUserAccountForApplication(app) {
  if (!app?.user_id) return null;
  const model = app.applicant_ref_model || "PublicUser";
  if (model === "BeneficiaryPerson") {
    const pid = app.user_id._id || app.user_id;
    const person = await BeneficiaryPerson.findById(pid).select("householdId");
    if (!person?.householdId) return null;
    const h = await Household.findById(person.householdId).select("publicUserId");
    if (!h?.publicUserId) return null;
    return PublicUser.findById(h.publicUserId);
  }
  return PublicUser.findById(app.user_id._id || app.user_id);
}

/**
 * Applicant ObjectIds to use when checking excluded_schemes (legacy PublicUser apps + new BeneficiaryPerson apps).
 */
function getApplicantIdsForExcludedSchemesCheck(resolved) {
  if (!resolved) return [];
  if (resolved.kind === "PublicUser" && resolved.publicUser?._id) {
    return [resolved.publicUser._id];
  }
  if (resolved.kind === "BeneficiaryPerson") {
    const ids = [];
    if (resolved.person?._id) ids.push(resolved.person._id);
    const pubId = resolved.household?.publicUserId;
    if (pubId) ids.push(pubId);
    return ids;
  }
  return [];
}

async function getApplicantVerificationStatusForApplication(app) {
  const model = app.applicant_ref_model || "PublicUser";
  if (model === "BeneficiaryPerson") {
    const pid = app.user_id?._id || app.user_id;
    const person = await BeneficiaryPerson.findById(pid).select("householdId");
    if (!person?.householdId) return "pending";
    const h = await Household.findById(person.householdId).select("status.verificationStatus");
    return h?.status?.verificationStatus || "pending";
  }
  const uid = app.user_id?._id || app.user_id;
  const u = await PublicUser.findById(uid).select("status.verificationStatus");
  return u?.status?.verificationStatus || "pending";
}

module.exports = {
  householdIdString,
  resolveApplicantById,
  assertApplicantAllowedForSession,
  toEligibilitySubject,
  applicantRefModelForResolved,
  getPublicUserAccountForApplication,
  getApplicantIdsForExcludedSchemesCheck,
  getApplicantVerificationStatusForApplication,
};
