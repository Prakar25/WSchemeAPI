const DocumentType = require("../models/DocumentType");
const BeneficiaryPerson = require("../models/BeneficiaryPerson");
const defaultDocumentTypes = require("../config/defaultDocumentTypes");

let registryCache = null;
let registryCacheAt = 0;
const CACHE_MS = 60 * 1000;

async function ensureDocumentTypesSeeded() {
  const count = await DocumentType.countDocuments();
  if (count > 0) return;
  await DocumentType.insertMany(
    defaultDocumentTypes.map((d) => ({
      ...d,
      active: true,
      acceptedMimeTypes: d.acceptedMimeTypes || [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
      ],
      maxSizeMb: d.maxSizeMb || 10,
    }))
  );
}

async function loadRegistry(force = false) {
  const now = Date.now();
  if (!force && registryCache && now - registryCacheAt < CACHE_MS) {
    return registryCache;
  }
  await ensureDocumentTypesSeeded();
  const types = await DocumentType.find({ active: true }).sort({ sortOrder: 1, label: 1 }).lean();
  const byKey = new Map();
  const aliasToKey = new Map();

  for (const t of types) {
    byKey.set(t.key, t);
    aliasToKey.set(normalizeAlias(t.key), t.key);
    aliasToKey.set(normalizeAlias(t.label), t.key);
    for (const a of t.aliases || []) {
      aliasToKey.set(normalizeAlias(a), t.key);
    }
  }

  registryCache = { types, byKey, aliasToKey };
  registryCacheAt = now;
  return registryCache;
}

function normalizeAlias(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function documentsObjectToPlain(documents) {
  if (!documents) return {};
  const raw =
    documents instanceof Map ? Object.fromEntries(documents.entries()) : { ...documents };
  const out = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!val || typeof val !== "object") continue;
    if (val.filePath) {
      out[key] = {
        filePath: val.filePath,
        uploadedAt: val.uploadedAt || null,
        verified: !!val.verified,
      };
    }
  }
  return out;
}

/**
 * Resolve user-facing string or key to canonical document type key.
 */
async function resolveDocumentTypeKey(input) {
  if (!input) return null;
  const { aliasToKey, byKey } = await loadRegistry();
  const raw = String(input).trim();
  if (byKey.has(raw)) return raw;
  const fromAlias = aliasToKey.get(normalizeAlias(raw));
  return fromAlias || null;
}

/**
 * Normalize an array of scheme required types (legacy labels or keys) to canonical keys.
 */
async function normalizeSchemeRequiredDocumentKeys(inputs) {
  if (!Array.isArray(inputs)) return [];
  const keys = [];
  const unknown = [];
  for (const item of inputs) {
    const key = await resolveDocumentTypeKey(item);
    if (key) {
      if (!keys.includes(key)) keys.push(key);
    } else if (item) {
      unknown.push(String(item).trim());
    }
  }
  return { keys, unknown };
}

async function enrichRequiredDocuments(keysOrLabels) {
  const { keys } = await normalizeSchemeRequiredDocumentKeys(keysOrLabels);
  const { byKey } = await loadRegistry();
  return keys.map((key) => {
    const t = byKey.get(key);
    return {
      key,
      label: t?.label || key,
      description: t?.description || "",
      profileReusable: !!t?.profileReusable,
      acceptedMimeTypes: t?.acceptedMimeTypes || [],
      maxSizeMb: t?.maxSizeMb ?? 10,
    };
  });
}

async function listActiveDocumentTypes() {
  const { types } = await loadRegistry();
  return types.map((t) => ({
    key: t.key,
    label: t.label,
    description: t.description || "",
    aliases: t.aliases || [],
    profileReusable: !!t.profileReusable,
    sortOrder: t.sortOrder ?? 0,
    acceptedMimeTypes: t.acceptedMimeTypes || [],
    maxSizeMb: t.maxSizeMb ?? 10,
  }));
}

async function getProfileReusableKeys() {
  const { types } = await loadRegistry();
  return types.filter((t) => t.profileReusable).map((t) => t.key);
}

async function validateDocumentTypeKey(key) {
  const resolved = await resolveDocumentTypeKey(key);
  if (!resolved) {
    return { ok: false, message: `Unknown document type: ${key}` };
  }
  return { ok: true, key: resolved };
}

/**
 * Applicant profile documents (PublicUser or BeneficiaryPerson).
 */
