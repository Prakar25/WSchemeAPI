const mongoose = require("mongoose");

/**
 * Household = one mobile OTP account; multiple BeneficiaryPerson docs can belong to it.
 * Linked 1:1 with PublicUser for backward compatibility (publicUserId).
 */
const householdSchema = new mongoose.Schema(
  {
    publicUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PublicUser",
      required: true,
      unique: true,
    },
    contact: {
      mobile: {
        value: {
          type: String,
          required: true,
          trim: true,
          match: [/^[6-9]\d{9}$/, "Mobile number must be a valid 10-digit Indian number"],
        },
        verified: { type: Boolean, default: false },
      },
    },
    status: {
      isActive: { type: Boolean, default: true },
      isDeactivated: { type: Boolean, default: false },
      reason: { type: String, default: null },
      verificationStatus: {
        type: String,
        enum: ["pending", "verified", "rejected"],
        default: "verified",
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AdminUser",
        default: null,
      },
      verifiedAt: { type: Date, default: null },
      rejectionReason: { type: String, default: null },
    },
    authentication: {
      lastAuthAt: { type: Date, default: null },
      authMethodsUsed: {
        type: [String],
        enum: ["OTP", "DEMOGRAPHIC", "BIOMETRIC", "PIN"],
        default: [],
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

householdSchema.index({ "contact.mobile.value": 1 }, { unique: true });

module.exports = mongoose.model("Household", householdSchema);
