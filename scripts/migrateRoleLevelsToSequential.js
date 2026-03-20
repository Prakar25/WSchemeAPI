/**
 * Migration script: Convert role levels from legacy (1,2,6,7,9) to sequential (1,2,3,4,5).
 *
 * Mapping:
 *   9 (CSCAdmin)       -> 5
 *   7 (District Overlookers) -> 4
 *   6 (DistrictHQ Head) -> 3
 *   8 (legacy Post Operator) -> 4
 *   4,5,3 (legacy Dept) -> 3
 *
 * Run: node scripts/migrateRoleLevelsToSequential.js
 *
 * Ensure the application is stopped or in maintenance mode before running.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Scheme = require("../models/Scheme");
const Application = require("../models/Application");

function mapLevel(level) {
  if (level === 9) return 5;
  if (level === 7 || level === 8) return 4;
  if (level === 6 || level === 4 || level === 5 || level === 3) return 3;
  return level; // 1, 2, 99 unchanged
}

async function run() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/wscheme";
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  let schemesUpdated = 0;
  let applicationsUpdated = 0;

  // 1. Migrate Scheme.authorization_levels
  const schemes = await Scheme.find({ authorization_levels: { $exists: true, $ne: [] } });
  for (const scheme of schemes) {
    const levels = scheme.authorization_levels || [];
    const mapped = levels.map(mapLevel).filter((v) => [1, 2, 3, 4].includes(v));
    if (JSON.stringify(levels) !== JSON.stringify(mapped)) {
      await Scheme.updateOne({ _id: scheme._id }, { $set: { authorization_levels: mapped } });
      schemesUpdated++;
      console.log(`  Scheme ${scheme._id}: ${JSON.stringify(levels)} -> ${JSON.stringify(mapped)}`);
    }
  }
  console.log(`Schemes updated: ${schemesUpdated}`);

  // 2. Migrate Application.authorization_levels
  const appsWithAuthLevels = await Application.find({
    authorization_levels: { $exists: true, $nin: [[], null] },
  });
  for (const app of appsWithAuthLevels) {
    const levels = app.authorization_levels || [];
    const mapped = levels.map(mapLevel).filter((v) => [1, 2, 3, 4].includes(v));
    if (JSON.stringify(levels) !== JSON.stringify(mapped)) {
      await Application.updateOne(
        { _id: app._id },
        { $set: { authorization_levels: mapped } }
      );
      applicationsUpdated++;
    }
  }
  console.log(`Applications (authorization_levels) updated: ${applicationsUpdated}`);

  // 3. Migrate Application.verification_level and verification_stage
  const ApplicationModel = require("../models/Application");
  const appsWithLegacyLevel = await Application.find({
    verification_level: { $in: [6, 7, 8, 9] },
  });
  let verificationLevelUpdates = 0;
  for (const app of appsWithLegacyLevel) {
    const newLevel = mapLevel(app.verification_level);
    const newStage = ApplicationModel.getStageNameFromLevel(newLevel);
    await Application.updateOne(
      { _id: app._id },
      { $set: { verification_level: newLevel, verification_stage: newStage } }
    );
    verificationLevelUpdates++;
    console.log(`  App ${app._id}: verification_level ${app.verification_level}->${newLevel}, stage->${newStage}`);
  }
  console.log(`Applications (verification_level + verification_stage) updated: ${verificationLevelUpdates}`);

  // 3b. Fix stored verification_stage for ALL apps (stale/inconsistent stage strings)
  const allApps = await Application.find({}).lean();
  let stageFixCount = 0;
  for (const app of allApps) {
    const normLevel = ApplicationModel.normalizeVerificationLevel(app.verification_level);
    const correctStage = ApplicationModel.getStageNameFromLevel(normLevel);
    if (app.verification_stage !== correctStage) {
      await Application.updateOne(
        { _id: app._id },
        { $set: { verification_stage: correctStage } }
      );
      stageFixCount++;
    }
  }
  console.log(`Applications (stored verification_stage corrected): ${stageFixCount}`);

  // 4. Migrate verification_history: verified_by_role_level and legacy stage names
  const legacyStageToNew = {
    Post_Operator_Review: "District_Overlookers_Review",
    CSD_Admin_Review: "CSC_Admin_Review",
    Department_Review: "District_Head_Review",
    Secretary_Review: "District_Head_Review",
  };
  const appsWithHistory = await Application.find({
    "verification_history.0": { $exists: true },
  }).lean();
  let historyUpdates = 0;
  for (const app of appsWithHistory) {
    const history = app.verification_history || [];
    let changed = false;
    const updated = history.map((h) => {
      let newH = { ...h };
      const level = h.verified_by_role_level;
      if (level != null && [6, 7, 8, 9].includes(level)) {
        changed = true;
        newH.verified_by_role_level = mapLevel(level);
      }
      if (h.stage && legacyStageToNew[h.stage]) {
        changed = true;
        newH.stage = legacyStageToNew[h.stage];
      }
      return newH;
    });
    if (changed) {
      await Application.updateOne(
        { _id: app._id },
        { $set: { verification_history: updated } }
      );
      historyUpdates++;
    }
  }
  console.log(`Applications (verification_history role levels) updated: ${historyUpdates}`);

  // 5. Migrate current_verifier.verified_by_role_level
  const appsWithVerifier = await Application.find({
    "current_verifier.verified_by_role_level": { $in: [6, 7, 8, 9] },
  });
  let verifierUpdates = 0;
  for (const app of appsWithVerifier) {
    const cv = app.current_verifier;
    if (cv && cv.verified_by_role_level != null) {
      const newLevel = mapLevel(cv.verified_by_role_level);
      await Application.updateOne(
        { _id: app._id },
        { $set: { "current_verifier.verified_by_role_level": newLevel } }
      );
      verifierUpdates++;
    }
  }
  console.log(`Applications (current_verifier role level) updated: ${verifierUpdates}`);

  // 6. Fix status: "Applied" should only be for level 5 (CSC). Past CSC -> "Under Review", Completed -> "Approved"
  const statusFixResult = await Application.updateMany(
    {
      status: "Applied",
      verification_level: { $in: [1, 2, 3, 4] },
    },
    { $set: { status: "Under Review" } }
  );
  console.log(`Applications (status Applied->Under Review for in-progress): ${statusFixResult.modifiedCount}`);
  const approvedFixResult = await Application.updateMany(
    { status: "Applied", verification_level: 99 },
    { $set: { status: "Approved" } }
  );
  console.log(`Applications (status Applied->Approved for completed): ${approvedFixResult.modifiedCount}`);

  await mongoose.disconnect();
  console.log("Migration complete.");
}

run().catch(async (err) => {
  console.error("Migration failed:", err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
