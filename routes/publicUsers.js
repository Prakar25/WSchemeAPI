const express = require("express");
const router = express.Router();
const PublicUser = require("../models/PublicUser");

// Shared handler for query or path param
const handleLookup = async (req, res) => {
  const aadhaarNumber = String(
    (req.query.aadhaarNumber || req.params.aadhaarNumber || "").trim()
  );

  // Basic validation: must be 12 digits
  if (!/^\d{12}$/.test(aadhaarNumber)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid Aadhaar number. It must be a 12-digit number.",
      user: null,
    });
  }

  try {
    const user = await PublicUser.findOne({ aadhaarNumber });

    if (!user) {
      return res.status(404).json({
        status: "not_found",
        message: "Aadhaar record not found",
        user: null,
      });
    }

    const responseUser = {
      _id: user._id || null,
      userId: user._id || null, // Alias for convenience
      fullName: user.demographics?.fullName || null,
      contactEmail: user.contact?.email?.value || null,
      phoneNumber: user.contact?.mobile?.value || null,
      address: user.address || null,
      dob: user.demographics?.dob?.date || null,
      aadhaarNumber: user.aadhaarNumber || null,
      gender: user.demographics?.gender || null,
    };

    return res.status(200).json({
      status: "success",
      user: responseUser,
    });
  } catch (error) {
    console.error("Aadhaar lookup error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
      user: null,
    });
  }
};

// GET /api/public-users?aadhaarNumber=XXXXXXXXXXXX
router.get("/", handleLookup);

// GET /api/public-users/:aadhaarNumber (path param support)
router.get("/:aadhaarNumber", handleLookup);

module.exports = router;
