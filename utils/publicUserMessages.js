/**
 * User-facing messages for public user verification status.
 * Frontend can display these when showing account status.
 */
function getAccountStatusMessage(verificationStatus) {
  const status = verificationStatus || "pending";
  if (status === "verified") return null;
  if (status === "rejected") return "Your account verification was rejected. Please contact support.";
  // Registration is OTP-based; no CSC center verification required.
  return null;
}

module.exports = { getAccountStatusMessage };
