const express = require("express");
const router = express.Router();
const Application = require("../models/Application");
const Scheme = require("../models/Scheme");
const PublicUser = require("../models/PublicUser");
const adminAuth = require("../middleware/adminAuth");
const { checkEligibility } = require("../utils/eligibilityUtils");

// 1. Dashboard Statistics API
// GET /api/admin/dashboard/statistics
router.get("/statistics", adminAuth, async (req, res) => {
  try {
    // Aggregate applications by status
    const stats = await Application.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Initialize counts
    let totalApplicants = 0;
    let approved = 0;
    let pending = 0;
    let rejected = 0;

    // Map status values to counts
    stats.forEach((stat) => {
      const status = stat._id?.toLowerCase();
      if (status === "approved") {
        approved = stat.count;
      } else if (status === "pending") {
        pending = stat.count;
      } else if (status === "rejected") {
        rejected = stat.count;
      }
    });

    // Get total unique applicants (count distinct user_ids)
    const uniqueApplicants = await Application.distinct("user_id");
    totalApplicants = uniqueApplicants.length;

    res.status(200).json({
      status: "success",
      data: {
        totalApplicants: totalApplicants,
        approved: approved,
        pending: pending,
        rejected: rejected,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard statistics:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch dashboard statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 2. Scheme-wise Beneficiaries API
// GET /api/admin/dashboard/scheme-beneficiaries
router.get("/scheme-beneficiaries", adminAuth, async (req, res) => {
  try {
    const { search, limit = 50, skip = 0 } = req.query;
    const limitNum = parseInt(limit, 10);
    const skipNum = parseInt(skip, 10);

    // Build scheme query
    const schemeQuery = {};
    if (search) {
      schemeQuery.scheme_name = { $regex: search, $options: "i" };
    }

    // Get all schemes
    const schemes = await Scheme.find(schemeQuery)
      .select("_id scheme_name")
      .limit(limitNum)
      .skip(skipNum)
      .sort({ scheme_name: 1 });

    // Get scheme IDs
    const schemeIds = schemes.map((s) => s._id);

    // Aggregate applications by scheme and status
    const applicationStats = await Application.aggregate([
      {
        $match: {
          scheme_id: { $in: schemeIds },
        },
      },
      {
        $group: {
          _id: {
            scheme_id: "$scheme_id",
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // Process statistics into scheme-wise format
    const schemeStatsMap = new Map();

    schemes.forEach((scheme) => {
      schemeStatsMap.set(scheme._id.toString(), {
        schemeId: scheme._id.toString(),
        schemeName: scheme.scheme_name,
        totalBeneficiaries: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
      });
    });

    applicationStats.forEach((stat) => {
      const schemeId = stat._id.scheme_id.toString();
      const status = stat._id.status?.toLowerCase();
      const count = stat.count;

      if (schemeStatsMap.has(schemeId)) {
        const schemeStat = schemeStatsMap.get(schemeId);
        schemeStat.totalBeneficiaries += count;

        if (status === "approved") {
          schemeStat.approved = count;
        } else if (status === "pending") {
          schemeStat.pending = count;
        } else if (status === "rejected") {
          schemeStat.rejected = count;
        }
      }
    });

    // Convert map to array and sort by total beneficiaries (descending)
    const schemesWithStats = Array.from(schemeStatsMap.values()).sort(
      (a, b) => b.totalBeneficiaries - a.totalBeneficiaries
    );

    // Get total count for pagination
    const totalSchemes = await Scheme.countDocuments(schemeQuery);

    res.status(200).json({
      status: "success",
      data: {
        schemes: schemesWithStats,
        total: totalSchemes,
        limit: limitNum,
        skip: skipNum,
      },
    });
  } catch (error) {
    console.error("Error fetching scheme beneficiaries:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch scheme beneficiaries",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 3. Fraud Detection Alerts API
// GET /api/admin/dashboard/fraud-alerts
router.get("/fraud-alerts", adminAuth, async (req, res) => {
  try {
    const { limit = 10, type = "all", status = "active" } = req.query;
    const limitNum = parseInt(limit, 10);

    const alerts = [];

    // Detect duplicate applications
    if (type === "all" || type === "duplicate") {
      const duplicates = await Application.aggregate([
        {
          $group: {
            _id: {
              user_id: "$user_id",
              scheme_id: "$scheme_id",
            },
            applications: { $push: "$$ROOT" },
            count: { $sum: 1 },
          },
        },
        {
          $match: {
            count: { $gt: 1 },
          },
        },
        {
          $limit: limitNum,
        },
      ]);

      for (const dup of duplicates) {
        const user = await PublicUser.findById(dup._id.user_id).select(
          "demographics.fullName"
        );
        const scheme = await Scheme.findById(dup._id.scheme_id).select(
          "scheme_name"
        );

        // Get the most recent application
        const latestApp = dup.applications.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        )[0];

        alerts.push({
          alertId: `dup_${latestApp._id}`,
          type: "duplicate",
          title: "Duplicate Application",
          description: `Duplicate application detected for applicant: ${user?.demographics?.fullName || "Unknown"}`,
          applicantName: user?.demographics?.fullName || "Unknown",
          applicantId: dup._id.user_id.toString(),
          applicationId: latestApp._id.toString(),
          schemeId: dup._id.scheme_id.toString(),
          schemeName: scheme?.scheme_name || "Unknown",
          detectedAt: latestApp.createdAt || new Date(),
          status: "active",
          actionUrl: `/admin/applications/review/${latestApp._id}`,
        });
      }
    }

    // Detect ineligible claims
    if (type === "all" || type === "ineligible") {
      // Get all applications with their user and scheme data
      const applications = await Application.find({
        status: { $in: ["Applied", "Under Review", "Pending"] },
      })
        .populate("user_id", "demographics economicStatus")
        .populate("scheme_id", "scheme_name scheme_eligibility gender excluded_schemes")
        .limit(limitNum * 2) // Get more to filter
        .sort({ createdAt: -1 });

      for (const app of applications) {
        if (!app.user_id || !app.scheme_id) continue;

        const eligibilityResult = await checkEligibility(
          app.user_id, 
          app.scheme_id, 
          app.user_id._id.toString()
        );

        if (!eligibilityResult.eligible) {
          const user = app.user_id;
          const scheme = app.scheme_id;

          alerts.push({
            alertId: `ineligible_${app._id}`,
            type: "ineligible",
            title: "Ineligible Claim",
            description: `Ineligible claim detected for applicant: ${user.demographics?.fullName || "Unknown"}`,
            applicantName: user.demographics?.fullName || "Unknown",
            applicantId: user._id.toString(),
            applicationId: app._id.toString(),
            schemeId: scheme._id.toString(),
            schemeName: scheme.scheme_name || "Unknown",
            detectedAt: app.createdAt || new Date(),
            status: "active",
            actionUrl: `/admin/applications/investigate/${app._id}`,
          });

          // Limit ineligible alerts
          if (alerts.length >= limitNum) break;
        }
      }
    }

    // Filter by status if needed
    let filteredAlerts = alerts;
    if (status !== "all") {
      filteredAlerts = alerts.filter((alert) => alert.status === status);
    }

    // Sort by detection date (most recent first) and limit
    filteredAlerts.sort(
      (a, b) => new Date(b.detectedAt) - new Date(a.detectedAt)
    );
    filteredAlerts = filteredAlerts.slice(0, limitNum);

    res.status(200).json({
      status: "success",
      data: {
        alerts: filteredAlerts,
        total: filteredAlerts.length,
      },
    });
  } catch (error) {
    console.error("Error fetching fraud alerts:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch fraud alerts",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;

