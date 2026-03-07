const mongoose = require("mongoose");

const adSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, "Text is required"],
      trim: true,
    },
    link: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
    image_url: {
      type: String,
      required: false,
      trim: true,
      default: null,
    },
    order: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

adSchema.index({ active: 1, order: 1 });

module.exports = mongoose.model("Ad", adSchema);
