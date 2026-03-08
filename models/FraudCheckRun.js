const mongoose = require("mongoose");

const fraudAlertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["duplicate", "ineligible"],
      required: true,
    },
    applicantName: String,
    applicantId: { type: mongoose.Schema.Types.ObjectId, ref: "PublicUser" },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application" },
    schemeId: { type: mongoose.Schema.Types.ObjectId, ref: "Scheme" },
    schemeName: String,
    reason: String, // eligibility failure reason (for ineligible)
    detectedAt: Date,
  },
  { _id: false }
);

const fraudCheckRunSchema = new mongoose.Schema(
  {
    runAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    duplicatesFound: {
      type: Number,
      default: 0,
    },
    ineligibleFound: {
      type: Number,
      default: 0,
    },
    alerts: [fraudAlertSchema],
    status: {
      type: String,
      enum: ["success", "error"],
      default: "success",
    },
    errorMessage: String,
    durationMs: Number,
  },
  { timestamps: true }
);

fraudCheckRunSchema.index({ runAt: -1 });

module.exports = mongoose.model("FraudCheckRun", fraudCheckRunSchema);
