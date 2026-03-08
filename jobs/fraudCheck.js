/**
 * Scheduled fraud and redundancy check.
 * Runs duplicate detection + eligibility re-check; stores results in FraudCheckRun.
 */

const Application = require("../models/Application");
const Scheme = require("../models/Scheme");
const PublicUser = require("../models/PublicUser");
const FraudCheckRun = require("../models/FraudCheckRun");
const { checkEligibility } = require("../utils/eligibilityUtils");

const MAX_DUPLICATES = 500;
const MAX_INELIGIBLE = 500;

async function runFraudCheck() {
  const start = Date.now();
  const alerts = [];
  let duplicatesFound = 0;
  let ineligibleFound = 0;

  try {
    // 1. Duplicate applications (user_id + scheme_id with count > 1)
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
      { $match: { count: { $gt: 1 } } },
      { $limit: MAX_DUPLICATES },
    ]);

    for (const dup of duplicates) {
      const user = await PublicUser.findById(dup._id.user_id).select(
        "demographics.fullName"
      );
      const scheme = await Scheme.findById(dup._id.scheme_id).select(
        "scheme_name"
      );
      const latestApp = dup.applications.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      )[0];

      alerts.push({
        type: "duplicate",
        applicantName: user?.demographics?.fullName || "Unknown",
        applicantId: dup._id.user_id,
        applicationId: latestApp._id,
        schemeId: dup._id.scheme_id,
        schemeName: scheme?.scheme_name || "Unknown",
        detectedAt: latestApp.createdAt || new Date(),
      });
      duplicatesFound++;
    }

    // 2. Ineligible claims (re-check eligibility for active applications)
    const applications = await Application.find({
      status: { $in: ["Applied", "Under Review", "Pending"] },
    })
      .populate("user_id", "demographics economicStatus")
      .populate("scheme_id", "scheme_name scheme_eligibility gender excluded_schemes")
      .limit(MAX_INELIGIBLE * 2)
      .sort({ createdAt: -1 });

    for (const app of applications) {
      if (!app.user_id || !app.scheme_id) continue;
      if (ineligibleFound >= MAX_INELIGIBLE) break;

      const result = await checkEligibility(
        app.user_id,
        app.scheme_id,
        app.user_id._id.toString()
      );

      if (!result.eligible) {
        alerts.push({
          type: "ineligible",
          applicantName: app.user_id.demographics?.fullName || "Unknown",
          applicantId: app.user_id._id,
          applicationId: app._id,
          schemeId: app.scheme_id._id,
          schemeName: app.scheme_id.scheme_name || "Unknown",
          reason: result.reason || "Eligibility check failed",
          detectedAt: app.createdAt || new Date(),
        });
        ineligibleFound++;
      }
    }

    const durationMs = Date.now() - start;

    await FraudCheckRun.create({
      runAt: new Date(),
      duplicatesFound,
      ineligibleFound,
      alerts,
      status: "success",
      durationMs,
    });

    if (duplicatesFound > 0 || ineligibleFound > 0) {
      console.log(
        `[FraudCheck] Run complete: ${duplicatesFound} duplicates, ${ineligibleFound} ineligible (${durationMs}ms)`
      );
    }
  } catch (error) {
    const durationMs = Date.now() - start;
    console.error("[FraudCheck] Error:", error.message);

    await FraudCheckRun.create({
      runAt: new Date(),
      duplicatesFound,
      ineligibleFound,
      alerts,
      status: "error",
      errorMessage: error.message,
      durationMs,
    });
  }
}

module.exports = { runFraudCheck };
