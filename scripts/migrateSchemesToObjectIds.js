const mongoose = require("mongoose");
require("dotenv").config();
const connectDB = require("../config/database");
const Scheme = require("../models/Scheme");
const Department = require("../models/Department");
const Category = require("../models/Category");

/**
 * Migration Script: Convert Scheme department and category from String to ObjectId references
 * 
 * This script:
 * 1. Reads all schemes with string department and category
 * 2. Finds matching Department and Category objects
 * 3. Updates schemes with ObjectId references
 * 4. Handles mismatches and logs warnings
 */

async function migrateSchemes() {
  try {
    // Connect to database
    await connectDB();
    console.log("Connected to MongoDB");
    console.log("\n🚀 Starting scheme migration...\n");

    // Get all schemes
    const schemes = await Scheme.find({
      // Find schemes where department is a string (not ObjectId)
      $or: [
        { department: { $type: "string" } },
        { category: { $type: "string" } }
      ]
    });

    console.log(`Found ${schemes.length} schemes to migrate\n`);

    if (schemes.length === 0) {
      console.log("✅ No schemes need migration. All schemes are already using ObjectId references.");
      await mongoose.connection.close();
      process.exit(0);
    }

    // Get all departments and categories for matching
    const allDepartments = await Department.find({});
    const allCategories = await Category.find({});

    console.log(`Available Departments: ${allDepartments.length}`);
    console.log(`Available Categories: ${allCategories.length}\n`);

    // Create lookup maps for faster matching
    const departmentMap = new Map();
    allDepartments.forEach(dept => {
      // Map by display name (most common)
      departmentMap.set(dept.department_display_name.toLowerCase(), dept);
      // Map by department name
      departmentMap.set(dept.department_name.toLowerCase(), dept);
    });

    const categoryMap = new Map();
    allCategories.forEach(cat => {
      // Map by display name (most common)
      categoryMap.set(cat.category_display_name.toLowerCase(), cat);
      // Map by category name
      categoryMap.set(cat.category_name.toLowerCase(), cat);
    });

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Migrate each scheme
    for (const scheme of schemes) {
      try {
        let departmentId = null;
        let categoryId = null;
        let updateData = {};

        // Convert department
        if (typeof scheme.department === 'string') {
          const deptKey = scheme.department.toLowerCase().trim();
          const matchedDepartment = departmentMap.get(deptKey);

          if (matchedDepartment) {
            departmentId = matchedDepartment._id;
            updateData.department = departmentId;
            console.log(`✓ Scheme "${scheme.scheme_name}": Department "${scheme.department}" → ${departmentId}`);
          } else {
            console.warn(`⚠️  Scheme "${scheme.scheme_name}": Department "${scheme.department}" not found!`);
            errors.push({
              scheme_id: scheme._id,
              scheme_name: scheme.scheme_name,
              error: `Department "${scheme.department}" not found in database`
            });
            continue; // Skip this scheme
          }
        } else if (scheme.department instanceof mongoose.Types.ObjectId) {
          // Already an ObjectId, check if it exists
          const dept = await Department.findById(scheme.department);
          if (!dept) {
            console.warn(`⚠️  Scheme "${scheme.scheme_name}": Department ObjectId ${scheme.department} not found!`);
            errors.push({
              scheme_id: scheme._id,
              scheme_name: scheme.scheme_name,
              error: `Department ObjectId ${scheme.department} not found in database`
            });
            continue;
          }
          departmentId = scheme.department;
        }

        // Convert category
        if (typeof scheme.category === 'string') {
          const catKey = scheme.category.toLowerCase().trim();
          const matchedCategory = categoryMap.get(catKey);

          if (matchedCategory) {
            categoryId = matchedCategory._id;
            updateData.category = categoryId;
            console.log(`  Category "${scheme.category}" → ${categoryId}`);

            // Validate category belongs to department
            if (departmentId) {
              const department = await Department.findById(departmentId).populate('categories');
              if (department && department.categories) {
                const hasCategory = department.categories.some(
                  cat => cat._id.toString() === categoryId.toString()
                );
                if (!hasCategory) {
                  console.warn(`  ⚠️  Warning: Category "${scheme.category}" not associated with department "${scheme.department}"`);
                  console.warn(`     You may need to add this category to the department manually.`);
                }
              }
            }
          } else {
            console.warn(`  ⚠️  Category "${scheme.category}" not found!`);
            errors.push({
              scheme_id: scheme._id,
              scheme_name: scheme.scheme_name,
              error: `Category "${scheme.category}" not found in database`
            });
            continue; // Skip this scheme
          }
        } else if (scheme.category instanceof mongoose.Types.ObjectId) {
          // Already an ObjectId, check if it exists
          const cat = await Category.findById(scheme.category);
          if (!cat) {
            console.warn(`  ⚠️  Scheme "${scheme.scheme_name}": Category ObjectId ${scheme.category} not found!`);
            errors.push({
              scheme_id: scheme._id,
              scheme_name: scheme.scheme_name,
              error: `Category ObjectId ${scheme.category} not found in database`
            });
            continue;
          }
          categoryId = scheme.category;
        }

        // Remove sub_category field if it exists (we don't use it anymore)
        if (scheme.sub_category) {
          updateData.$unset = { sub_category: "" };
        }

        // Update the scheme
        if (Object.keys(updateData).length > 0) {
          await Scheme.findByIdAndUpdate(scheme._id, updateData, { new: true });
          successCount++;
          console.log(`  ✅ Migrated successfully\n`);
        } else {
          console.log(`  ℹ️  Already migrated (using ObjectIds)\n`);
        }

      } catch (error) {
        console.error(`  ❌ Error migrating scheme "${scheme.scheme_name}":`, error.message);
        errors.push({
          scheme_id: scheme._id,
          scheme_name: scheme.scheme_name,
          error: error.message
        });
        errorCount++;
      }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 Migration Summary");
    console.log("=".repeat(60));
    console.log(`✅ Successfully migrated: ${successCount} schemes`);
    console.log(`❌ Errors: ${errorCount} schemes`);
    console.log(`📝 Total processed: ${schemes.length} schemes`);

    if (errors.length > 0) {
      console.log("\n⚠️  Errors encountered:");
      errors.forEach((err, index) => {
        console.log(`\n${index + 1}. Scheme: "${err.scheme_name}" (${err.scheme_id})`);
        console.log(`   Error: ${err.error}`);
      });

      console.log("\n💡 Suggestions:");
      console.log("1. Check if departments/categories exist in the database");
      console.log("2. Create missing departments/categories using seed scripts");
      console.log("3. Run this migration script again");
      console.log("4. For schemes with mismatched department-category, add categories to departments manually");
    }

    console.log("\n✨ Migration completed!");

    // Close database connection
    await mongoose.connection.close();
    console.log("\nDatabase connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  console.log("⚠️  WARNING: This will modify existing schemes in the database.");
  console.log("Make sure you have a backup before proceeding.\n");
  
  // You can add a confirmation prompt here if needed
  // For now, we'll run it directly
  
  migrateSchemes();
}

module.exports = { migrateSchemes };
