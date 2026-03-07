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

// Public user authentication routes (registration and login via mobile + OTP)
router.use("/public-auth", require("./publicAuth"));

// Public user profile routes (complete profile and document uploads)
router.use("/public-profile", require("./publicProfile"));

// Admin user login routes
router.use("/admin-login", require("./adminUsers"));

// Profile routes
router.use("/profile", require("./profile"));

// Admin dashboard routes
router.use("/admin/dashboard", require("./adminDashboard"));

// Admin profile routes
router.use("/admin/profile", require("./adminProfile"));

// Admin registration (public, no auth)
router.use("/admin-register", require("./adminRegister"));

// Admin verification (pending-admins, verify-admin) - mount after specific /admin/* paths
router.use("/admin", require("./adminVerification"));

// CSDAdmin verification - verify public users (pending-public-users, verify-public-user)
router.use("/csd", require("./csdVerification"));

// Application routes
router.use("/applications", require("./applications"));

// Category routes
router.use("/categories", require("./categories"));

// Department routes
router.use("/departments", require("./departments"));

// Bulk upload routes
router.use("/bulk-upload", require("./bulkUpload"));

// Ads routes (public + admin)
router.use("/ads", require("./ads"));

module.exports = router;
