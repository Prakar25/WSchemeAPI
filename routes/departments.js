const express = require("express");
const router = express.Router();
const Department = require("../models/Department");
const Scheme = require("../models/Scheme");
const AdminUser = require("../models/AdminUser");
const Category = require("../models/Category");
const adminAuth = require("../middleware/adminAuth");

// GET /api/departments - Get all departments
// Optional query param: active_only (default: false) - Only return active departments
router.get("/", async (req, res) => {
  try {
    const { active_only } = req.query;
    const activeOnly = active_only === "true" || active_only === "1";

    let query = {};
    if (activeOnly) {
      query.isActive = true;
    }

    const departments = await Department.find(query)
      .populate("categories", "category_name category_display_name isActive")
      .sort({
        department_display_name: 1,
      });

    // Get scheme count for each department
    const departmentsWithCounts = await Promise.all(
      departments.map(async (dept) => {
        const schemeCount = await Scheme.countDocuments({
          department: dept._id.toString(), // Department is ObjectId stored as string
        });
        return {
          ...dept.toObject(),
          scheme_count: schemeCount,
        };
      })
    );

    res.status(200).json({
      status: "success",
      departments: departmentsWithCounts,
      count: departmentsWithCounts.length,
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch departments",
      message: error.message,
    });
  }
});

// GET /api/departments/simple - Get simple list of departments only
router.get("/simple", async (req, res) => {
  try {
    const departments = await Department.find({ isActive: true })
      .select("_id department_name department_display_name")
      .sort({ department_display_name: 1 });

    const departmentList = departments.map((dept) => ({
      _id: dept._id.toString(), // ObjectId as string for scheme creation
      name: dept.department_name,
      displayName: dept.department_display_name,
    }));

    res.status(200).json({
      status: "success",
      departments: departmentList,
      count: departmentList.length,
    });
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch departments",
      message: error.message,
    });
  }
});

// GET /api/departments/:department_name - Get specific department with schemes
router.get("/:department_name", async (req, res) => {
  try {
    const { department_name } = req.params;

    const department = await Department.findOne({
      department_name: department_name.toLowerCase(),
    }).populate("categories", "category_name category_display_name description isActive");

    if (!department) {
      return res.status(404).json({
        status: "error",
        message: "Department not found",
      });
    }

    // Get all schemes linked to this department (department is ObjectId stored as string)
    const schemes = await Scheme.find({
      department: department._id.toString(),
    })
      .select("_id scheme_name scheme_description approval_status createdAt");

    res.status(200).json({
      status: "success",
      department: {
        ...department.toObject(),
        schemes: schemes,
        scheme_count: schemes.length,
      },
    });
  } catch (error) {
    console.error("Error fetching department:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch department",
      message: error.message,
    });
  }
});

// GET /api/departments/:department_name/schemes - Get all schemes for a department
router.get("/:department_name/schemes", async (req, res) => {
  try {
    const { department_name } = req.params;
    const { status, approved_only } = req.query;

    const department = await Department.findOne({
      department_name: department_name.toLowerCase(),
    });

    if (!department) {
      return res.status(404).json({
        status: "error",
        message: "Department not found",
      });
    }

    let query = {
      department: department._id.toString(), // Department is ObjectId stored as string
    };

    // Filter by approval status if provided
    if (status) {
      query.approval_status = status;
    } else if (approved_only === "true" || approved_only === "1") {
      query.approval_status = "approved";
    }

    const schemes = await Scheme.find(query)
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      department: {
        name: department.department_display_name,
        department_name: department.department_name,
      },
      schemes: schemes,
      count: schemes.length,
    });
  } catch (error) {
    console.error("Error fetching department schemes:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch department schemes",
      message: error.message,
    });
  }
});

// POST /api/departments - Create a new department (Admin only)
router.post("/", adminAuth, async (req, res) => {
  try {
    const {
      department_name,
      department_display_name,
      description,
      contact_info,
    } = req.body;

    if (!department_name || !department_display_name) {
      return res.status(400).json({
        status: "error",
        message: "Department name and display name are required",
      });
    }

    // Check if department already exists
    const existingDepartment = await Department.findOne({
      department_name: department_name.toLowerCase(),
    });

    if (existingDepartment) {
      return res.status(400).json({
        status: "error",
        message: "Department already exists",
      });
    }

    const { categories } = req.body;

    const departmentData = {
      department_name: department_name.toLowerCase(),
      department_display_name: department_display_name,
      description: description || null,
      contact_info: contact_info || {},
      created_by: {
        admin_id: req.admin._id,
        admin_username: req.admin.username,
        created_at: new Date(),
      },
    };

    // Validate categories if provided
    if (categories && Array.isArray(categories)) {
      // Validate that all category IDs exist
      const validCategories = await Category.find({
        _id: { $in: categories },
        isActive: true,
      });

      if (validCategories.length !== categories.length) {
        return res.status(400).json({
          status: "error",
          message: "One or more category IDs are invalid or inactive",
        });
      }

      departmentData.categories = categories;
    }

    const department = await Department.create(departmentData);

    res.status(201).json({
      status: "success",
      message: "Department created successfully",
      department: department,
    });
  } catch (error) {
    console.error("Error creating department:", error);
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
      error: "Failed to create department",
      message: error.message,
    });
  }
});

