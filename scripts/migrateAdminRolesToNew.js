/**
 * Migration script to rename/replace removed admin roles.
 *
 * Old roles -> New roles:
 * - CSDAdmin -> CSCAdmin
 * - Post Operator -> District Overlookers
 * - Department Secretary/Head/User -> DistrictHQ Head
 *
 * Usage: node scripts/migrateAdminRolesToNew.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const AdminUser = require("../models/AdminUser");

const OLD_TO_NEW = {
  CSDAdmin: AdminUser.ROLES.CSC_ADMIN,
  "Post Operator": AdminUser.ROLES.DISTRICT_OVERLOOKERS,
  "Department Secretary": AdminUser.ROLES.DISTRICTHQ_HEAD,
  "Department Head": AdminUser.ROLES.DISTRICTHQ_HEAD,
  "Department User": AdminUser.ROLES.DISTRICTHQ_HEAD,
};

async function run() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/wscheme";
  await mongoose.connect(mongoUri);

  let totalUpdated = 0;
  for (const [oldRole, newRole] of Object.entries(OLD_TO_NEW)) {
    const result = await AdminUser.updateMany({ role: oldRole }, { $set: { role: newRole } });
    totalUpdated += result.modifiedCount || 0;
    console.log(`- ${oldRole} -> ${newRole}: updated ${result.modifiedCount || 0}`);
  }

  await mongoose.disconnect();
  console.log(`Done. Total updated: ${totalUpdated}`);
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

