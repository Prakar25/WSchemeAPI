/**
 * Profile KYC (BASIC / PARTIAL / FULL) is separate from CSC / household verificationStatus.
 */

function getKycStatusMessage(kycLevel) {
  if (kycLevel === "FULL") return null;
  if (kycLevel === "PARTIAL") {
    return (
      "Complete all required profile fields for full KYC: Aadhaar, date of birth, gender, " +
      "locality, district, state, and 6-digit pincode."
    );
  }
  return "Add profile details (name and basic information) to begin KYC.";
}

function getBeneficiaryKycMissingFields(bp) {
  const missing = [];
  if (!bp?.aadhaarNumber) missing.push("aadhaarNumber");
  if (!bp?.demographics?.fullName) missing.push("fullName");
  if (!bp?.demographics?.dob?.date) missing.push("dob");
  if (!bp?.demographics?.gender) missing.push("gender");
  if (!bp?.address?.locality) missing.push("locality");
  if (!bp?.address?.district) missing.push("district");
  if (!bp?.address?.state) missing.push("state");
  if (!bp?.address?.pincode) missing.push("pincode");
  return missing;
}

function buildKycFields(kycLevel, bp) {
  const isKycFull = kycLevel === "FULL";
  return {
    kycLevel,
    isKycFull,
    kycMissingFields: isKycFull ? [] : getBeneficiaryKycMissingFields(bp),
    kycStatusMessage: getKycStatusMessage(kycLevel),
  };
}

module.exports = {
  getKycStatusMessage,
  getBeneficiaryKycMissingFields,
  buildKycFields,
};
