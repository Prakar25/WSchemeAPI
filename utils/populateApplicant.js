/**
 * Populate Application.user_id using applicant_ref_model (PublicUser | BeneficiaryPerson).
 */
function populateApplicant(select) {
  const o = { path: "user_id", refPath: "applicant_ref_model" };
  if (select) o.select = select;
  return o;
}

/**
 * Nested populate so BeneficiaryPerson includes household (for mobile + verificationStatus).
 */
function populateApplicantWithHousehold(select) {
  const o = {
    path: "user_id",
    refPath: "applicant_ref_model",
    populate: { path: "householdId", select: "contact.mobile status publicUserId" },
  };
  if (select) o.select = select;
  return o;
}

module.exports = { populateApplicant, populateApplicantWithHousehold };
