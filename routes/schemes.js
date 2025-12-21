const express = require("express");
const router = express.Router();
const Scheme = require("../models/Scheme");
const path = require("path");
const fs = require("fs");

// GET /api/schemes - Get all schemes
router.get("/", async (req, res) => {
  try {
    const schemes = await Scheme.find().sort({ createdAt: -1 });

    // Transform to include scheme_id (which is _id)
    const transformedSchemes = schemes.map((scheme) => {
      const schemeObj = scheme.toObject();
      schemeObj.scheme_id = schemeObj._id;
      delete schemeObj._id;
      delete schemeObj.__v;
      return schemeObj;
    });

    res.status(200).json(transformedSchemes);
  } catch (error) {
    console.error("Error fetching schemes:", error);
    res.status(500).json({
      error: "Failed to fetch schemes",
      message: error.message,
    });
  }
});

// POST /api/schemes - Create a new scheme
router.post("/", async (req, res) => {
  try {
    const schemeData = req.body;

    // Create new scheme
    const scheme = await Scheme.create(schemeData);

    // Transform response to include scheme_id
    const schemeObj = scheme.toObject();
    schemeObj.scheme_id = schemeObj._id;
    delete schemeObj._id;
    delete schemeObj.__v;

    res.status(200).json(schemeObj);
  } catch (error) {
    console.error("Error creating scheme:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(422).json({
        error: "Validation error",
        message: messages.join(", "),
      });
    }
    res.status(500).json({
      error: "Failed to create scheme",
      message: error.message,
    });
  }
});

// POST /api/schemes/update - Update a scheme
router.post("/update", async (req, res) => {
  try {
    const { scheme_id, ...updateData } = req.body;

    if (!scheme_id) {
      return res.status(400).json({
        error: "Scheme ID is required",
      });
    }

    // Find and update the scheme
    const scheme = await Scheme.findByIdAndUpdate(scheme_id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!scheme) {
      return res.status(404).json({
        error: "Scheme not found",
      });
    }

    // Transform response to include scheme_id
    const schemeObj = scheme.toObject();
    schemeObj.scheme_id = schemeObj._id;
    delete schemeObj._id;
    delete schemeObj.__v;

    res.status(200).json(schemeObj);
  } catch (error) {
    console.error("Error updating scheme:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid scheme ID",
      });
    }
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(422).json({
        error: "Validation error",
        message: messages.join(", "),
      });
    }
    res.status(500).json({
      error: "Failed to update scheme",
      message: error.message,
    });
  }
});

// POST /api/schemes/deleteImage - Delete image from a scheme
router.post("/deleteImage", async (req, res) => {
  try {
    const { scheme_id } = req.body;

    if (!scheme_id) {
      return res.status(400).json({
        error: "Scheme ID is required",
      });
    }

    // Find the scheme
    const scheme = await Scheme.findById(scheme_id);

    if (!scheme) {
      return res.status(404).json({
        error: "Scheme not found",
      });
    }

    // Get the image file path
    const imagePath = scheme.scheme_image_file_url;

    // Delete the image file from server if it exists
    if (imagePath) {
      // Remove 'public' prefix if present to get the relative path
      const relativePath = imagePath.startsWith("public")
        ? imagePath.substring(7) // Remove 'public' (7 characters)
        : imagePath.startsWith("/")
        ? imagePath.substring(1)
        : imagePath;

      const fullFilePath = path.join(__dirname, "..", "public", relativePath);

      // Check if file exists and delete it
      if (fs.existsSync(fullFilePath)) {
        fs.unlinkSync(fullFilePath);
      }
    }

    // Update scheme to remove image URL
    scheme.scheme_image_file_url = null;
    await scheme.save();

    // Transform response
    const schemeObj = scheme.toObject();
    schemeObj.scheme_id = schemeObj._id;
    delete schemeObj._id;
    delete schemeObj.__v;

    res.status(200).json({
      message: "Image deleted successfully",
      data: schemeObj,
    });
  } catch (error) {
    console.error("Error deleting scheme image:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid scheme ID",
      });
    }
    res.status(500).json({
      error: "Failed to delete image",
      message: error.message,
    });
  }
});

// DELETE /api/schemes/:id - Delete a scheme
router.delete("/:id", async (req, res) => {
  try {
    const scheme = await Scheme.findById(req.params.id);

    if (!scheme) {
      return res.status(404).json({
        error: "Scheme not found",
      });
    }

    // Delete associated image file if it exists
    if (scheme.scheme_image_file_url) {
      const imagePath = scheme.scheme_image_file_url;
      const relativePath = imagePath.startsWith("public")
        ? imagePath.substring(7)
        : imagePath.startsWith("/")
        ? imagePath.substring(1)
        : imagePath;

      const fullFilePath = path.join(__dirname, "..", "public", relativePath);

      if (fs.existsSync(fullFilePath)) {
        fs.unlinkSync(fullFilePath);
      }
    }

    // Delete the scheme
    await Scheme.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: "Scheme deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting scheme:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid scheme ID",
      });
    }
    res.status(500).json({
      error: "Failed to delete scheme",
      message: error.message,
    });
  }
});

module.exports = router;
