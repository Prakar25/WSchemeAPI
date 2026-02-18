const express = require("express");
const router = express.Router();
const PublicUser = require("../models/PublicUser");

// GET /api/profile/:user_id - Get user profile
router.get("/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const user = await PublicUser.findById(user_id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // Format response for dashboard
    const maskedAadhaar = user.aadhaarNumber ? `**** **** ${user.aadhaarNumber.slice(-4)}` : null;
    const eligibilityStatus = user.economicStatus?.category || "Not Specified";

    res.status(200).json({
      user: {
        _id: user._id,
        fullName: user.demographics?.fullName || null,
        aadhaarNumber: maskedAadhaar,
        aadhaarNumberFull: user.aadhaarNumber || null, // Include full for internal use
        eligibilityStatus: eligibilityStatus,
        economicStatus: user.economicStatus || null,
        dob: user.demographics?.dob?.date || null,
        gender: user.demographics?.gender || null,
        photo: user.demographics?.photo || null,
        contact: {
          mobile: user.contact?.mobile || null,
          email: user.contact?.email || null,
        },
        address: user.address || null,
        kycLevel: user.kycLevel || "BASIC",
        status: user.status || null,
      },
    });
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

    const user = await PublicUser.findById(user_id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // Format response for dashboard
    const maskedAadhaar = user.aadhaarNumber ? `**** **** ${user.aadhaarNumber.slice(-4)}` : null;
    const eligibilityStatus = user.economicStatus?.category || "Not Specified";

    res.status(200).json({
      user: {
        _id: user._id,
        fullName: user.demographics?.fullName || null,
        aadhaarNumber: maskedAadhaar,
        aadhaarNumberFull: user.aadhaarNumber || null,
        eligibilityStatus: eligibilityStatus,
        economicStatus: user.economicStatus || null,
        dob: user.demographics?.dob?.date || null,
        gender: user.demographics?.gender || null,
        photo: user.demographics?.photo || null,
        contact: {
          mobile: user.contact?.mobile || null,
          email: user.contact?.email || null,
        },
        address: user.address || null,
        kycLevel: user.kycLevel || "BASIC",
        status: user.status || null,
      },
    });
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

// PUT /api/profile/:user_id - Update user profile
router.put("/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const updateData = req.body;

    // Don't allow updating Aadhaar number
    if (updateData.aadhaarNumber) {
      delete updateData.aadhaarNumber;
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

    // Format response
    const maskedAadhaar = user.aadhaarNumber ? `**** **** ${user.aadhaarNumber.slice(-4)}` : null;
    const eligibilityStatus = user.economicStatus?.category || "Not Specified";

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        fullName: user.demographics?.fullName || null,
        aadhaarNumber: maskedAadhaar,
        eligibilityStatus: eligibilityStatus,
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

// PATCH /api/profile/:user_id/economic-status - Update economic status specifically
router.patch("/:user_id/economic-status", async (req, res) => {
  try {
    const { user_id } = req.params;
    const { category, annualIncome } = req.body;

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

