const Application = require("../models/Application");

/**
 * Normalize stored gender to a canonical bucket for eligibility.
 * DB/API values vary ("M", "Male", "male", "FEMALE", etc.); map consistently.
 * @returns {"male"|"female"|"other"|null} null = missing or unrecognized
 */
function normalizePersonGender(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim().toLowerCase().replace(/^\uFEFF/, "");
  if (!s) return null;
  if (s === "m" || s === "male" || s === "man") return "male";
  if (s === "f" || s === "female" || s === "woman" || s === "women") return "female";
  if (s === "o" || s === "other" || s === "others" || s === "transgender" || s === "trans") return "other";
  return null;
}

/**
 * How the scheme restricts applicants by gender (root `gender` or nested `scheme_eligibility.gender`).
 * @returns {"all"|"male"|"female"} — unknown strings default to "all" so legacy data is not bricked; prefer explicit values in admin.
 */
function normalizeSchemeGenderFilter(scheme) {
  const raw =
    scheme?.gender != null && String(scheme.gender).trim() !== ""
      ? String(scheme.gender).trim()
      : scheme?.scheme_eligibility?.gender != null
        ? String(scheme.scheme_eligibility.gender).trim()
        : "";
  if (!raw) return "all";
  const s = raw.toLowerCase().replace(/^\uFEFF/, "");
  if (s === "all" || s === "any" || s === "both" || s === "everyone") return "all";
  if (s === "m" || s === "male" || s === "man" || s === "men") return "male";
  if (s === "f" || s === "female" || s === "woman" || s === "women") return "female";
  // Word-boundary heuristics so "women" is not matched by /\bmen\b/, etc.
  if (/\b(women|woman|female|girls?|ladies)\b/i.test(raw) || /kanya|mahila/i.test(raw)) {
    return "female";
  }
  if (/\b(men|male|boys?)\b/i.test(raw) || /\bpurush\b/i.test(raw)) {
    return "male";
  }
  return "all";
}

// Helper function to calculate age from date of birth
function calculateAge(dob) {
  if (!dob) return null;
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Helper function to check if user has applied to excluded schemes
async function hasAppliedToExcludedSchemes(userIdOrIds, excludedSchemeIds) {
  const raw =
    userIdOrIds == null ? [] : Array.isArray(userIdOrIds) ? userIdOrIds : [userIdOrIds];
  const ids = raw.filter(Boolean).map((id) => (id && id.toString ? id.toString() : String(id)));
  const uniqueIds = [...new Set(ids)];
  if (!excludedSchemeIds || excludedSchemeIds.length === 0 || uniqueIds.length === 0) {
    return { hasApplied: false, appliedSchemeIds: [] };
  }

  // Check if any linked applicant id has applications for the excluded schemes
  const applications = await Application.find({
    user_id: { $in: uniqueIds },
    scheme_id: { $in: excludedSchemeIds },
    status: { $in: ["Applied", "Under Review", "Approved", "Pending", "Bioauthentication"] }, // Any active status
  }).select("scheme_id");

  const appliedSchemeIds = applications.map(app => app.scheme_id.toString());
  
  return {
    hasApplied: appliedSchemeIds.length > 0,
    appliedSchemeIds: appliedSchemeIds,
  };
}

// Helper function to check eligibility
async function checkEligibility(user, scheme, userId = null) {
  if (!user || !scheme) {
    return { eligible: false, reason: "Invalid user or scheme" };
  }

  const age = calculateAge(user.demographics?.dob?.date);
  if (age === null) {
    return { eligible: false, reason: "Age information not available" };
  }

  // Check age eligibility
  if (
    age < scheme.scheme_eligibility?.lower_age_limit ||
    age > scheme.scheme_eligibility?.upper_age_limit
  ) {
    return { eligible: false, reason: "Age requirement not met" };
  }

  // Check gender eligibility (normalized — was brittle on "Male"/"male" vs "M" and on missing scheme.gender)
  const schemeGender = normalizeSchemeGenderFilter(scheme);
  const applicantGender = normalizePersonGender(user.demographics?.gender);
  if (schemeGender !== "all") {
    if (!applicantGender) {
      return {
        eligible: false,
        reason: "Gender information not available — update your profile before applying.",
      };
    }
    if (applicantGender !== schemeGender) {
      return { eligible: false, reason: "Gender requirement not met" };
    }
  }

  // Check income eligibility if specified
  if (scheme.scheme_eligibility?.income_limit && user.economicStatus?.annualIncome) {
    if (user.economicStatus.annualIncome > scheme.scheme_eligibility.income_limit) {
      return { eligible: false, reason: "Income limit exceeded" };
    }
  }

  // Check economic category if specified
  if (scheme.scheme_eligibility?.economic_category && user.economicStatus?.category) {
    const requiredCategory = scheme.scheme_eligibility.economic_category;
    const userCategory = user.economicStatus.category;
    if (requiredCategory !== userCategory && !userCategory.includes(requiredCategory)) {
      return { eligible: false, reason: "Economic category requirement not met" };
    }
  }

  // Note: scheme_eligibility.custom_fields are informative (form field definitions), not used for eligibility
  // Only age (and income_limit, economic_category if present) are checked above

  // Check excluded schemes - if user has applied to any excluded scheme, they're ineligible
  if (scheme.excluded_schemes && scheme.excluded_schemes.length > 0 && userId) {
    const exclusionIds = Array.isArray(userId) ? userId : [userId];
    const excludedCheck = await hasAppliedToExcludedSchemes(exclusionIds, scheme.excluded_schemes);
    if (excludedCheck.hasApplied) {
      return { 
        eligible: false, 
        reason: `User has applied to incompatible scheme(s). Cannot apply to this scheme.` 
      };
    }
  }

  return { eligible: true };
}

module.exports = {
  calculateAge,
  hasAppliedToExcludedSchemes,
  checkEligibility,
  normalizePersonGender,
  normalizeSchemeGenderFilter,
};

