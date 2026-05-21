const express = require("express");
const router = express.Router();
const PublicUser = require("../models/PublicUser");
const {
  assertApplicantAllowedForSession,
  householdIdString,
} = require("../utils/applicantResolver");
const { computeBeneficiaryKycLevel } = require("../utils/householdService");
const { buildKycFields } = require("../utils/kycStatus");
const { resolvePublicUserSessionFromRequest } = require("../utils/publicSessionAnchor");

async function loadSessionAndAssertProfile(req, res, applicantId) {
  const session = await resolvePublicUserSessionFromRequest(req, {
    fallbackApplicantId: applicantId,
  });
  if (!session.ok) {
    res.status(session.status).json({ error: session.message });
    return null;
  }
  const sessionUser = session.publicUser;
  const allowed = await assertApplicantAllowedForSession(sessionUser, applicantId);
  if (!allowed.ok) {
    res.status(allowed.status).json({ error: allowed.message });
    return null;
  }
  return { sessionUser, resolved: allowed.resolved };
}

function formatPublicUserProfile(user) {
  const maskedAadhaar = user.aadhaarNumber ? `**** **** ${user.aadhaarNumber.slice(-4)}` : null;
  const eligibilityStatus = user.economicStatus?.category || "Not Specified";
  return {
    user: {
      _id: user._id,
      beneficiaryPersonId: null,
      publicUserId: user._id,
      householdId: user.householdId || null,
      isPrimary: true,
      fullName: user.demographics?.fullName || null,
      aadhaarNumber: maskedAadhaar,
      aadhaarNumberFull: user.aadhaarNumber || null,
      eligibilityStatus,
      economicStatus: user.economicStatus || null,
      dob: user.demographics?.dob?.date || null,
      gender: user.demographics?.gender || null,
      photo: user.demographics?.photo || null,
      contact: {
        mobile: user.contact?.mobile || null,
        email: user.contact?.email || null,
      },
      address: user.address || null,
      ...buildKycFields(computeBeneficiaryKycLevel(user), user),
      cscVerificationStatus: user.status?.verificationStatus || "pending",
      status: user.status || null,
    },
  };
}

function formatBeneficiaryProfileLegacy(bp, accountUser) {
  const maskedAadhaar = bp.aadhaarNumber ? `**** **** ${bp.aadhaarNumber.slice(-4)}` : null;
  const eligibilityStatus =
    bp.economicStatus?.category || accountUser.economicStatus?.category || "Not Specified";
  return {
    user: {
      _id: bp._id,
      beneficiaryPersonId: bp._id,
      publicUserId: accountUser._id,
      householdId: householdIdString(bp.householdId),
      isPrimary: !!bp.isPrimary,
      fullName: bp.demographics?.fullName || null,
      aadhaarNumber: maskedAadhaar,
      aadhaarNumberFull: bp.aadhaarNumber || null,
      eligibilityStatus,
      economicStatus: bp.economicStatus || accountUser.economicStatus || null,
      dob: bp.demographics?.dob?.date || null,
      gender: bp.demographics?.gender || null,
      photo: bp.demographics?.photo || null,
      contact: {
        mobile: accountUser.contact?.mobile || null,
        email: bp.contact?.email || accountUser.contact?.email || null,
      },
      address: bp.address || null,
      ...buildKycFields(computeBeneficiaryKycLevel(bp), bp),
      cscVerificationStatus: accountUser.status?.verificationStatus || "pending",
      status: accountUser.status || null,
    },
  };
}

// GET /api/profile/:user_id - Get profile (PublicUser or household BeneficiaryPerson)
router.get("/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const ctx = await loadSessionAndAssertProfile(req, res, user_id);
    if (!ctx) return;

    if (ctx.resolved.kind === "PublicUser") {
      return res.status(200).json(formatPublicUserProfile(ctx.resolved.publicUser));
    }

    return res
      .status(200)
      .json(formatBeneficiaryProfileLegacy(ctx.resolved.person, ctx.sessionUser));
  } catch (error) {
    console.error("Error fetching profile:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid user ID",
      });
    }
    res.status(500).json({
      error: "Failed to fetch profile",
      message: error.message,
    });
  }
});

// GET /api/profile - Get profile by query param (alternative)
router.get("/", async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        error: "User ID is required",
      });
    }

    const ctx = await loadSessionAndAssertProfile(req, res, user_id);
    if (!ctx) return;

    if (ctx.resolved.kind === "PublicUser") {
      return res.status(200).json(formatPublicUserProfile(ctx.resolved.publicUser));
    }

    return res
      .status(200)
      .json(formatBeneficiaryProfileLegacy(ctx.resolved.person, ctx.sessionUser));
  } catch (error) {
    console.error("Error fetching profile:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid user ID",
      });
    }
    res.status(500).json({
      error: "Failed to fetch profile",
      message: error.message,
    });
  }
});

// PUT /api/profile/:user_id - Update user profile (PublicUser only; beneficiaries use /api/public-profile/update)
router.put("/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const updateData = { ...req.body };

    const ctx = await loadSessionAndAssertProfile(req, res, user_id);
    if (!ctx) return;

    if (ctx.resolved.kind === "BeneficiaryPerson") {
      return res.status(400).json({
        error:
          "Beneficiary profiles must be updated via PUT /api/public-profile/update with userId and mobileNumber.",
      });
    }

    if (updateData.aadhaarNumber) {
      delete updateData.aadhaarNumber;
    }
    delete updateData.mobileNumber;
    delete updateData.publicUserId;
    delete updateData.accountId;
    delete updateData.sessionUserId;

    const user = await PublicUser.findByIdAndUpdate(user_id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const maskedAadhaar = user.aadhaarNumber ? `**** **** ${user.aadhaarNumber.slice(-4)}` : null;
    const eligibilityStatus = user.economicStatus?.category || "Not Specified";

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        fullName: user.demographics?.fullName || null,
        aadhaarNumber: maskedAadhaar,
        eligibilityStatus,
        economicStatus: user.economicStatus || null,
        contact: {
          mobile: user.contact?.mobile || null,
          email: user.contact?.email || null,
        },
        address: user.address || null,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid user ID",
      });
    }
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(422).json({
        error: "Validation error",
        message: messages.join(", "),
      });
    }
    res.status(500).json({
      error: "Failed to update profile",
      message: error.message,
    });
  }
});

// PATCH /api/profile/:user_id/economic-status - PublicUser account only
router.patch("/:user_id/economic-status", async (req, res) => {
  try {
    const { user_id } = req.params;
    const { category, annualIncome } = req.body;

    const ctx = await loadSessionAndAssertProfile(req, res, user_id);
    if (!ctx) return;

    if (ctx.resolved.kind === "BeneficiaryPerson") {
      return res.status(400).json({
        error: "Update beneficiary economic data via /api/public-profile/update or household APIs.",
      });
    }

    const updateData = {};
    if (category) {
      updateData["economicStatus.category"] = category;
    }
    if (annualIncome !== undefined) {
      updateData["economicStatus.annualIncome"] = annualIncome;
    }

    const user = await PublicUser.findByIdAndUpdate(user_id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.status(200).json({
      message: "Economic status updated successfully",
      economicStatus: user.economicStatus,
    });
  } catch (error) {
    console.error("Error updating economic status:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid user ID",
      });
    }
    res.status(500).json({
      error: "Failed to update economic status",
      message: error.message,
    });
  }
});

module.exports = router;
