const express = require("express");
const router = express.Router();
const DocumentType = require("../models/DocumentType");
const adminAuth = require("../middleware/adminAuth");
const {
  listActiveDocumentTypes,
  invalidateDocumentTypeCache,
  resolveDocumentTypeKey,
} = require("../utils/documentTypeService");

/**
 * GET /api/document-types
 * Public catalog for admin scheme forms, profile upload, and application flow.
 */
router.get("/", async (req, res) => {
  try {
    const profile_only = req.query.profile_only === "true" || req.query.profile_only === "1";
    let types = await listActiveDocumentTypes();
    if (profile_only) {
      types = types.filter((t) => t.profileReusable);
    }
    return res.status(200).json({
      status: "success",
      document_types: types,
      count: types.length,
    });
  } catch (error) {
    console.error("List document types error:", error);
    return res.status(500).json({ status: "error", message: "Failed to list document types" });
  }
});

/**
 * POST /api/document-types
 * Admin: register a new document type (dynamic extension without code deploy).
 * Body: { key, label, aliases?, description?, profileReusable?, sortOrder? }
 */
router.post("/", adminAuth, async (req, res) => {
  try {
    const { key, label, aliases, description, profileReusable, sortOrder, acceptedMimeTypes, maxSizeMb } =
      req.body || {};

    if (!key || !label) {
      return res.status(400).json({ status: "error", message: "key and label are required." });
    }

    const existing = await resolveDocumentTypeKey(key);
    if (existing) {
      return res.status(400).json({ status: "error", message: "Document type key already exists." });
    }

    const doc = await DocumentType.create({
      key: String(key).trim(),
      label: String(label).trim(),
      aliases: Array.isArray(aliases) ? aliases.map((a) => String(a).trim()).filter(Boolean) : [],
      description: description ? String(description).trim() : "",
      profileReusable: !!profileReusable,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 100,
      acceptedMimeTypes: Array.isArray(acceptedMimeTypes) ? acceptedMimeTypes : undefined,
      maxSizeMb: maxSizeMb ?? 10,
      active: true,
    });

    invalidateDocumentTypeCache();

    return res.status(201).json({
      status: "success",
      message: "Document type created.",
      document_type: doc,
    });
  } catch (error) {
    console.error("Create document type error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ status: "error", message: "Document type key already exists." });
    }
    if (error.name === "ValidationError") {
      return res.status(422).json({ status: "error", message: error.message });
    }
    return res.status(500).json({ status: "error", message: "Failed to create document type" });
  }
});

module.exports = router;
