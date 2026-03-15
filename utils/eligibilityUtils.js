const Application = require("../models/Application");

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
async function hasAppliedToExcludedSchemes(userId, excludedSchemeIds) {
  if (!excludedSchemeIds || excludedSchemeIds.length === 0 || !userId) {
    return { hasApplied: false, appliedSchemeIds: [] };
  }

  // Check if user has any applications for the excluded schemes
  const applications = await Application.find({
    user_id: userId,
    scheme_id: { $in: excludedSchemeIds },
    status: { $in: ["Applied", "Under Review", "Approved", "Pending"] }, // Any active status
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

  // Check gender eligibility
  const userGender = user.demographics?.gender === "M" ? "Male" : 
                     user.demographics?.gender === "F" ? "Female" : "Other";
  const schemeGender = scheme.gender?.toLowerCase();
  if (schemeGender && schemeGender !== "all" && schemeGender !== userGender.toLowerCase()) {
    return { eligible: false, reason: "Gender requirement not met" };
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
    const excludedCheck = await hasAppliedToExcludedSchemes(userId, scheme.excluded_schemes);
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
};

