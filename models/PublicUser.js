const mongoose = require("mongoose");

const publicUserSchema = new mongoose.Schema(
  {
    aadhaarNumber: {
      type: String,
      required: false, // Optional - not required for mobile-based registration
      unique: true,
      sparse: true, // Allow multiple null values
      trim: true,
      match: [/^\d{12}$/, "Aadhaar number must be 12 digits"],
    },
    aadhaarHash: {
      type: String,
      required: false, // Optional - not required for mobile-based registration
      trim: true,
    },
    demographics: {
      fullName: {
        type: String,
        required: false, // Optional - can be added later
        trim: true,
      },
      dob: {
        date: {
          type: Date,
          required: false, // Optional - can be added later
        },
        verified: {
          type: Boolean,
          default: false,
        },
      },
      gender: {
        type: String,
        required: false, // Optional - can be added later
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
        required: false, // Optional - can be added later
        trim: true,
      },
      district: {
        type: String,
        required: false, // Optional - can be added later
        trim: true,
      },
      state: {
        type: String,
        required: false, // Optional - can be added later
        trim: true,
      },
      pincode: {
        type: String,
        required: false, // Optional - can be added later
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
          match: [/^[6-9]\d{9}$/, "Mobile number must be a valid 10-digit Indian number"],
        },
        verified: {
          type: Boolean,
          default: false,
        },
      },
      email: {
        value: {
          type: String,
          required: false, // Optional - not required for mobile-based registration
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
    documents: {
      aadhaarCard: {
        filePath: {
          type: String,
          default: null,
        },
        uploadedAt: {
          type: Date,
          default: null,
        },
        verified: {
          type: Boolean,
          default: false,
        },
      },
      birthCertificate: {
        filePath: {
          type: String,
          default: null,
        },
        uploadedAt: {
          type: Date,
          default: null,
        },
        verified: {
          type: Boolean,
          default: false,
        },
      },
      certificateOfIdentification: {
        filePath: {
          type: String,
          default: null,
        },
        uploadedAt: {
          type: Date,
          default: null,
        },
        verified: {
          type: Boolean,
          default: false,
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
      verificationStatus: {
        type: String,
        enum: ["pending", "verified", "rejected"],
        default: "pending", // Set to pending after profile completion, verified by CSDAdmin
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AdminUser",
        default: null, // CSDAdmin who verified the user
      },
      verifiedAt: {
        type: Date,
        default: null, // Timestamp when verified by CSDAdmin
      },
      rejectionReason: {
        type: String,
        default: null, // Reason if verification is rejected
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
// Note: aadhaarNumber index is automatically created by unique: true (sparse)
publicUserSchema.index({ "contact.email.value": 1 });
publicUserSchema.index({ "contact.mobile.value": 1 }, { unique: true }); // Mobile number must be unique for login
publicUserSchema.index({ "demographics.fullName": 1 });

module.exports = mongoose.model("PublicUser", publicUserSchema);
