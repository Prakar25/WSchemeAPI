const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const crypto = require("crypto");
const AdminUser = require("../models/AdminUser");
const PublicUser = require("../models/PublicUser");
const { hashPassword } = require("../utils/passwordUtils");

// Helper function to generate aadhaar hash
const generateAadhaarHash = (aadhaarNumber) => {
  return crypto.createHash("md5").update(aadhaarNumber).digest("hex");
};

// Helper function to convert date string (DD-MM-YYYY) to Date object
const parseDate = (dateString) => {
  if (!dateString) {
    throw new Error("Date string is required");
  }
  const [day, month, year] = dateString.split("-");
  if (!day || !month || !year) {
    throw new Error(`Invalid date format: ${dateString}. Expected DD-MM-YYYY`);
  }
  return new Date(`${year}-${month}-${day}`);
};

// Helper function to convert gender to single letter
const convertGender = (gender) => {
  if (!gender) {
    return "O";
  }
  const genderMap = {
    male: "M",
    female: "F",
    other: "O",
  };
  return genderMap[gender.toLowerCase()] || "O";
};

// Helper function to parse address string into structured format
const parseAddress = (addressString) => {
  if (!addressString) {
    throw new Error("Address string is required");
  }
  // Simple parsing - you may want to enhance this based on your address format
  const parts = addressString.split(",").map((p) => p.trim());

  // Common Sikkim districts
  const districts = [
    "East Sikkim",
    "West Sikkim",
    "North Sikkim",
    "South Sikkim",
  ];

  let locality = parts[0];
  let district = "East Sikkim"; // default
  let state = "Sikkim";

  // Try to find district in address
  for (const dist of districts) {
    if (addressString.includes(dist)) {
      district = dist;
      break;
    }
  }

  return {
    careOf: "",
    house: "",
    street: "",
    locality: locality,
    district: district,
    state: state,
    pincode: "737101", // Default pincode for Sikkim
    country: "India",
  };
};

