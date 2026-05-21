/**
 * CSC / household verification messages (bio-auth queue). Not profile KYC.
 */
function getCscVerificationMessage(verificationStatus) {
  const status = verificationStatus || "pending";
  if (status === "verified") return null;
  if (status === "rejected") {
    return "CSC verification was rejected. Please contact support or visit your CSC center.";
  }
  if (status === "pending") {
    return "CSC verification is pending. You can still complete profile KYC in the app.";
  }
  return null;
}

/** @deprecated Use getCscVerificationMessage — name kept for existing imports */
function getAccountStatusMessage(verificationStatus) {
  return getCscVerificationMessage(verificationStatus);
}

module.exports = {
  getAccountStatusMessage,
  getCscVerificationMessage,
};
