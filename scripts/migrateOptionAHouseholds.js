/**
 * Option A migration (safe, additive):
 * - For each existing PublicUser, ensure Household + primary BeneficiaryPerson exist.
 * - Does NOT rewrite existing Application.user_id links (lowest risk).
 *
 * Usage:
 *   node scripts/migrateOptionAHouseholds.js --dry-run
 *   node scripts/migrateOptionAHouseholds.js --apply
 *
 * Optional:
 *   MONGODB_URI="mongodb://..." node scripts/migrateOptionAHouseholds.js --apply
 */
require("dotenv").config();

const mongoose = require("mongoose");
const PublicUser = require("../models/PublicUser");
const Household = require("../models/Household");
const BeneficiaryPerson = require("../models/BeneficiaryPerson");
const { ensureHouseholdForPublicUser, syncHouseholdFromPublicUser } = require("../utils/householdService");

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    dryRun: args.has("--dry-run") || (!args.has("--apply") && !args.has("--write")),
    apply: args.has("--apply") || args.has("--write"),
    verbose: args.has("--verbose"),
    limit: (() => {
      const i = argv.indexOf("--limit");
      if (i >= 0 && argv[i + 1]) {
        const n = Number(argv[i + 1]);
        return Number.isFinite(n) && n > 0 ? n : null;
      }
      return null;
    })(),
    skip: (() => {
      const i = argv.indexOf("--skip");
      if (i >= 0 && argv[i + 1]) {
        const n = Number(argv[i + 1]);
        return Number.isFinite(n) && n >= 0 ? n : 0;
      }
      return 0;
    })(),
  };
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.apply && opts.dryRun) opts.dryRun = false;

  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/wscheme";
  await mongoose.connect(mongoUri);

  const totalPublicUsers = await PublicUser.countDocuments({});

  const cursor = PublicUser.find({})
    .select("_id householdId contact.mobile.value contact.mobile.verified status authentication audit demographics aadhaarNumber address kycLevel economicStatus")
    .sort({ _id: 1 })
    .skip(opts.skip);

  if (opts.limit) cursor.limit(opts.limit);

  const users = await cursor;

  const stats = {
    mode: opts.dryRun ? "dry-run" : "apply",
    mongoUriRedacted: mongoUri.replace(/\/\/.*@/, "//***@"),
    totalPublicUsers,
    scanned: users.length,
    skippedNoMobile: 0,
    alreadyLinked: 0,
    wouldCreateHousehold: 0,
    createdHousehold: 0,
    wouldCreatePrimaryPerson: 0,
    createdPrimaryPerson: 0,
    syncedHousehold: 0,
    errors: 0,
  };

  for (const u of users) {
    try {
      const mobile = u.contact?.mobile?.value?.trim();
      if (!mobile) {
        stats.skippedNoMobile++;
        continue;
      }

      const existingHousehold =
        (u.householdId && (await Household.findById(u.householdId).select("_id"))) ||
        (await Household.findOne({ publicUserId: u._id }).select("_id"));

      const existingPrimary =
        existingHousehold &&
        (await BeneficiaryPerson.findOne({ householdId: existingHousehold._id, isPrimary: true }).select("_id"));

      if (existingHousehold && existingPrimary && u.householdId) {
        stats.alreadyLinked++;
        continue;
      }

      if (opts.dryRun) {
        if (!existingHousehold) stats.wouldCreateHousehold++;
        if (existingHousehold && !existingPrimary) stats.wouldCreatePrimaryPerson++;
        if (!existingHousehold) {
          // household create would also create primary person in ensureHouseholdForPublicUser
          stats.wouldCreatePrimaryPerson++;
        }
        continue;
      }

      const beforeHouseholdId = u.householdId ? String(u.householdId) : null;
      const h = await ensureHouseholdForPublicUser(u);
      if (h && !beforeHouseholdId) stats.createdHousehold++;

      // ensureHouseholdForPublicUser creates primary person when missing; check if it exists now
      const primary = h ? await BeneficiaryPerson.findOne({ householdId: h._id, isPrimary: true }).select("_id") : null;
      if (primary) stats.createdPrimaryPerson++;

      await syncHouseholdFromPublicUser(u);
      stats.syncedHousehold++;

      if (opts.verbose) {
        console.log(`[ok] publicUser=${u._id} mobile=${mobile} household=${h?._id || "-"} primary=${primary?._id || "-"}`);
      }
    } catch (e) {
      stats.errors++;
      if (opts.verbose) console.error("[error]", e?.message || e);
    }
  }

  console.log(JSON.stringify(stats, null, 2));
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("Migration failed:", e?.message || e);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});

