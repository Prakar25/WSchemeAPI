const mongoose = require("mongoose");

const beneficiaryPersonSchema = new mongoose.Schema(
  {
    householdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Household",
      required: true,
      index: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    relationToPrimary: {
      type: String,
      default: "self",
      trim: true,
    },
    aadhaarNumber: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
      match: [/^\d{12}$/, "Aadhaar number must be 12 digits"],
    },
    aadhaarHash: {
      type: String,
      required: false,
      trim: true,
    },
    demographics: {
      fullName: { type: String, trim: true },
      dob: {
        date: { type: Date },
        verified: { type: Boolean, default: false },
      },
      gender: {
        type: String,
        enum: ["M", "F", "O"],
        uppercase: true,
      },
      photo: {
        stored: { type: Boolean, default: false },
        photoId: { type: String, default: null },
      },
    },
    address: {
      careOf: { type: String, default: "", trim: true },
      house: { type: String, default: "", trim: true },
      street: { type: String, default: "", trim: true },
      locality: { type: String, trim: true },
      district: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: {
        type: String,
        trim: true,
        match: [/^\d{6}$/, "Pincode must be 6 digits"],
      },
      country: { type: String, default: "India", trim: true },
    },
    economicStatus: {
      annualIncome: { type: Number },
      category: { type: String, trim: true },
    },
    contact: {
      email: {
        value: { type: String, trim: true, lowercase: true },
        verified: { type: Boolean, default: false },
      },
    },
    kycLevel: {
      type: String,
      enum: ["BASIC", "PARTIAL", "FULL"],
      default: "BASIC",
    },
    documents: {
      aadhaarCard: {
        filePath: { type: String, default: null },
        uploadedAt: { type: Date, default: null },
        verified: { type: Boolean, default: false },
      },
      birthCertificate: {
        filePath: { type: String, default: null },
        uploadedAt: { type: Date, default: null },
        verified: { type: Boolean, default: false },
      },
      certificateOfIdentification: {
        filePath: { type: String, default: null },
        uploadedAt: { type: Date, default: null },
        verified: { type: Boolean, default: false },
      },
    },
    audit: {
      createdAt: { type: Date, default: Date.now },
      lastUpdated: { type: Date, default: Date.now },
      updateCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

beneficiaryPersonSchema.index({ householdId: 1, isPrimary: 1 });

module.exports = mongoose.model("BeneficiaryPerson", beneficiaryPersonSchema);
