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

// Admin roles routes
router.use("/admin-roles", require("./adminRoles"));

// Seed routes
router.use("/seed", require("./seed"));

// Public user lookup routes
router.use("/public-users", require("./publicUsers"));

// Admin user login routes
router.use("/admin-login", require("./adminUsers"));

// Profile routes
router.use("/profile", require("./profile"));

// Admin dashboard routes
router.use("/admin/dashboard", require("./adminDashboard"));

// Admin profile routes
router.use("/admin/profile", require("./adminProfile"));

// Application routes
router.use("/applications", require("./applications"));

// Category routes
router.use("/categories", require("./categories"));

// Department routes
router.use("/departments", require("./departments"));

// Bulk upload routes
router.use("/bulk-upload", require("./bulkUpload"));

module.exports = router;
