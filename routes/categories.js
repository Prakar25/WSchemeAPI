const express = require("express");
const router = express.Router();
const Category = require("../models/Category");
const AdminUser = require("../models/AdminUser");
const adminAuth = require("../middleware/adminAuth");

// GET /api/categories - Get all categories
// Optional query param: active_only (default: false) - Only return active categories
router.get("/", async (req, res) => {
  try {
    const { active_only } = req.query;
    const activeOnly = active_only === "true" || active_only === "1";

    let query = {};
    if (activeOnly) {
      query.isActive = true;
    }

    const categories = await Category.find(query).sort({ category_display_name: 1 });

    res.status(200).json({
      status: "success",
      categories: categories,
      count: categories.length,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch categories",
      message: error.message,
    });
  }
});

// GET /api/categories/simple - Get simple list of categories only
router.get("/simple", async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select("_id category_name category_display_name")
      .sort({ category_display_name: 1 });

    const categoryList = categories.map((cat) => ({
      _id: cat._id.toString(),
      category_name: cat.category_name,
      name: cat.category_name,
      displayName: cat.category_display_name,
    }));

    res.status(200).json({
      status: "success",
      categories: categoryList,
      count: categoryList.length,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch categories",
      message: error.message,
    });
  }
});

// GET /api/categories/:category_name - Get specific category
router.get("/:category_name", async (req, res) => {
  try {
    const { category_name } = req.params;

    const category = await Category.findOne({
      category_name: category_name.toLowerCase(),
    });

    if (!category) {
      return res.status(404).json({
        status: "error",
        message: "Category not found",
      });
    }

    res.status(200).json({
      status: "success",
      category: category,
    });
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch category",
      message: error.message,
    });
  }
});

// POST /api/categories - Create a new category (Admin only)
router.post("/", adminAuth, async (req, res) => {
  try {
    const { category_name, category_display_name, description } = req.body;

    if (!category_name || !category_display_name) {
      return res.status(400).json({
        status: "error",
        message: "Category name and display name are required",
      });
    }

    // Check if category already exists
    const existingCategory = await Category.findOne({
      category_name: category_name.toLowerCase(),
    });

    if (existingCategory) {
      return res.status(400).json({
        status: "error",
        message: "Category already exists",
      });
    }

    const categoryData = {
      category_name: category_name.toLowerCase(),
      category_display_name: category_display_name,
      description: description || null,
      created_by: {
        admin_id: req.admin._id,
        admin_username: req.admin.username,
        created_at: new Date(),
      },
    };

    const category = await Category.create(categoryData);

    res.status(201).json({
      status: "success",
      message: "Category created successfully",
      category: category,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(422).json({
        status: "error",
        error: "Validation error",
        message: messages.join(", "),
      });
    }
    res.status(500).json({
      status: "error",
      error: "Failed to create category",
      message: error.message,
    });
  }
});

// PUT /api/categories/:category_name - Update a category (Admin only)
router.put("/:category_name", adminAuth, async (req, res) => {
  try {
    const { category_name } = req.params;
    const { category_display_name, description, isActive } = req.body;

    const category = await Category.findOne({
      category_name: category_name.toLowerCase(),
    });

    if (!category) {
      return res.status(404).json({
        status: "error",
        message: "Category not found",
      });
    }

    if (category_display_name) {
      category.category_display_name = category_display_name;
    }
    if (description !== undefined) {
      category.description = description;
    }
    if (isActive !== undefined) {
      category.isActive = isActive;
    }

    await category.save();

    res.status(200).json({
      status: "success",
      message: "Category updated successfully",
      category: category,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to update category",
      message: error.message,
    });
  }
});

// DELETE /api/categories/:category_name - Delete a category (Admin only)
router.delete("/:category_name", adminAuth, async (req, res) => {
  try {
    const { category_name } = req.params;

    const category = await Category.findOneAndDelete({
      category_name: category_name.toLowerCase(),
    });

    if (!category) {
      return res.status(404).json({
        status: "error",
        message: "Category not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to delete category",
      message: error.message,
    });
  }
});

module.exports = router;
