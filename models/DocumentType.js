const mongoose = require("mongoose");

/**
 * Master list of document types for schemes, profile KYC uploads, and applications.
 * scheme_required_document_types stores `key` values (e.g. aadhaarCard).
 * `aliases` map legacy display strings ("Aadhaar Card") to the same key.
 */
const documentTypeSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: false,
      match: [/^[a-z][a-zA-Z0-9_]*$/, "Key must be camelCase (e.g. aadhaarCard)"],
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    aliases: {
      type: [String],
      default: [],
    },
    /** If true, file uploaded on public profile can prefill scheme applications. */
    profileReusable: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    acceptedMimeTypes: {
      type: [String],
      default: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    },
    maxSizeMb: {
      type: Number,
      default: 10,
    },
  },
  { timestamps: true }
);

documentTypeSchema.index({ active: 1, sortOrder: 1 });

module.exports = mongoose.model("DocumentType", documentTypeSchema);
