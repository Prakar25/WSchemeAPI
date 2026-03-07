const express = require("express");
const router = express.Router();
const Ad = require("../models/Ad");
const AdminUser = require("../models/AdminUser");
const adminAuth = require("../middleware/adminAuth");
const requireRole = require("../middleware/requireRole");

// GET /api/ads/public - Return active ads in display order (no auth)
router.get("/public", async (req, res) => {
  try {
    const ads = await Ad.find({ active: true })
      .sort({ order: 1, createdAt: 1 })
      .select("_id text link image_url order");

    const list = ads.map((ad) => ({
      id: ad._id.toString(),
      _id: ad._id.toString(),
      text: ad.text,
      link: ad.link || null,
      image: ad.image_url || null,
      image_url: ad.image_url || null,
    }));

    res.status(200).json(list);
  } catch (error) {
    console.error("Error fetching public ads:", error);
    res.status(500).json({
      error: "Failed to fetch ads",
      message: error.message,
    });
  }
});

// Admin routes - Super Admin only
const adminAds = [adminAuth, requireRole([AdminUser.ROLES.SUPER_ADMIN])];

// GET /api/ads - List all ads (Super Admin only)
router.get("/", adminAds, async (req, res) => {
  try {
    const ads = await Ad.find({}).sort({ order: 1, createdAt: 1 });

    res.status(200).json(ads);
  } catch (error) {
    console.error("Error fetching ads:", error);
    res.status(500).json({
      error: "Failed to fetch ads",
      message: error.message,
    });
  }
});

// POST /api/ads - Create ad (Super Admin only)
router.post("/", adminAds, async (req, res) => {
  try {
    const { text, link, image_url, order, active } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        status: "error",
        message: "text is required",
      });
    }

    const ad = await Ad.create({
      text: text.trim(),
      link: link != null ? String(link).trim() || null : null,
      image_url: image_url != null ? String(image_url).trim() || null : null,
      order: typeof order === "number" ? order : parseInt(order, 10) || 0,
      active: active !== false && active !== "false",
    });

    res.status(201).json(ad);
  } catch (error) {
    console.error("Error creating ad:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(422).json({
        status: "error",
        message: messages.join(", "),
      });
    }
    res.status(500).json({
      error: "Failed to create ad",
      message: error.message,
    });
  }
});

// POST /api/ads/reorder - Reorder ads (Super Admin only)
router.post("/reorder", adminAds, async (req, res) => {
  try {
    const { orders } = req.body; // [{ id: "ObjectId", order: 0 }, ...]

    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "orders array is required with items { id, order }",
      });
    }

    for (const item of orders) {
      const { id, order } = item;
      if (!id || typeof order !== "number") continue;
      await Ad.findByIdAndUpdate(id, { order });
    }

    const ads = await Ad.find({}).sort({ order: 1, createdAt: 1 });
    res.status(200).json({
      status: "success",
      message: "Ads reordered",
      ads,
    });
  } catch (error) {
    console.error("Error reordering ads:", error);
    res.status(500).json({
      error: "Failed to reorder ads",
      message: error.message,
    });
  }
});

// PUT /api/ads/:id - Update ad (Super Admin only)
router.put("/:id", adminAds, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, link, image_url, order, active } = req.body;

    const ad = await Ad.findById(id);
    if (!ad) {
      return res.status(404).json({
        status: "error",
        message: "Ad not found",
      });
    }

    if (text !== undefined) ad.text = String(text).trim();
    if (link !== undefined) ad.link = link != null ? String(link).trim() || null : null;
    if (image_url !== undefined) ad.image_url = image_url != null ? String(image_url).trim() || null : null;
    if (order !== undefined) ad.order = typeof order === "number" ? order : parseInt(order, 10) || 0;
    if (active !== undefined) ad.active = active !== false && active !== "false";

    await ad.save();

    res.status(200).json(ad);
  } catch (error) {
    console.error("Error updating ad:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(422).json({
        status: "error",
        message: messages.join(", "),
      });
    }
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid ad ID",
      });
    }
    res.status(500).json({
      error: "Failed to update ad",
      message: error.message,
    });
  }
});

// DELETE /api/ads/:id - Delete ad (Super Admin only)
router.delete("/:id", adminAds, async (req, res) => {
  try {
    const { id } = req.params;

    const ad = await Ad.findByIdAndDelete(id);
    if (!ad) {
      return res.status(404).json({
        status: "error",
        message: "Ad not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Ad deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting ad:", error);
    if (error.name === "CastError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid ad ID",
      });
    }
    res.status(500).json({
      error: "Failed to delete ad",
      message: error.message,
    });
  }
});

module.exports = router;
