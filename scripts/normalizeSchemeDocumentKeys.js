/**
 * One-time: convert scheme_required_document_types labels to canonical keys.
 * Run: node scripts/normalizeSchemeDocumentKeys.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Scheme = require("../models/Scheme");
const { normalizeSchemeRequiredDocumentKeys } = require("../utils/documentTypeService");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/wscheme");
  const schemes = await Scheme.find({});
  let updated = 0;
  for (const s of schemes) {
    const { keys, unknown } = await normalizeSchemeRequiredDocumentKeys(
      s.scheme_required_document_types || []
    );
    const before = JSON.stringify(s.scheme_required_document_types);
    const after = JSON.stringify(keys);
    if (keys.length === 0) {
      console.warn(s.scheme_name, "skipped: no resolvable document types", unknown);
      continue;
    }
    if (before !== after) {
      s.scheme_required_document_types = keys;
      await s.save();
      updated++;
      console.log(s.scheme_name, "->", keys, unknown.length ? `(unknown: ${unknown})` : "");
    }
  }
  console.log(`Done. Updated ${updated} scheme(s).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
