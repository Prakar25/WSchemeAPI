const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PublicUser",
      required: [true, "User ID is required"],
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
      enum: ["Applied", "Under Review", "Approved", "Rejected", "Pending"],
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
    verification_level: {
      type: Number,
      enum: [0, 9, 7, 8, 1, 2, 6, 4, 5, 3, 99], // 0=Applied, 9=CSD Admin (first), 7/8=Post Operator, 1/2=Admin, 6=District, 4/5=Dept, 3=Secretary, 99=Completed
      default: 0, // Applied
    },
    // Legacy field for backward compatibility (will be removed)
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
    // Legacy fields (kept for backward compatibility)
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
  },
  {
    timestamps: true,
  }
);

// Helper function to get stage name from level
function getStageNameFromLevel(level) {
  const stageMap = {
    0: "Applied",
    9: "CSD_Admin_Review",
    7: "Post_Operator_Review",
    8: "Post_Operator_Review",
    1: "Admin_Review",
    2: "Admin_Review",
    6: "District_Head_Review",
    4: "Department_Review",
    5: "Department_Review",
    3: "Secretary_Review",
    99: "Completed"
  };
  return stageMap[level] || "Applied";
}

// Helper function to get required role levels for a verification level
function getRequiredRoleLevels(level) {
  const levelMap = {
    0: [9],    // Applied -> CSD Admin (9) first
    9: [9],    // CSD Admin Review
    7: [7, 8], // Post Operator Review
    8: [7, 8], // Post Operator Review
    1: [1, 2], // Admin Review
    2: [1, 2], // Admin Review
    6: [6],    // District Head Review
    4: [4, 5], // Department Review
    5: [4, 5], // Department Review
    3: [3],    // Secretary Review
    99: []     // Completed
  };
  return levelMap[level] || [9];
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
applicationSchema.index({ verification_stage: 1 }); // Keep for backward compatibility
applicationSchema.index({ "current_verifier.verified_by": 1 });
applicationSchema.index({ user_id: 1, scheme_id: 1 }); // Compound index for duplicate detection

module.exports = mongoose.model("Application", applicationSchema);
module.exports.getStageNameFromLevel = getStageNameFromLevel;
module.exports.getRequiredRoleLevels = getRequiredRoleLevels;

