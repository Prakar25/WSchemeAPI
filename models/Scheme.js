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
    sub_category: {
      type: String,
      required: [true, "Sub-category is required"],
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
    },
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

// Index for faster queries
schemeSchema.index({ scheme_name: 1 });
schemeSchema.index({ category: 1 });
schemeSchema.index({ gender: 1 });
schemeSchema.index({ sub_category: 1 });

module.exports = mongoose.model("Scheme", schemeSchema);
