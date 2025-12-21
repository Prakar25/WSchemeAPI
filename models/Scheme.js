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
    gender_id: {
      type: Number,
      required: [true, "Gender ID is required"],
    },
    gender_name: {
      type: String,
      required: [true, "Gender name is required"],
      trim: true,
    },
    category_id: {
      type: Number,
      required: [true, "Category ID is required"],
    },
    category_name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
    },
    sub_category_id: {
      type: Number,
      required: [true, "Sub-category ID is required"],
    },
    sub_category_name: {
      type: String,
      required: [true, "Sub-category name is required"],
      trim: true,
    },
    scheme_description: {
      type: String,
      required: [true, "Scheme description is required"],
      trim: true,
    },
    scheme_objectives: {
      type: String,
      required: [true, "Scheme objectives is required"],
    },
    scheme_benefits: {
      type: String,
      required: [true, "Scheme benefits is required"],
    },
    scheme_eligibility_lower_age_limit: {
      type: Number,
      required: [true, "Lower age limit is required"],
    },
    scheme_eligibility_upper_age_limit: {
      type: Number,
      required: [true, "Upper age limit is required"],
    },
    scheme_required_documents: {
      type: String,
      required: [true, "Required documents is required"],
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
        // Map _id to scheme_id for frontend compatibility
        ret.scheme_id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: function (doc, ret) {
        ret.scheme_id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index for faster queries
schemeSchema.index({ scheme_name: 1 });
schemeSchema.index({ category_id: 1 });
schemeSchema.index({ gender_id: 1 });
schemeSchema.index({ sub_category_id: 1 });

module.exports = mongoose.model("Scheme", schemeSchema);