// POST /api/seed - Insert dummy data
router.post("/", async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error:
          "Database not connected. Please wait for the connection to be established.",
      });
    }

    const adminUsers = [
      {
        fullName: "Karma Tshering",
        username: "karma.tshering",
        contactNumber: "9876543210",
        password: "Admin@123",
      },
      {
        fullName: "Maya Subba",
        username: "maya.subba",
        contactNumber: "9123456780",
        password: "Admin@456",
      },
    ];

    const publicUsersData = [
      {
        fullName: "Tashi Lepcha",
        contactEmail: "tashi.lepcha@example.com",
        phoneNumber: "9800015247",
        address: "Gangtok, Sikkim",
        dob: "12-03-1990",
        aadhaar: "123456789012",
        gender: "female",
      },
      {
        fullName: "Suman Chhetri",
        contactEmail: "suman.chettri@example.com",
        phoneNumber: "9802216258",
        address: "Pakyong, Sikkim",
        dob: "22-09-1988",
        aadhaar: "987654321098",
        gender: "male",
      },
      {
        fullName: "Mingma Sherpa",
        contactEmail: "mingma.sherpa@example.com",
        phoneNumber: "9805511468",
        address: "Namchi, Sikkim",
        dob: "17-05-1993",
        aadhaar: "564738291034",
        gender: "male",
      },
      {
        fullName: "Pema Tamang",
        contactEmail: "pema.tamang@example.com",
        phoneNumber: "9808811258",
        address: "Mangan, North Sikkim",
        dob: "03-08-1995",
        aadhaar: "675849302156",
        gender: "female",
      },
      {
        fullName: "Rinchen Bhutia",
        contactEmail: "rinchen.bhutia@example.com",
        phoneNumber: "9811115472",
        address: "Ravangla, Sikkim",
        dob: "25-11-1991",
        aadhaar: "453627890123",
        gender: "female",
      },
      {
        fullName: "Tashi Gurung",
        contactEmail: "tashi.gurung@example.com",
        phoneNumber: "9814413587",
        address: "Gyalshing, West Sikkim",
        dob: "10-04-1994",
        aadhaar: "890123456789",
        gender: "male",
      },
      {
        fullName: "Lhamu Sherpa",
        contactEmail: "lhamu.sherpa@example.com",
        phoneNumber: "9817713957",
        address: "Dentam, Sikkim",
        dob: "27-01-1992",
        aadhaar: "321654987012",
        gender: "female",
      },
      {
        fullName: "Bijay Rai",
        contactEmail: "bijay.rai@example.com",
        phoneNumber: "9820014587",
        address: "Jorethang, Sikkim",
        dob: "16-06-1990",
        aadhaar: "789654123098",
        gender: "male",
      },
      {
        fullName: "Anita Subba",
        contactEmail: "anita.subba@example.com",
        phoneNumber: "9823313164",
        address: "Tadong, Sikkim",
        dob: "30-12-1996",
        aadhaar: "234567890111",
        gender: "female",
      },
      {
        fullName: "Sangay Tamang",
        contactEmail: "sangay.tamang@example.com",
        phoneNumber: "9826615126",
        address: "Lachung, Sikkim",
        dob: "08-07-1987",
        aadhaar: "998877665544",
        gender: "male",
      },
    ];

    // Transform public users data to match new schema
    const publicUsers = publicUsersData.map((user, index) => {
      try {
        if (!user || typeof user !== "object") {
          throw new Error(`Invalid user data at index ${index}`);
        }

        const addressObj = parseAddress(user.address);
        const dobDate = parseDate(user.dob);
        const genderCode = convertGender(user.gender);
        const aadhaarHash = generateAadhaarHash(user.aadhaar);

        return {
          aadhaarNumber: user.aadhaar,
          aadhaarHash: aadhaarHash,
          demographics: {
            fullName: user.fullName,
            dob: {
              date: dobDate,
              verified: true,
            },
            gender: genderCode,
            photo: {
              stored: true,
              photoId: `photo_${Math.floor(Math.random() * 1000000)}`,
            },
          },
          address: addressObj,
          contact: {
            mobile: {
              value: user.phoneNumber,
              verified: true,
            },
            email: {
              value: user.contactEmail,
              verified: false,
            },
          },
          biometrics: {
            fingerprints: {
              stored: true,
              encryptedRef: `bio_fp_${Math.floor(Math.random() * 1000000)}`,
            },
            iris: {
              stored: true,
              encryptedRef: `bio_ir_${Math.floor(Math.random() * 1000000)}`,
            },
            face: {
              stored: true,
              encryptedRef: `bio_fc_${Math.floor(Math.random() * 1000000)}`,
            },
          },
          status: {
            isActive: true,
            isDeactivated: false,
            reason: null,
          },
          kycLevel: "FULL",
          audit: {
            createdAt: new Date(),
            lastUpdated: new Date(),
            updateCount: 0,
          },
          authentication: {
            lastAuthAt: null,
            authMethodsUsed: [],
          },
        };
      } catch (transformError) {
        throw new Error(
          `Error transforming user at index ${index}: ${transformError.message}`
        );
      }
    });

    // Clear existing data (optional - remove if you want to keep existing data)
    try {
      const deleteAdminResult = await AdminUser.deleteMany({});
      const deletePublicResult = await PublicUser.deleteMany({});
      console.log(
        `Deleted ${deleteAdminResult.deletedCount} admin users and ${deletePublicResult.deletedCount} public users`
      );
    } catch (deleteError) {
      console.error("Error deleting existing data:", deleteError);
      // Continue anyway - might be first run
    }

    // Drop old indexes that might conflict with new schema
    try {
      const publicUserCollection = PublicUser.collection;
      const indexes = await publicUserCollection.indexes();

      // Drop old indexes from previous schema versions
      const oldIndexesToDrop = ["contactEmail_1", "aadhaar_1", "phoneNumber_1"];

      for (const indexName of oldIndexesToDrop) {
        try {
          const indexExists = indexes.find((idx) => idx.name === indexName);
          if (indexExists) {
            await publicUserCollection.dropIndex(indexName);
            console.log(`Dropped old index: ${indexName}`);
          }
        } catch (dropError) {
          // Index might not exist, that's okay
          if (dropError.code !== 27) {
            // 27 is "IndexNotFound" error code
            console.warn(
              `Could not drop index ${indexName}:`,
              dropError.message
            );
          }
        }
      }
    } catch (indexError) {
      console.warn("Error managing indexes:", indexError.message);
      // Continue anyway - indexes might not exist
    }

    // Insert admin users (hash passwords before insert)
    const adminUsersWithHashedPasswords = await Promise.all(
      adminUsers.map(async (u) => ({
        ...u,
        password: await hashPassword(u.password),
      }))
    );
    const insertedAdminUsers = await AdminUser.insertMany(adminUsersWithHashedPasswords);

    // Insert public users
    const insertedPublicUsers = await PublicUser.insertMany(publicUsers);

    res.status(201).json({
      success: true,
      message: "Dummy data inserted successfully",
      data: {
        adminUsers: {
          count: insertedAdminUsers.length,
          users: insertedAdminUsers,
        },
        publicUsers: {
          count: insertedPublicUsers.length,
          users: insertedPublicUsers,
        },
      },
    });
  } catch (error) {
    console.error("Seed error:", error);
    console.error("Error name:", error.name);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    console.error(
      "Full error object:",
      JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    );

    // Handle duplicate key errors (MongoDB error code 11000)
    if (
      error.code === 11000 ||
      error.code === 11001 ||
      error.message?.includes("duplicate key")
    ) {
      // Try multiple ways to extract duplicate field information
      let duplicateField = null;
      let duplicateValue = null;

      // Method 1: Check error.keyPattern
      if (error.keyPattern && typeof error.keyPattern === "object") {
        const keys = Object.keys(error.keyPattern);
        if (keys.length > 0) {
          duplicateField = keys[0];
          duplicateValue = error.keyValue?.[duplicateField];
        }
      }

      // Method 2: Check error.keyValue directly
      if (
        !duplicateField &&
        error.keyValue &&
        typeof error.keyValue === "object"
      ) {
        const keys = Object.keys(error.keyValue);
        if (keys.length > 0) {
          duplicateField = keys[0];
          duplicateValue = error.keyValue[duplicateField];
        }
      }

      // Method 3: Parse error message (e.g., "E11000 duplicate key error collection: ... index: username_1 dup key: { username: \"test\" }")
      if (!duplicateField && error.message) {
        const indexMatch = error.message.match(/index:\s*(\w+)_/);
        const dupKeyMatch = error.message.match(
          /dup key:\s*\{[^}]*(\w+):\s*"([^"]+)"/
        );
        if (indexMatch) {
          duplicateField = indexMatch[1];
        }
        if (dupKeyMatch && dupKeyMatch.length >= 3) {
          duplicateField = dupKeyMatch[1];
          duplicateValue = dupKeyMatch[2];
        }
      }

      // Method 4: Check writeErrors for bulk operations
      if (
        !duplicateField &&
        error.writeErrors &&
        Array.isArray(error.writeErrors) &&
        error.writeErrors.length > 0
      ) {
        const writeError = error.writeErrors[0];
        if (
          writeError.keyPattern &&
          typeof writeError.keyPattern === "object"
        ) {
          const keys = Object.keys(writeError.keyPattern);
          if (keys.length > 0) {
            duplicateField = keys[0];
            duplicateValue = writeError.keyValue?.[duplicateField];
          }
        }
        if (
          !duplicateField &&
          writeError.keyValue &&
          typeof writeError.keyValue === "object"
        ) {
          const keys = Object.keys(writeError.keyValue);
          if (keys.length > 0) {
            duplicateField = keys[0];
            duplicateValue = writeError.keyValue[duplicateField];
          }
        }
      }

      return res.status(400).json({
        success: false,
        error: duplicateField
          ? `Duplicate entry detected. Field: ${duplicateField}${
              duplicateValue ? `, Value: ${duplicateValue}` : ""
            }`
          : "Duplicate entry detected, but unable to identify the duplicate field.",
        details: {
          code: error.code,
          message: error.message,
          keyPattern: error.keyPattern,
          keyValue: error.keyValue,
          writeErrors: error.writeErrors,
        },
      });
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors || {}).map(
        (err) => err.message
      );
      return res.status(400).json({
        success: false,
        error: messages.join(", ") || error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || "Something went wrong!",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

module.exports = router;