async function getApplicantProfileDocuments(resolved) {
  if (!resolved) return {};
  if (resolved.kind === "PublicUser") {
    return documentsObjectToPlain(resolved.publicUser?.documents);
  }
  let person = resolved.person;
  if (!person?.documents && person?._id) {
    person = await BeneficiaryPerson.findById(person._id).select("documents").lean();
  }
  return documentsObjectToPlain(person?.documents);
}

/**
 * Build scheme application document checklist with profile prefill hints.
 */
async function buildSchemeDocumentRequirements(scheme, applicantProfileDocs) {
  const required = await enrichRequiredDocuments(scheme?.scheme_required_document_types || []);
  const profileDocs = applicantProfileDocs || {};

  const required_documents = required.map((req) => {
    const profileDoc = profileDocs[req.key] || null;
    const available = !!(profileDoc && profileDoc.filePath);
    return {
      key: req.key,
      label: req.label,
      description: req.description,
      profileReusable: req.profileReusable,
      required: true,
      profile_document: available
        ? {
            filePath: profileDoc.filePath,
            uploadedAt: profileDoc.uploadedAt,
            verified: profileDoc.verified,
            available: true,
          }
        : null,
      will_prefill: available && req.profileReusable,
      needs_upload: !available,
    };
  });

  return {
    required_document_keys: required.map((r) => r.key),
    required_documents,
    applicant_profile_documents: profileDocs,
  };
}

/**
 * Merge profile + application uploads into documents_submitted for Application.
 * submitted items: { document_type, file_url, uploaded_at? } — type may be key or legacy label.
 */
async function resolveApplicationDocumentsSubmitted(
  schemeRequiredTypes,
  applicantProfileDocs,
  submitted = []
) {
  const { keys, unknown } = await normalizeSchemeRequiredDocumentKeys(schemeRequiredTypes || []);
  if (unknown.length > 0) {
    return {
      ok: false,
      status: 422,
      message: `Scheme references unknown document type(s): ${unknown.join(", ")}. Update the scheme or add types via /api/document-types.`,
      unknown_types: unknown,
    };
  }

  const submittedByKey = new Map();
  for (const item of submitted || []) {
    if (!item?.document_type || !item?.file_url) continue;
    const key = await resolveDocumentTypeKey(item.document_type);
    if (!key) continue;
    submittedByKey.set(key, {
      document_type: key,
      file_url: String(item.file_url).trim(),
      uploaded_at: item.uploaded_at ? new Date(item.uploaded_at) : new Date(),
      source: "application",
    });
  }

  const documents = [];
  const missing = [];
  const prefilled_from_profile = [];

  for (const key of keys) {
    const fromApp = submittedByKey.get(key);
    if (fromApp) {
      documents.push(fromApp);
      continue;
    }
    const prof = applicantProfileDocs?.[key];
    if (prof?.filePath) {
      documents.push({
        document_type: key,
        file_url: prof.filePath,
        uploaded_at: prof.uploadedAt ? new Date(prof.uploadedAt) : new Date(),
        source: "profile",
      });
      prefilled_from_profile.push(key);
      continue;
    }
    missing.push(key);
  }

  if (missing.length > 0) {
    const { byKey } = await loadRegistry();
    const labels = missing.map((k) => byKey.get(k)?.label || k);
    return {
      ok: false,
      status: 422,
      message: `Missing required document(s): ${labels.join(", ")}`,
      missing_document_keys: missing,
      missing_document_labels: labels,
    };
  }

  return {
    ok: true,
    documents,
    prefilled_from_profile,
  };
}

function invalidateDocumentTypeCache() {
  registryCache = null;
  registryCacheAt = 0;
}

async function enrichSchemeForResponse(scheme) {
  const obj = scheme?.toObject ? scheme.toObject() : { ...scheme };
  const raw = obj.scheme_required_document_types || [];
  const { keys, unknown } = await normalizeSchemeRequiredDocumentKeys(raw);
  obj.scheme_required_document_type_keys = keys;
  obj.scheme_required_documents_enriched = await enrichRequiredDocuments(keys);
  if (unknown.length > 0) {
    obj.scheme_required_document_unknown = unknown;
  }
  return obj;
}

module.exports = {
  ensureDocumentTypesSeeded,
  loadRegistry,
  resolveDocumentTypeKey,
  normalizeSchemeRequiredDocumentKeys,
  enrichRequiredDocuments,
  listActiveDocumentTypes,
  getProfileReusableKeys,
  validateDocumentTypeKey,
  getApplicantProfileDocuments,
  buildSchemeDocumentRequirements,
  resolveApplicationDocumentsSubmitted,
  invalidateDocumentTypeCache,
  enrichSchemeForResponse,
  documentsObjectToPlain,
};
