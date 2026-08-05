/**
 * One-time: split legacy scheme_required_document_types into:
 * - scheme_required_document_types (admin free text, non-profile)
 * - scheme_profile_document_types (profile-reusable catalog keys)
 *
 * Run: node scripts/normalizeSchemeDocumentKeys.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Scheme = require("../models/Scheme");
const {
  getSchemeRequiredTextLabels,
  getSchemeProfileDocumentKeys,
} = require("../utils/documentTypeService");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/wscheme");
  const schemes = await Scheme.find({});
  let updated = 0;

  for (const s of schemes) {
    if (s.scheme_profile_document_types !== undefined) {
      continue;
    }

    const textLabels = await getSchemeRequiredTextLabels(s);
    const profileKeys = await getSchemeProfileDocumentKeys(s);

    s.scheme_required_document_types = textLabels;
    s.scheme_profile_document_types = profileKeys;
    await s.save();
    updated++;
    console.log(s.scheme_name);
    console.log("  text:", textLabels);
    console.log("  profile:", profileKeys);
  }

  console.log(`Done. Migrated ${updated} scheme(s).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
