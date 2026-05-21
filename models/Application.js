const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Applicant ID is required"],
      refPath: "applicant_ref_model",
    },
    /** PublicUser (legacy) or BeneficiaryPerson (household member). */
    applicant_ref_model: {
      type: String,
      enum: ["PublicUser", "BeneficiaryPerson"],
      default: "PublicUser",
    },
    scheme_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Scheme",
      required: [true, "Scheme ID is required"],
    },
    // Authorization levels from the scheme (stores the workflow sequence)
    authorization_levels: {
      type: [Number],
      required: false,
      default: [],
    },
    // Current index in the authorization_levels array (tracks progress through workflow)
    authorization_level_index: {
      type: Number,
      required: false,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Applied", "Under Review", "Approved", "Rejected", "Pending", "Bioauthentication", "Benefit Transferred"],
      default: "Applied",
    },
    date_applied: {
      type: Date,
      default: Date.now,
    },
    // Application form data
    form_data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    documents_submitted: [
      {
        document_type: {
          type: String,
          required: true,
          trim: true,
        },
        file_url: {
          type: String,
          required: true,
          trim: true,
        },
        uploaded_at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Verification workflow level (store as number, not string)
    // Sequential: 0=Applied, 5=CSC Admin (first), 4=District Overlookers, 1/2=Admin, 3=DistrictHQ Head, 99=Completed
    // 6,7,8,9 normalized to 3,4,5 via normalizeVerificationLevel
    verification_level: {
      type: Number,
      enum: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 99],
      default: 0, // Applied
    },
    verification_stage: {
      type: String,
      required: false,
    },
    // Verification history - tracks all verifications
    verification_history: [
      {
        stage: {
          type: String,
          required: true,
        },
        verified_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "AdminUser",
          required: true,
        },
        verified_by_name: {
          type: String,
          required: true,
        },
        verified_by_role: {
          type: String,
          required: true,
        },
        verified_by_role_level: {
          type: Number,
          required: true,
        },
        action: {
          type: String,
          enum: ["Verified", "Rejected", "Forwarded", "Returned"],
          required: true,
        },
        remarks: {
          type: String,
          default: null,
        },
        verified_at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Current verification details
    current_verifier: {
      verified_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AdminUser",
        default: null,
      },
      verified_by_name: {
        type: String,
        default: null,
      },
      verified_by_role: {
        type: String,
        default: null,
      },
      verified_by_role_level: {
        type: Number,
        default: null,
      },
      remarks: {
        type: String,
        default: null,
      },
      verified_at: {
        type: Date,
        default: null,
      },
    },
    remarks: {
      type: String,
      default: null,
      trim: true,
    },
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      default: null,
    },
    reviewed_at: {
      type: Date,
      default: null,
    },
    // OTP verification for Admin_Review completion (Super Admin/Admin must verify applicant OTP before approving)
    completion_otp_verified_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Map verification levels to sequential (1-5)
// Only map old levels (6,7,8,9) - leave 3,4,5 as-is (already sequential)
function normalizeVerificationLevel(level) {
  const n = typeof level === "number" ? level : parseInt(level, 10);
  if (!Number.isInteger(n)) return 0;
  if (n === 9) return 5;   // CSC Admin
  if (n === 7 || n === 8) return 4; // District Overlookers
  if (n === 6) return 3;   // DistrictHQ Head
  return n; // 0, 1, 2, 3, 4, 5, 99 stay as-is
}

// Helper function to get stage name from level (sequential levels 1-5)
function getStageNameFromLevel(level) {
  const normalized = normalizeVerificationLevel(level);
  const stageMap = {
    0: "Applied",
    5: "CSC_Admin_Review",
    4: "District_Overlookers_Review",
    1: "Admin_Review",
    2: "Admin_Review",
    3: "District_Head_Review",
    99: "Completed"
  };
  return stageMap[normalized] || "Applied";
}

// Helper function to get required role levels for a verification level (sequential 1-5)
function getRequiredRoleLevels(level) {
  const normalized = normalizeVerificationLevel(level);
  const levelMap = {
    0: [5],    // Applied -> CSC Admin (5) first
    5: [5],    // CSC Admin Review
    4: [4],    // District_Overlookers_Review handled by District Overlookers (4)
    1: [1, 2], // Admin Review
    2: [1, 2], // Admin Review
    3: [3],    // District_Head_Review - DistrictHQ Head (3)
    99: []     // Completed
  };
  return levelMap[normalized] || [5];
}

// Virtual to get stage name
applicationSchema.virtual('verification_stage_name').get(function() {
  return getStageNameFromLevel(this.verification_level);
});

// Transform to include stage name in JSON
applicationSchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc, ret) {
    ret.verification_stage = getStageNameFromLevel(ret.verification_level);
    ret.verification_stage_name = getStageNameFromLevel(ret.verification_level);
    ret.required_role_levels = getRequiredRoleLevels(ret.verification_level);
    return ret;
  }
});

// Index for faster queries
applicationSchema.index({ user_id: 1 });
applicationSchema.index({ scheme_id: 1 });
applicationSchema.index({ status: 1 });
applicationSchema.index({ verification_level: 1 });
applicationSchema.index({ verification_stage: 1 });
applicationSchema.index({ "current_verifier.verified_by": 1 });
applicationSchema.index({ user_id: 1, scheme_id: 1 }); // Compound index for duplicate detection

module.exports = mongoose.model("Application", applicationSchema);
module.exports.getStageNameFromLevel = getStageNameFromLevel;
module.exports.getRequiredRoleLevels = getRequiredRoleLevels;
module.exports.normalizeVerificationLevel = normalizeVerificationLevel;

