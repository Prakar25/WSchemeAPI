const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
  {
    department_name: {
      type: String,
      required: [true, "Department name is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    department_display_name: {
      type: String,
      required: [true, "Department display name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
    contact_info: {
      email: {
        type: String,
        required: false,
        trim: true,
        lowercase: true,
        default: null,
      },
      phone: {
        type: String,
        required: false,
        trim: true,
        default: null,
      },
      address: {
        type: String,
        required: false,
        trim: true,
        default: null,
      },
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
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
// Note: department_name already has an index from unique: true
departmentSchema.index({ isActive: 1 });
departmentSchema.index({ categories: 1 });

module.exports = mongoose.model("Department", departmentSchema);
