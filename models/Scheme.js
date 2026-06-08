const mongoose = require("mongoose");

const schemeSchema = new mongoose.Schema(
  {
    scheme_name: {
      type: String,
      required: [true, "Scheme name is required"],
      trim: true,
    },
    scheme_date: {
      type: Date,
      required: false,
    },
    gender: {
      type: String,
      required: [true, "Gender is required"],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      trim: true,
    },
    scheme_description: {
      type: String,
      required: [true, "Scheme description is required"],
      trim: true,
    },
    scheme_objectives: {
      type: [String],
      required: [true, "Scheme objectives is required"],
      validate: {
        validator: function(v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: "Scheme objectives must be a non-empty array"
      }
    },
    scheme_benefits: {
      type: [String],
      required: [true, "Scheme benefits is required"],
      validate: {
        validator: function(v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: "Scheme benefits must be a non-empty array"
      }
    },
    scheme_eligibility: {
      lower_age_limit: {
        type: Number,
        required: [true, "Lower age limit is required"],
      },
      upper_age_limit: {
        type: Number,
        required: [true, "Upper age limit is required"],
      },
      // Informative form field definitions (label, type, required, options) - NOT used for eligibility checks
      custom_fields: {
        type: [
          {
            field_key: { type: String, trim: true },
            title: { type: String, trim: true },
            label: { type: String, trim: true },
            field_type: {
              type: String,
              enum: ["text", "number", "select", "date", "textarea", "checkbox"],
              default: "text",
            },
            required: { type: Boolean, default: false },
            options: { type: [String], default: [] },
          },
        ],
        default: [],
      },
    },
    /** Canonical document type keys from GET /api/document-types (e.g. aadhaarCard). Legacy labels are normalized on save. */
    scheme_required_document_types: {
      type: [String],
      required: [true, "Required document types is required"],
      validate: {
        validator: function(v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: "Required document types must be a non-empty array"
      }
    },
    scheme_required_documents: {
      type: [
        {
          document_type: {
            type: String,
            required: [true, "Document type is required"],
            trim: true,
          },
          file_url: {
            type: String,
            required: [true, "File URL is required"],
            trim: true,
          },
          uploaded_at: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
    },
    scheme_image_file_url: {
      type: String,
      required: false,
      default: null,
    },
    excluded_schemes: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Scheme",
        },
      ],
      default: [],
    },
    // Per-scheme dynamic form fields - defines extra inputs for this scheme's application form
    // Admin adds/removes these when creating or editing a scheme; applicants fill values in form_data
    // title = display label; field_key = key in form_data (derived from title: spaces→_)
    // depends_on = show this field only when parent field has given value (e.g. checkbox checked)
    custom_form_fields: {
      type: [
        {
          field_key: {
            type: String,
            required: [true, "Field key is required"],
            trim: true,
          },
          title: {
            type: String,
            required: false,
            trim: true,
          },
          label: {
            type: String,
            required: false,
            trim: true,
          },
          field_type: {
            type: String,
            enum: ["text", "number", "select", "date", "textarea", "checkbox"],
            default: "text",
          },
          required: {
            type: Boolean,
            default: false,
          },
          options: {
            type: [String],
            default: [],
          },
          depends_on: {
            field_key: { type: String, trim: true },
            value: { type: mongoose.Schema.Types.Mixed },
          },
        },
      ],
      default: [],
    },
    // Authorization levels for the scheme (in order of authorization flow)
    // Sequential: 1=Super Admin, 2=Admin, 3=DistrictHQ Head, 4=District Overlookers (CSCAdmin/5 excluded)
    authorization_levels: {
      type: [Number],
      required: false,
      default: [],
      validate: {
        validator: function(v) {
          // Must use only allowed role levels for scheme workflow (sequential 1-4):
          // 1=Super Admin, 2=Admin, 3=DistrictHQ Head, 4=District Overlookers (CSCAdmin/5 excluded)
          return (
            Array.isArray(v) &&
            v.every((level) => Number.isInteger(level) && [1, 2, 3, 4].includes(level))
          );
        },
        message: "Authorization levels must be an array of integers from [1, 2, 3, 4]"
      }
    },
    // Approval status for scheme creation
    approval_status: {
      type: String,
      enum: ["pending_department_head_approval", "approved", "rejected"],
      default: "pending_department_head_approval",
      required: true,
    },
    // Creator information
    created_by: {
      admin_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AdminUser",
        required: false,
      },
      admin_username: {
        type: String,
        required: false,
      },
      admin_role: {
        type: String,
        required: false,
      },
      created_at: {
        type: Date,
        default: Date.now,
      },
    },
    // Department Head approval information
    department_head_approval: {
      approved_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AdminUser",
        required: false,
      },
      approved_by_username: {
        type: String,
        required: false,
      },
      approved_at: {
        type: Date,
        required: false,
      },
      rejection_reason: {
        type: String,
        required: false,
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Pre-save hook to prevent self-exclusion
schemeSchema.pre('save', async function() {
  if (this.excluded_schemes && this.excluded_schemes.length > 0 && this._id) {
    // Remove self from excluded_schemes if present
    // excluded_schemes are ObjectId strings, so compare as strings
    const currentId = this._id.toString();
    this.excluded_schemes = this.excluded_schemes.filter(
      schemeId => {
        // Handle both ObjectId objects and strings
        const schemeIdStr = schemeId.toString ? schemeId.toString() : String(schemeId);
        return schemeIdStr !== currentId;
      }
    );
  }
});

// Index for faster queries
schemeSchema.index({ scheme_name: 1 });
schemeSchema.index({ category: 1 });
schemeSchema.index({ gender: 1 });
schemeSchema.index({ department: 1 });
schemeSchema.index({ approval_status: 1 });
schemeSchema.index({ "created_by.admin_id": 1 });

module.exports = mongoose.model("Scheme", schemeSchema);
