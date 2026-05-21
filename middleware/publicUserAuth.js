const { assertApplicantAllowedForSession } = require("../utils/applicantResolver");
const { resolvePublicUserSessionFromRequest } = require("../utils/publicSessionAnchor");

/**
 * Identify the logged-in OTP account and optional "acting as" applicant.
 *
 * Session anchor (one required): `publicUserId` (PublicUser _id from login) OR `mobileNumber`
 * in query and/or body. Aliases: `accountId`, `sessionUserId`.
 * For multipart routes, put the anchor + optional `userId` in the query string.
 *
 * Optional `userId`: PublicUser._id (same account) or BeneficiaryPerson._id in this household.
 */
const publicUserAuth = async (req, res, next) => {
  try {
    const requestedApplicantId = req.query?.userId ?? req.body?.userId;

    const session = await resolvePublicUserSessionFromRequest(req);
    if (!session.ok) {
      return res.status(session.status).json({ status: "error", message: session.message });
    }
    const sessionUser = session.publicUser;

    let beneficiaryPerson = null;

    if (requestedApplicantId) {
      const assert = await assertApplicantAllowedForSession(sessionUser, requestedApplicantId);
      if (!assert.ok) {
        return res.status(assert.status).json({ status: "error", message: assert.message });
      }
      if (assert.resolved.kind === "BeneficiaryPerson") {
        beneficiaryPerson = assert.resolved.person;
      }
      if (process.env.LOG_PUBLIC_APPLICANT_SESSION === "1") {
        console.log(
          `[publicUserAuth] account=${sessionUser._id} actingAs=${requestedApplicantId} kind=${assert.resolved.kind}`
        );
      }
    }

    req.publicUser = sessionUser;
    req.beneficiaryPerson = beneficiaryPerson;
    req.userId = beneficiaryPerson?._id || sessionUser._id;
    next();
  } catch (error) {
    console.error("Public user auth middleware error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

module.exports = publicUserAuth;
