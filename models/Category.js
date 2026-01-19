const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    category_name: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    category_display_name: {
      type: String,
      required: [true, "Category display name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
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
      created_at: {
        type: Date,
        default: Date.now,
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

// Index for faster queries
// Note: category_name already has an index from unique: true, so we don't need to create it again
categorySchema.index({ isActive: 1 });

module.exports = mongoose.model("Category", categorySchema);
