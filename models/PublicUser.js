const mongoose = require("mongoose");

const publicUserSchema = new mongoose.Schema(
  {
    aadhaarNumber: {
      type: String,
      required: [true, "Aadhaar number is required"],
      unique: true,
      trim: true,
      match: [/^\d{12}$/, "Aadhaar number must be 12 digits"],
    },
    aadhaarHash: {
      type: String,
      required: [true, "Aadhaar hash is required"],
      trim: true,
    },
    demographics: {
      fullName: {
        type: String,
        required: [true, "Full name is required"],
        trim: true,
      },
      dob: {
        date: {
          type: Date,
          required: [true, "Date of birth is required"],
        },
        verified: {
          type: Boolean,
          default: true,
        },
      },
      gender: {
        type: String,
        required: [true, "Gender is required"],
        enum: ["M", "F", "O"],
        uppercase: true,
      },
      photo: {
        stored: {
          type: Boolean,
          default: false,
        },
        photoId: {
          type: String,
          default: null,
        },
      },
    },
    address: {
      careOf: {
        type: String,
        default: "",
        trim: true,
      },
      house: {
        type: String,
        default: "",
        trim: true,
      },
      street: {
        type: String,
        default: "",
        trim: true,
      },
      locality: {
        type: String,
        required: [true, "Locality is required"],
        trim: true,
      },
      district: {
        type: String,
        required: [true, "District is required"],
        trim: true,
      },
      state: {
        type: String,
        required: [true, "State is required"],
        trim: true,
      },
      pincode: {
        type: String,
        required: [true, "Pincode is required"],
        trim: true,
        match: [/^\d{6}$/, "Pincode must be 6 digits"],
      },
      country: {
        type: String,
        default: "India",
        trim: true,
      },
    },
    contact: {
      mobile: {
        value: {
          type: String,
          required: [true, "Mobile number is required"],
          trim: true,
        },
        verified: {
          type: Boolean,
          default: false,
        },
      },
      email: {
        value: {
          type: String,
          required: [true, "Email is required"],
          trim: true,
          lowercase: true,
          match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
        },
        verified: {
          type: Boolean,
          default: false,
        },
      },
    },
    biometrics: {
      fingerprints: {
        stored: {
          type: Boolean,
          default: false,
        },
        encryptedRef: {
          type: String,
          default: null,
        },
      },
      iris: {
        stored: {
          type: Boolean,
          default: false,
        },
        encryptedRef: {
          type: String,
          default: null,
        },
      },
      face: {
        stored: {
          type: Boolean,
          default: false,
        },
        encryptedRef: {
          type: String,
          default: null,
        },
      },
    },
    status: {
      isActive: {
        type: Boolean,
        default: true,
      },
      isDeactivated: {
        type: Boolean,
        default: false,
      },
      reason: {
        type: String,
        default: null,
      },
    },
    kycLevel: {
      type: String,
      enum: ["BASIC", "PARTIAL", "FULL"],
      default: "BASIC",
    },
    audit: {
      createdAt: {
        type: Date,
        default: Date.now,
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
      updateCount: {
        type: Number,
        default: 0,
      },
    },
    authentication: {
      lastAuthAt: {
        type: Date,
        default: null,
      },
      authMethodsUsed: {
        type: [String],
        enum: ["OTP", "DEMOGRAPHIC", "BIOMETRIC", "PIN"],
        default: [],
      },
    },
  },
  {
    timestamps: false, // We're using custom audit timestamps
  }
);

// Index for faster queries
publicUserSchema.index({ aadhaarNumber: 1 });
publicUserSchema.index({ "contact.email.value": 1 });
publicUserSchema.index({ "contact.mobile.value": 1 });
publicUserSchema.index({ "demographics.fullName": 1 });

module.exports = mongoose.model("PublicUser", publicUserSchema);