// PUT /api/departments/:department_name - Update a department (Admin only)
router.put("/:department_name", adminAuth, async (req, res) => {
  try {
    const { department_name } = req.params;
    const {
      department_display_name,
      description,
      contact_info,
      isActive,
      categories,
    } = req.body;

    const department = await Department.findOne({
      department_name: department_name.toLowerCase(),
    });

    if (!department) {
      return res.status(404).json({
        status: "error",
        message: "Department not found",
      });
    }

    if (department_display_name) {
      department.department_display_name = department_display_name;
    }
    if (description !== undefined) {
      department.description = description;
    }
    if (contact_info !== undefined) {
      department.contact_info = {
        ...department.contact_info,
        ...contact_info,
      };
    }
    if (isActive !== undefined) {
      department.isActive = isActive;
    }
    if (categories !== undefined && Array.isArray(categories)) {
      // Validate that all category IDs exist
      const validCategories = await Category.find({
        _id: { $in: categories },
        isActive: true,
      });

      if (validCategories.length !== categories.length) {
        return res.status(400).json({
          status: "error",
          message: "One or more category IDs are invalid or inactive",
        });
      }

      department.categories = categories;
    }

    await department.save();

    res.status(200).json({
      status: "success",
      message: "Department updated successfully",
      department: department,
    });
  } catch (error) {
    console.error("Error updating department:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to update department",
      message: error.message,
    });
  }
});

// DELETE /api/departments/:department_name - Delete a department (Admin only)
router.delete("/:department_name", adminAuth, async (req, res) => {
  try {
    const { department_name } = req.params;

    // Check if department has schemes linked to it
    const department = await Department.findOne({
      department_name: department_name.toLowerCase(),
    });

    if (!department) {
      return res.status(404).json({
        status: "error",
        message: "Department not found",
      });
    }

    const schemeCount = await Scheme.countDocuments({
      department: department._id.toString(), // Department is ObjectId stored as string
    });

    if (schemeCount > 0) {
      return res.status(400).json({
        status: "error",
        message: `Cannot delete department. ${schemeCount} scheme(s) are linked to this department. Please reassign or delete the schemes first.`,
        scheme_count: schemeCount,
      });
    }

    await Department.findOneAndDelete({
      department_name: department_name.toLowerCase(),
    });

    res.status(200).json({
      status: "success",
      message: "Department deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting department:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to delete department",
      message: error.message,
    });
  }
});

// GET /api/departments/:department_name/categories - Get categories for a department
router.get("/:department_name/categories", async (req, res) => {
  try {
    const { department_name } = req.params;

    const department = await Department.findOne({
      department_name: department_name.toLowerCase(),
    }).populate("categories", "category_name category_display_name description isActive");

    if (!department) {
      return res.status(404).json({
        status: "error",
        message: "Department not found",
      });
    }

    res.status(200).json({
      status: "success",
      department: {
        name: department.department_display_name,
        department_name: department.department_name,
      },
      categories: department.categories || [],
      count: department.categories?.length || 0,
    });
  } catch (error) {
    console.error("Error fetching department categories:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to fetch department categories",
      message: error.message,
    });
  }
});

// POST /api/departments/:department_name/categories - Add categories to a department (Admin only)
router.post("/:department_name/categories", adminAuth, async (req, res) => {
  try {
    const { department_name } = req.params;
    const { category_ids } = req.body;

    if (!category_ids || !Array.isArray(category_ids) || category_ids.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "category_ids array is required",
      });
    }

    const department = await Department.findOne({
      department_name: department_name.toLowerCase(),
    });

    if (!department) {
      return res.status(404).json({
        status: "error",
        message: "Department not found",
      });
    }

    // Validate that all category IDs exist
    const validCategories = await Category.find({
      _id: { $in: category_ids },
      isActive: true,
    });

    if (validCategories.length !== category_ids.length) {
      return res.status(400).json({
        status: "error",
        message: "One or more category IDs are invalid or inactive",
      });
    }

    // Add categories that don't already exist
    const existingCategoryIds = department.categories.map((id) => id.toString());
    const newCategoryIds = category_ids.filter(
      (id) => !existingCategoryIds.includes(id.toString())
    );

    if (newCategoryIds.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "All specified categories are already associated with this department",
      });
    }

    department.categories = [...department.categories, ...newCategoryIds];
    await department.save();

    await department.populate("categories", "category_name category_display_name");

    res.status(200).json({
      status: "success",
      message: `${newCategoryIds.length} category/categories added successfully`,
      department: department,
    });
  } catch (error) {
    console.error("Error adding categories to department:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to add categories to department",
      message: error.message,
    });
  }
});

// DELETE /api/departments/:department_name/categories/:category_id - Remove a category from a department (Admin only)
router.delete("/:department_name/categories/:category_id", adminAuth, async (req, res) => {
  try {
    const { department_name, category_id } = req.params;

    const department = await Department.findOne({
      department_name: department_name.toLowerCase(),
    });

    if (!department) {
      return res.status(404).json({
        status: "error",
        message: "Department not found",
      });
    }

    // Check if category exists in department
    const categoryIndex = department.categories.findIndex(
      (id) => id.toString() === category_id
    );

    if (categoryIndex === -1) {
      return res.status(404).json({
        status: "error",
        message: "Category not found in this department",
      });
    }

    // Check if any schemes use this department-category combination
    const category = await Category.findById(category_id);
    if (category) {
      const schemeCount = await Scheme.countDocuments({
        department: department.department_display_name,
        category: category.category_display_name,
      });

      if (schemeCount > 0) {
        return res.status(400).json({
          status: "error",
          message: `Cannot remove category. ${schemeCount} scheme(s) are using this department-category combination.`,
          scheme_count: schemeCount,
        });
      }
    }

    // Remove category
    department.categories.splice(categoryIndex, 1);
    await department.save();

    await department.populate("categories", "category_name category_display_name");

    res.status(200).json({
      status: "success",
      message: "Category removed from department successfully",
      department: department,
    });
  } catch (error) {
    console.error("Error removing category from department:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to remove category from department",
      message: error.message,
    });
  }
});

module.exports = router;
