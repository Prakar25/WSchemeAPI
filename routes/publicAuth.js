const express = require("express");
const router = express.Router();
const PublicUser = require("../models/PublicUser");
const { requestOTP, verifyOTP } = require("../utils/otpService");
const { getAccountStatusMessage } = require("../utils/publicUserMessages");
const crypto = require("crypto");

/**
 * POST /api/public-auth/register/send-otp
 * Request OTP for registration
 * Body: { mobileNumber: string }
 */
router.post("/register/send-otp", async (req, res) => {
  try {
    const { mobileNumber } = req.body;

    if (!mobileNumber) {
      return res.status(400).json({
        status: "error",
        message: "Mobile number is required",
      });
    }

    // Check if user already exists
    const existingUser = await PublicUser.findOne({
      "contact.mobile.value": mobileNumber.trim(),
    });

    if (existingUser) {
      return res.status(400).json({
        status: "error",
        message: "User with this mobile number already exists. Please login instead.",
      });
    }

    // Request OTP
    const result = await requestOTP(mobileNumber.trim(), "register");

    if (!result.success) {
      return res.status(400).json({
        status: "error",
        message: result.message,
      });
    }

    // In development, include OTP in response for testing
    const response = {
      status: "success",
      message: result.message,
    };

    if (process.env.NODE_ENV !== "production" && result.otp) {
      response.otp = result.otp; // Only in development
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("Registration OTP request error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

/**
 * POST /api/public-auth/register/verify-otp
 * Verify OTP and create user account
 * Body: { mobileNumber: string, otp: string, fullName?: string, email?: string }
 */
router.post("/register/verify-otp", async (req, res) => {
  try {
    const { mobileNumber, otp, fullName, email } = req.body;

    if (!mobileNumber || !otp) {
      return res.status(400).json({
        status: "error",
        message: "Mobile number and OTP are required",
      });
    }

    // Verify OTP
    const verification = verifyOTP(mobileNumber.trim(), otp.trim(), "register");

    if (!verification.valid) {
      return res.status(400).json({
        status: "error",
        message: verification.message,
      });
    }

    // Check if user already exists (double-check)
    const existingUser = await PublicUser.findOne({
      "contact.mobile.value": mobileNumber.trim(),
    });

    if (existingUser) {
      return res.status(400).json({
        status: "error",
        message: "User with this mobile number already exists. Please login instead.",
      });
    }

    // Create new user
    const newUser = new PublicUser({
      contact: {
        mobile: {
          value: mobileNumber.trim(),
          verified: true, // Verified via OTP
        },
        email: email
          ? {
              value: email.trim().toLowerCase(),
              verified: false,
            }
          : undefined,
      },
      demographics: fullName
        ? {
            fullName: fullName.trim(),
          }
        : undefined,
      kycLevel: "BASIC",
      status: {
        isActive: true,
        isDeactivated: false,
        verificationStatus: "verified", // OTP is sufficient; no CSC verification required
        verifiedBy: null,
        verifiedAt: new Date(),
        rejectionReason: null,
      },
      authentication: {
        lastAuthAt: new Date(),
        authMethodsUsed: ["OTP"],
      },
    });

    await newUser.save();

    // Return user data (without sensitive info)
    const verificationStatus = newUser.status?.verificationStatus || "pending";
    const responseUser = {
      _id: newUser._id,
      userId: newUser._id,
      fullName: newUser.demographics?.fullName || null,
      contactEmail: newUser.contact?.email?.value || null,
      phoneNumber: newUser.contact?.mobile?.value || null,
      address: newUser.address || null,
      dob: newUser.demographics?.dob?.date || null,
      aadhaarNumber: newUser.aadhaarNumber || null,
      gender: newUser.demographics?.gender || null,
      verificationStatus,
      accountStatusMessage: getAccountStatusMessage(verificationStatus),
    };

    return res.status(201).json({
      status: "success",
      message: "Registration successful",
      user: responseUser,
    });
  } catch (error) {
    console.error("Registration verification error:", error);

    // Handle duplicate key error (mobile number)
    if (error.code === 11000) {
      return res.status(400).json({
        status: "error",
        message: "User with this mobile number already exists. Please login instead.",
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

/**
 * POST /api/public-auth/login/send-otp
 * Request OTP for login
 * Body: { mobileNumber: string }
 */
router.post("/login/send-otp", async (req, res) => {
  try {
    const { mobileNumber } = req.body;

    if (!mobileNumber) {
      return res.status(400).json({
        status: "error",
        message: "Mobile number is required",
      });
    }

    // Check if user exists
    const user = await PublicUser.findOne({
      "contact.mobile.value": mobileNumber.trim(),
    });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found. Please register first.",
      });
    }

    // Check if user is active
    if (!user.status?.isActive || user.status?.isDeactivated) {
      return res.status(403).json({
        status: "error",
        message: "Your account is inactive. Please contact support.",
      });
    }

    // Request OTP
    const result = await requestOTP(mobileNumber.trim(), "login");

    if (!result.success) {
      return res.status(400).json({
        status: "error",
        message: result.message,
      });
    }

    // In development, include OTP in response for testing
    const response = {
      status: "success",
      message: result.message,
    };

    if (process.env.NODE_ENV !== "production" && result.otp) {
      response.otp = result.otp; // Only in development
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("Login OTP request error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

/**
 * POST /api/public-auth/login/verify-otp
 * Verify OTP and login user
 * Body: { mobileNumber: string, otp: string }
 */
router.post("/login/verify-otp", async (req, res) => {
  try {
    const { mobileNumber, otp } = req.body;

    if (!mobileNumber || !otp) {
      return res.status(400).json({
        status: "error",
        message: "Mobile number and OTP are required",
      });
    }

    // Verify OTP
    const verification = verifyOTP(mobileNumber.trim(), otp.trim(), "login");

    if (!verification.valid) {
      return res.status(400).json({
        status: "error",
        message: verification.message,
      });
    }

    // Find user
    const user = await PublicUser.findOne({
      "contact.mobile.value": mobileNumber.trim(),
    });

    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found. Please register first.",
      });
    }

    // Check if user is active
    if (!user.status?.isActive || user.status?.isDeactivated) {
      return res.status(403).json({
        status: "error",
        message: "Your account is inactive. Please contact support.",
      });
    }

    // Update last authentication time and method
    user.authentication.lastAuthAt = new Date();
    if (!user.authentication.authMethodsUsed.includes("OTP")) {
      user.authentication.authMethodsUsed.push("OTP");
    }
    await user.save();

    // Return user data (without sensitive info)
    const verificationStatus = user.status?.verificationStatus || "pending";
    const responseUser = {
      _id: user._id,
      userId: user._id,
      fullName: user.demographics?.fullName || null,
      contactEmail: user.contact?.email?.value || null,
      phoneNumber: user.contact?.mobile?.value || null,
      address: user.address || null,
      dob: user.demographics?.dob?.date || null,
      aadhaarNumber: user.aadhaarNumber || null,
      gender: user.demographics?.gender || null,
      verificationStatus,
      accountStatusMessage: getAccountStatusMessage(verificationStatus),
    };

    return res.status(200).json({
      status: "success",
      message: "Login successful",
      user: responseUser,
    });
  } catch (error) {
    console.error("Login verification error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

module.exports = router;
