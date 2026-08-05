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

const DEFAULT_ACCEPTED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

function labelToCustomDocKey(label, existingKeys = []) {
  const slug = String(label || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 48);
  let base = slug ? `custom_${slug}` : "custom_document";
  let key = base;
  let i = 2;
  const taken = new Set(existingKeys);
  while (taken.has(key)) {
    key = `${base}_${i++}`;
  }
  return key;
}

/**
 * Normalize admin input for scheme-only custom document names.
 * Accepts ["Income Affidavit"] or [{ label, description?, key? }].
 */
function normalizeSchemeCustomRequiredDocuments(inputs, existingKeys = []) {
  if (!Array.isArray(inputs)) return [];
  const out = [];
  const keys = new Set(existingKeys);

  for (const item of inputs) {
    let label = "";
    let description = "";
    let key = "";

    if (typeof item === "string") {
      label = item.trim();
    } else if (item && typeof item === "object") {
      label = String(item.label || item.name || item.document_type || "").trim();
      description = item.description ? String(item.description).trim() : "";
      if (item.key && String(item.key).trim()) {
        const rawKey = String(item.key).trim();
        key = rawKey.startsWith("custom_") ? rawKey : `custom_${rawKey.replace(/^custom_/, "")}`;
      }
    }

    if (!label) continue;
    if (!key) {
      key = labelToCustomDocKey(label, [...keys]);
    }
    if (keys.has(key)) continue;
    keys.add(key);
    out.push({ key, label, description });
  }

  return out;
}

function normalizeSchemeRequiredDocumentTexts(inputs) {
  if (!Array.isArray(inputs)) return [];
  const out = [];
  const seen = new Set();
  for (const item of inputs) {
    const label = typeof item === "string" ? item.trim() : String(item || "").trim();
    if (!label) continue;
    const norm = normalizeAlias(label);
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(label);
  }
  return out;
}

async function normalizeProfileDocumentKeys(inputs) {
  const reusable = await getProfileReusableKeys();
  const keys = [];
  const invalid = [];
  for (const item of inputs || []) {
    const key = await resolveDocumentTypeKey(item);
    if (key && reusable.includes(key)) {
      if (!keys.includes(key)) keys.push(key);
    } else if (item) {
      invalid.push(String(item).trim());
    }
  }
  return { keys, invalid };
}

/**
 * Profile/prepopulated catalog keys for this scheme.
 * New format: scheme_profile_document_types.
 * Legacy: profile-reusable matches extracted from scheme_required_document_types strings.
 */
