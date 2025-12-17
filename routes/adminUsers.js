const express = require("express");
const router = express.Router();
const AdminUser = require("../models/AdminUser");

// POST /api/admin-login
// Accepts credentials in body or query: { username, password }
router.post("/", async (req, res) => {
  const username = (req.body?.username || req.query?.username || "")
    .trim()
    .toLowerCase();
  const password = (req.body?.password || req.query?.password || "").trim();

  if (!username || !password) {
    return res.status(400).json({
      status: "error",
      message: "username and password are required",
    });
  }

  try {
    const user = await AdminUser.findOne({ username });

    if (!user || user.password !== password) {
      return res.status(401).json({
        status: "unauthorized",
        message: "Invalid credentials",
      });
    }

    return res.status(200).json({
      status: "success",
      user: {
        fullName: user.fullName,
        username: user.username,
        contactNumber: user.contactNumber,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

module.exports = router;
