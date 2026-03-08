/**
 * One-time migration: hash plain-text admin passwords to bcrypt.
 * Run: node scripts/migrateAdminPasswordsToBcrypt.js
 *
 * Safe to run multiple times - only updates users whose password does not look like bcrypt.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const AdminUser = require("../models/AdminUser");
const { hashPassword } = require("../utils/passwordUtils");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/wscheme";

async function migrate() {
  await mongoose.connect(MONGODB_URI);

  const users = await AdminUser.find({}).select("_id username password");
  let updated = 0;

  for (const user of users) {
    const stored = user.password || "";
    // Skip if already bcrypt
    if (/^\$2[aby]\$/.test(stored)) {
      console.log(`Skip (already hashed): ${user.username}`);
      continue;
    }

    const hash = await hashPassword(stored);
    await AdminUser.updateOne({ _id: user._id }, { $set: { password: hash } });
    console.log(`Hashed: ${user.username}`);
    updated++;
  }

  console.log(`Done. Updated ${updated} of ${users.length} admin(s).`);
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