async function getSchemeProfileDocumentKeys(scheme) {
  const reusable = await getProfileReusableKeys();

  if (scheme?.scheme_profile_document_types !== undefined) {
    const keys = [];
    for (const item of scheme.scheme_profile_document_types || []) {
      const key = await resolveDocumentTypeKey(item);
      if (key && reusable.includes(key) && !keys.includes(key)) keys.push(key);
    }
    return keys;
  }

  const keys = [];
  for (const item of scheme?.scheme_required_document_types || []) {
    const key = await resolveDocumentTypeKey(item);
    if (key && reusable.includes(key) && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

/**
 * Admin-typed free-text document names (scheme_required_document_types).
 * Legacy: excludes strings that map to profile-reusable catalog types.
 */
async function getSchemeRequiredTextLabels(scheme) {
  const texts = normalizeSchemeRequiredDocumentTexts(scheme?.scheme_required_document_types || []);

  if (scheme?.scheme_profile_document_types !== undefined) {
    return texts;
  }

  const reusable = await getProfileReusableKeys();
  const out = [];
  for (const label of texts) {
    const key = await resolveDocumentTypeKey(label);
    if (key && reusable.includes(key)) continue;
    out.push(label);
  }
  return out;
}

async function getSchemeTextDocumentDescriptors(scheme) {
  const profileKeys = await getSchemeProfileDocumentKeys(scheme);
  const labels = await getSchemeRequiredTextLabels(scheme);
  return normalizeSchemeCustomRequiredDocuments(labels, profileKeys);
}

function resolveTextDocument(scheme, input, textDescriptors) {
  if (!input) return null;
  const docs = textDescriptors || [];
  const raw = String(input).trim();
  const byKey = docs.find((d) => d.key === raw);
  if (byKey) return byKey;
  const norm = normalizeAlias(raw);
  return docs.find((d) => normalizeAlias(d.label) === norm) || null;
}

function enrichCustomRequiredDocuments(customDocs) {
  return (customDocs || []).map((d) => ({
    key: d.key,
    label: d.label,
    description: d.description || "",
    profileReusable: false,
    isCustom: true,
    acceptedMimeTypes: DEFAULT_ACCEPTED_MIMES,
    maxSizeMb: 10,
  }));
}

async function getSchemeAllRequiredDocumentDescriptors(scheme) {
  const profileKeys = await getSchemeProfileDocumentKeys(scheme);
  const profileDocs = await enrichRequiredDocuments(profileKeys);
  const textDescriptors = await getSchemeTextDocumentDescriptors(scheme);
  const textDocs = enrichCustomRequiredDocuments(textDescriptors);

  return {
    profileDocumentKeys: profileKeys,
    textDocumentKeys: textDescriptors.map((d) => d.key),
    required_documents: [...profileDocs, ...textDocs],
    required_document_keys: [...profileKeys, ...textDescriptors.map((d) => d.key)],
  };
}

function customDocumentTypeConfig(customDoc) {
  return {
    ok: true,
    key: customDoc.key,
    label: customDoc.label,
    description: customDoc.description || "",
    profileReusable: false,
    isCustom: true,
    acceptedMimeTypes: DEFAULT_ACCEPTED_MIMES,
    maxSizeMb: 10,
  };
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
 * Resolve document type for scheme application uploads (any active type).
 */
async function getDocumentTypeConfig(key, options = {}) {
  const { scheme } = options;
  const valid = await validateDocumentTypeKey(key);
  if (valid.ok) {
    const { byKey } = await loadRegistry();
    const t = byKey.get(valid.key);
    if (!t) {
      return { ok: false, message: `Unknown document type: ${key}` };
    }
    return {
      ok: true,
      key: valid.key,
      label: t.label,
      profileReusable: !!t.profileReusable,
      isCustom: false,
      acceptedMimeTypes: t.acceptedMimeTypes || DEFAULT_ACCEPTED_MIMES,
      maxSizeMb: t.maxSizeMb ?? 10,
    };
  }

  if (scheme) {
    const textDescriptors = await getSchemeTextDocumentDescriptors(scheme);
    const textDoc = resolveTextDocument(scheme, key, textDescriptors);
    if (textDoc) {
      return customDocumentTypeConfig(textDoc);
    }
  }

  const raw = String(key || "").trim();
  if (raw.startsWith("custom_")) {
    return {
      ok: true,
      key: raw,
      label: raw
        .replace(/^custom_/, "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      profileReusable: false,
      isCustom: true,
      acceptedMimeTypes: DEFAULT_ACCEPTED_MIMES,
      maxSizeMb: 10,
    };
  }

  return { ok: false, message: `Unknown document type: ${key}` };
}

async function resolveSubmittedDocumentKey(scheme, documentTypeInput) {
  const profileKeys = await getSchemeProfileDocumentKeys(scheme);
  const catalogKey = await resolveDocumentTypeKey(documentTypeInput);
  if (catalogKey && profileKeys.includes(catalogKey)) return catalogKey;

  const textDescriptors = await getSchemeTextDocumentDescriptors(scheme);
  const textDoc = resolveTextDocument(scheme, documentTypeInput, textDescriptors);
  if (textDoc) return textDoc.key;

  if (catalogKey) {
    const textLabels = await getSchemeRequiredTextLabels(scheme);
    for (const label of textLabels) {
      const labelKey = await resolveDocumentTypeKey(label);
      if (labelKey === catalogKey) {
        const match = textDescriptors.find((d) => normalizeAlias(d.label) === normalizeAlias(label));
        if (match) return match.key;
      }
    }
  }

  return null;
}

function validateUploadedFileAgainstConfig(file, config) {
  if (!file) {
    return { ok: false, message: "No file uploaded." };
  }
  const maxBytes = (config.maxSizeMb || 10) * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      ok: false,
      message: `File exceeds maximum size of ${config.maxSizeMb}MB for ${config.label}.`,
    };
  }
  const allowed = config.acceptedMimeTypes || [];
  if (allowed.length > 0 && !allowed.includes(file.mimetype)) {
    return {
      ok: false,
      message: `Invalid file type for ${config.label}. Allowed: ${allowed.join(", ")}`,
    };
  }
  return { ok: true };
}

/**
 * Profile KYC slots: catalog types merged with applicant uploads.
 */
async function buildProfileDocumentSlots(applicantProfileDocs) {
  const types = (await listActiveDocumentTypes()).filter((t) => t.profileReusable);
  const profileDocs = applicantProfileDocs || {};
  return types.map((t) => {
    const doc = profileDocs[t.key] || null;
    const uploaded = !!(doc && doc.filePath);
    return {
      key: t.key,
      label: t.label,
      description: t.description || "",
      acceptedMimeTypes: t.acceptedMimeTypes,
      maxSizeMb: t.maxSizeMb,
      uploaded,
      document: uploaded
        ? {
            filePath: doc.filePath,
            uploadedAt: doc.uploadedAt,
            verified: !!doc.verified,
          }
        : null,
    };
  });
}

function mimeTypesToDropzoneAccept(mimeTypes = []) {
  const map = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
    "application/pdf": [".pdf"],
  };
  const out = {};
  for (const mime of mimeTypes || []) {
    if (map[mime]) out[mime] = map[mime];
  }
  if (Object.keys(out).length === 0) {
    return {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "application/pdf": [".pdf"],
    };
  }
  return out;
}

function summarizeDocumentRequirements(requirements) {
  const docs = requirements?.required_documents || [];
  const prefilled = docs.filter((d) => d.will_prefill);
  const needsUpload = docs.filter((d) => d.needs_upload);
  const summary = {
    total_required: docs.length,
    prefilled_count: prefilled.length,
    needs_upload_count: needsUpload.length,
    all_documents_ready: needsUpload.length === 0,
    prefilled_keys: prefilled.map((d) => d.key),
    needs_upload_keys: needsUpload.map((d) => d.key),
  };
  summary.summary_text =
    summary.all_documents_ready
      ? `All ${summary.total_required} required document(s) are ready.`
      : `${summary.prefilled_count} from profile, ${summary.needs_upload_count} still need upload.`;
  return summary;
}

function buildApplicantSummaryForApplyForm(resolved, profileDocs) {
  if (!resolved) return null;
  if (resolved.kind === "PublicUser") {
    const u = resolved.publicUser;
    return {
      user_id: u._id,
      applicant_ref_model: "PublicUser",
      isPrimary: true,
      fullName: u.demographics?.fullName || null,
      dob: u.demographics?.dob?.date || null,
      gender: u.demographics?.gender || null,
      aadhaarNumber: u.aadhaarNumber || null,
      phoneNumber: u.contact?.mobile?.value || null,
      documents: profileDocs || {},
    };
  }
  const p = resolved.person;
  return {
    user_id: p._id,
    applicant_ref_model: "BeneficiaryPerson",
    isPrimary: !!p.isPrimary,
    fullName: p.demographics?.fullName || null,
    dob: p.demographics?.dob?.date || null,
    gender: p.demographics?.gender || null,
    aadhaarNumber: p.aadhaarNumber || null,
    phoneNumber: null,
    documents: profileDocs || {},
  };
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
  const { required_documents: required, required_document_keys } =
    await getSchemeAllRequiredDocumentDescriptors(scheme);
  const profileDocs = applicantProfileDocs || {};

  const required_documents = required.map((req) => {
    const profileDoc = !req.isCustom ? profileDocs[req.key] || null : null;
    const available = !!(profileDoc && profileDoc.filePath);
    const willPrefill = available && req.profileReusable;
    const acceptedMimeTypes = req.acceptedMimeTypes || DEFAULT_ACCEPTED_MIMES;
    return {
      key: req.key,
      label: req.label,
      description: req.description,
      profileReusable: req.profileReusable,
      isCustom: !!req.isCustom,
      required: true,
      acceptedMimeTypes,
      maxSizeMb: req.maxSizeMb ?? 10,
      file_accept: mimeTypesToDropzoneAccept(acceptedMimeTypes),
      profile_document: available
        ? {
            filePath: profileDoc.filePath,
            uploadedAt: profileDoc.uploadedAt,
            verified: profileDoc.verified,
            available: true,
          }
        : null,
      will_prefill: willPrefill,
      needs_upload: req.isCustom ? true : !willPrefill,
    };
  });

  return {
    required_document_keys,
    required_documents,
    scheme_required_document_types: await getSchemeRequiredTextLabels(scheme),
    scheme_profile_document_types: await getSchemeProfileDocumentKeys(scheme),
    applicant_profile_documents: profileDocs,
  };
}

/**
 * Merge profile + application uploads into documents_submitted for Application.
 * submitted items: { document_type, file_url, uploaded_at? } — type may be key or legacy label.
 */
async function resolveApplicationDocumentsSubmitted(scheme, applicantProfileDocs, submitted = []) {
  const { profileDocumentKeys, textDocumentKeys, required_document_keys, required_documents } =
    await getSchemeAllRequiredDocumentDescriptors(scheme);

  const labelByKey = new Map(required_documents.map((d) => [d.key, d.label]));
  const textKeySet = new Set(textDocumentKeys);

  const submittedByKey = new Map();
  for (const item of submitted || []) {
    if (!item?.document_type || !item?.file_url) continue;
    const key = await resolveSubmittedDocumentKey(scheme, item.document_type);
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

  for (const key of required_document_keys) {
    const fromApp = submittedByKey.get(key);
    if (fromApp) {
      documents.push(fromApp);
      continue;
    }

    const isTextDoc = textKeySet.has(key);
    if (!isTextDoc && profileDocumentKeys.includes(key)) {
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
    }

    missing.push(key);
  }

  if (missing.length > 0) {
    const labels = missing.map((k) => labelByKey.get(k) || k);
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
    profile_document_keys: profileDocumentKeys,
    text_document_keys: textDocumentKeys,
  };
}

function invalidateDocumentTypeCache() {
  registryCache = null;
  registryCacheAt = 0;
}

async function enrichSchemeForResponse(scheme) {
  const obj = scheme?.toObject ? scheme.toObject() : { ...scheme };
  const merged = await getSchemeAllRequiredDocumentDescriptors(scheme);
  const textLabels = await getSchemeRequiredTextLabels(scheme);
  const profileKeys = await getSchemeProfileDocumentKeys(scheme);
  const textDescriptors = await getSchemeTextDocumentDescriptors(scheme);

  obj.scheme_required_document_types = textLabels;
  obj.scheme_profile_document_types = profileKeys;
  obj.scheme_profile_documents_enriched = merged.required_documents.filter((d) => !d.isCustom);
  obj.scheme_text_documents_enriched = merged.required_documents.filter((d) => d.isCustom);
  obj.scheme_text_document_keys = textDescriptors.map((d) => d.key);
  obj.all_required_document_keys = merged.required_document_keys;
  obj.scheme_required_documents_enriched = merged.required_documents;
  obj.uses_legacy_document_format = scheme?.scheme_profile_document_types === undefined;
  return obj;
}

/**
 * Normalize admin-typed documents + profile prepopulate fields on scheme create/update.
 */
async function normalizeSchemeDocumentsPayload(payload, existingScheme = null) {
  const result = { ...payload };

  if (payload.scheme_required_document_types !== undefined) {
    result.scheme_required_document_types = normalizeSchemeRequiredDocumentTexts(
      payload.scheme_required_document_types
    );
  }

  if (payload.scheme_profile_document_types !== undefined) {
    const { keys, invalid } = await normalizeProfileDocumentKeys(payload.scheme_profile_document_types);
    if (invalid.length > 0) {
      const err = new Error(
        `Invalid profile document type(s): ${invalid.join(", ")}. Use keys from GET /api/document-types?profile_only=true (e.g. aadhaarCard, birthCertificate, certificateOfIdentification).`
      );
      err.code = "INVALID_PROFILE_DOCUMENT_TYPE";
      err.invalid = invalid;
      throw err;
    }
    result.scheme_profile_document_types = keys;
  }

  const textCount = Array.isArray(result.scheme_required_document_types)
    ? result.scheme_required_document_types.length
    : existingScheme
      ? (await getSchemeRequiredTextLabels(existingScheme)).length
      : 0;
  const profileCount = Array.isArray(result.scheme_profile_document_types)
    ? result.scheme_profile_document_types.length
    : existingScheme
      ? (await getSchemeProfileDocumentKeys(existingScheme)).length
      : 0;

  if (textCount + profileCount === 0) {
    const err = new Error(
      "At least one required document is needed — add custom document names (scheme_required_document_types) and/or profile documents that prepopulate (scheme_profile_document_types)."
    );
    err.code = "NO_REQUIRED_DOCUMENTS";
    throw err;
  }

  return result;
}

module.exports = {
  ensureDocumentTypesSeeded,
  loadRegistry,
  resolveDocumentTypeKey,
  normalizeSchemeRequiredDocumentKeys,
  normalizeSchemeCustomRequiredDocuments,
  normalizeSchemeDocumentsPayload,
  enrichRequiredDocuments,
  listActiveDocumentTypes,
  getProfileReusableKeys,
  validateDocumentTypeKey,
  getDocumentTypeConfig,
  validateUploadedFileAgainstConfig,
  normalizeSchemeRequiredDocumentTexts,
  normalizeProfileDocumentKeys,
  getSchemeProfileDocumentKeys,
  getSchemeRequiredTextLabels,
  getSchemeTextDocumentDescriptors,
  getSchemeAllRequiredDocumentDescriptors,
  resolveSubmittedDocumentKey,
  getApplicantProfileDocuments,
  buildProfileDocumentSlots,
  buildSchemeDocumentRequirements,
  summarizeDocumentRequirements,
  mimeTypesToDropzoneAccept,
  buildApplicantSummaryForApplyForm,
  resolveApplicationDocumentsSubmitted,
  invalidateDocumentTypeCache,
  enrichSchemeForResponse,
  documentsObjectToPlain,
};
