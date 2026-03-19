const express = require("express");
const router = express.Router();
const Application = require("../models/Application");
const Scheme = require("../models/Scheme");
const PublicUser = require("../models/PublicUser");
const FraudCheckRun = require("../models/FraudCheckRun");
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
      } else if (status === "pending" || status === "applied" || status === "under review") {
        // For KPI cards: treat Applied + Under Review as "pending"
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
        } else if (status === "pending" || status === "applied" || status === "under review") {
          // Treat Applied + Under Review as "pending" for dashboard counts.
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

// 4. Fraud check run history (scheduled job results)
// GET /api/admin/dashboard/fraud-check-runs
router.get("/fraud-check-runs", adminAuth, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);

    const runs = await FraudCheckRun.find()
      .sort({ runAt: -1 })
      .limit(limitNum)
      .select("runAt duplicatesFound ineligibleFound status errorMessage durationMs alerts");

    res.status(200).json({
      status: "success",
      data: { runs },
    });
  } catch (error) {
    console.error("Error fetching fraud check runs:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch fraud check runs",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 5. Manual fraud check trigger
// POST /api/admin/dashboard/fraud-check/run
router.post("/fraud-check/run", adminAuth, async (req, res) => {
  try {
    const { runFraudCheck } = require("../jobs/fraudCheck");
    runFraudCheck();
    res.status(202).json({
      status: "success",
      message: "Fraud check started. Results will be stored in fraud-check-runs.",
    });
  } catch (error) {
    console.error("Error triggering fraud check:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to trigger fraud check",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// ----------------------------
// Analytics endpoints (charts)
// ----------------------------

function parseDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function bucketKeyExpression(granularity) {
  // MongoDB $dateToString formats
  // - day: YYYY-MM-DD
  // - week: ISO year + ISO week number (YYYY-Www)
  if (String(granularity).toLowerCase() === "week") {
    return { $dateToString: { format: "%G-W%V", date: "$createdAt" } };
  }
  // default: day
  return { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
}

// GET /api/admin/dashboard/analytics/applications-trends
// Returns: { labels: [], series: { created:[], approved:[], rejected:[] } }
router.get("/analytics/applications-trends", adminAuth, async (req, res) => {
  try {
    const { from, to, granularity = "day" } = req.query;
    const fromDate = parseDateOrNull(from);
    const toDate = parseDateOrNull(to);

    if (!fromDate || !toDate) {
      return res.status(400).json({
        status: "error",
        message: "from and to query params are required (YYYY-MM-DD).",
      });
    }

    // Ensure inclusive end date
    const toInclusive = new Date(toDate);
    toInclusive.setHours(23, 59, 59, 999);

    const bucketExpr = bucketKeyExpression(granularity);
    const matches = {
      createdAt: { $gte: fromDate, $lte: toInclusive },
    };

    const grouped = await Application.aggregate([
      { $match: matches },
      {
        $group: {
          _id: { bucket: bucketExpr, status: "$status" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.bucket": 1 } },
    ]);

    const labelSet = new Set();
    const createdByBucket = new Map();
    const approvedByBucket = new Map();
    const rejectedByBucket = new Map();

    for (const row of grouped) {
      const bucket = row._id.bucket;
      const status = String(row._id.status || "").toLowerCase();
      const count = row.count || 0;

      labelSet.add(bucket);
      createdByBucket.set(bucket, (createdByBucket.get(bucket) || 0) + count);

      if (status === "approved") {
        approvedByBucket.set(bucket, (approvedByBucket.get(bucket) || 0) + count);
      }
      if (status === "rejected") {
        rejectedByBucket.set(bucket, (rejectedByBucket.get(bucket) || 0) + count);
      }
    }

    const labels = Array.from(labelSet).sort();
    const series = {
      created: labels.map((l) => createdByBucket.get(l) || 0),
      approved: labels.map((l) => approvedByBucket.get(l) || 0),
      rejected: labels.map((l) => rejectedByBucket.get(l) || 0),
    };

    return res.status(200).json({
      status: "success",
      data: { labels, series },
    });
  } catch (error) {
    console.error("applications-trends error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch applications trends",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/admin/dashboard/analytics/stage-breakdown
// Returns: { stages: [{ stage, stageKey, count, stageLabel }] }
router.get("/analytics/stage-breakdown", adminAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = parseDateOrNull(from);
    const toDate = parseDateOrNull(to);

    const match = {};
    if (fromDate && toDate) {
      const toInclusive = new Date(toDate);
      toInclusive.setHours(23, 59, 59, 999);
      match.createdAt = { $gte: fromDate, $lte: toInclusive };
    }

    const grouped = await Application.aggregate([
      Object.keys(match).length ? { $match: match } : { $match: {} },
      { $group: { _id: "$verification_level", count: { $sum: 1 } } },
    ]);

    // Map verification levels to the UI-friendly stage names
    const stageOrder = [
      "Applied",
      "CSD_Admin_Review",
      "Post_Operator_Review",
      "Admin_Review",
      "District_Head_Review",
      "Department_Review",
      "Secretary_Review",
      "Completed",
    ];

    const stageKeyByStage = {
      Applied: "Level_0",
      CSD_Admin_Review: "Level_9_Review",
      Post_Operator_Review: "Level_7_8_Review",
      Admin_Review: "Level_1_2_Review",
      District_Head_Review: "Level_6_Review",
      Department_Review: "Level_4_5_Review",
      Secretary_Review: "Level_3_Review",
      Completed: "Level_99_Review",
    };

    const countsByStage = new Map();
    for (const row of grouped) {
      const level = row._id;
      const stage = Application.getStageNameFromLevel(level);
      const count = row.count || 0;
      countsByStage.set(stage, (countsByStage.get(stage) || 0) + count);
    }

    const stages = stageOrder.map((stage) => ({
      stage,
      stageKey: stageKeyByStage[stage] || stage,
      stageLabel: stage.replaceAll("_", " "),
      count: countsByStage.get(stage) || 0,
    }));

    return res.status(200).json({
      status: "success",
      data: { stages },
    });
  } catch (error) {
    console.error("stage-breakdown error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch stage breakdown",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/admin/dashboard/analytics/fraud-trends
// Uses stored FraudCheckRun results
router.get("/analytics/fraud-trends", adminAuth, async (req, res) => {
  try {
    const { from, to, granularity = "day" } = req.query;
    const fromDate = parseDateOrNull(from);
    const toDate = parseDateOrNull(to);

    if (!fromDate || !toDate) {
      return res.status(400).json({
        status: "error",
        message: "from and to query params are required (YYYY-MM-DD).",
      });
    }

    const toInclusive = new Date(toDate);
    toInclusive.setHours(23, 59, 59, 999);

    const bucket =
      String(granularity).toLowerCase() === "week"
        ? { $dateToString: { format: "%G-W%V", date: "$runAt" } }
        : { $dateToString: { format: "%Y-%m-%d", date: "$runAt" } };

    const grouped = await FraudCheckRun.aggregate([
      {
        $match: {
          status: "success",
          runAt: { $gte: fromDate, $lte: toInclusive },
        },
      },
      {
        $group: {
          _id: bucket,
          duplicates: { $sum: "$duplicatesFound" },
          ineligible: { $sum: "$ineligibleFound" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const labels = grouped.map((g) => g._id);
    const duplicateSeries = grouped.map((g) => g.duplicates || 0);
    const ineligibleSeries = grouped.map((g) => g.ineligible || 0);
    const totalSeries = labels.map((_, i) => duplicateSeries[i] + ineligibleSeries[i]);

    return res.status(200).json({
      status: "success",
      data: {
        labels,
        series: {
          total: totalSeries,
          duplicate: duplicateSeries,
          ineligible: ineligibleSeries,
        },
      },
    });
  } catch (error) {
    console.error("fraud-trends error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch fraud trends",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/admin/dashboard/analytics/rejection-reasons
// Returns: { reasons: [{ reason, count }] }
router.get("/analytics/rejection-reasons", adminAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = parseDateOrNull(from);
    const toDate = parseDateOrNull(to);

    const matchStage = {};
    if (fromDate && toDate) {
      const toInclusive = new Date(toDate);
      toInclusive.setHours(23, 59, 59, 999);
      matchStage["verification_history.verified_at"] = { $gte: fromDate, $lte: toInclusive };
    }

    const pipeline = [
      { $match: {} },
      { $unwind: "$verification_history" },
      {
        $match: {
          "verification_history.action": "Rejected",
          ...(matchStage || {}),
        },
      },
      {
        $group: {
          _id: {
            $trim: {
              input: { $ifNull: ["$verification_history.remarks", ""] },
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          reason: {
            $cond: [
              { $eq: ["$_id", ""] },
              "Unknown",
              "$_id",
            ],
          },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ];

    if (!fromDate || !toDate) {
      // Remove date filter if not provided
      pipeline.splice(0, 1, { $match: {} });
    }

    const grouped = await Application.aggregate(pipeline);
    return res.status(200).json({
      status: "success",
      data: { reasons: grouped },
    });
  } catch (error) {
    console.error("rejection-reasons error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch rejection reasons",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;

