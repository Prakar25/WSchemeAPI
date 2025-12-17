const express = require("express");
const router = express.Router();

// Health check route
router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

// Scheme routes
router.use("/schemes", require("./schemes"));

// Seed routes
router.use("/seed", require("./seed"));

// Public user lookup routes
router.use("/public-users", require("./publicUsers"));

// Admin user login routes
router.use("/admin-login", require("./adminUsers"));

module.exports = router;
