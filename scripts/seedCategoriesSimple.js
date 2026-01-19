const mongoose = require("mongoose");
require("dotenv").config();
const connectDB = require("../config/database");
const Category = require("../models/Category");

// Demo data for categories (no subcategories - scheme name serves as subcategory)
const demoCategories = [
  {
    category_name: "education",
    category_display_name: "Education",
    description: "Educational schemes and programs for students and learners",
    isActive: true,
  },
  {
    category_name: "health",
    category_display_name: "Health",
    description: "Health and medical welfare schemes",
    isActive: true,
  },
  {
    category_name: "social_welfare",
    category_display_name: "Social Welfare",
    description: "Social welfare and community support schemes",
    isActive: true,
  },
  {
    category_name: "housing",
    category_display_name: "Housing",
    description: "Housing and infrastructure development schemes",
    isActive: true,
  },
  {
    category_name: "employment",
    category_display_name: "Employment",
    description: "Employment and skill development schemes",
    isActive: true,
  },
  {
    category_name: "women_empowerment",
    category_display_name: "Women Empowerment",
    description: "Schemes focused on empowering women",
    isActive: true,
  },
  {
    category_name: "agriculture",
    category_display_name: "Agriculture",
    description: "Agricultural and farming support schemes",
    isActive: true,
  },
  {
    category_name: "food_security",
    category_display_name: "Food Security",
    description: "Food security and nutrition schemes",
    isActive: true,
  },
];

// Function to seed categories
async function seedCategories() {
  try {
    // Connect to database
    await connectDB();
    console.log("Connected to MongoDB");

    // Clear existing categories (optional - comment out if you want to keep existing data)
    const deleteResult = await Category.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing categories`);

    // Insert demo categories
    const createdCategories = await Category.insertMany(demoCategories);

    console.log(`\n✅ Successfully seeded ${createdCategories.length} categories:`);
    
    createdCategories.forEach((category, index) => {
      console.log(`\n${index + 1}. ${category.category_display_name}`);
      console.log(`   Category Name: ${category.category_name}`);
    });

    console.log(`\n✨ Seed data inserted successfully!`);
    console.log(`\nTotal Categories: ${createdCategories.length}`);
    console.log(`\nNote: Subcategories are not used. Scheme name itself serves as the subcategory.`);

    // Close database connection
    await mongoose.connection.close();
    console.log("\nDatabase connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding categories:", error);
    process.exit(1);
  }
}

// Run the seed function
if (require.main === module) {
  seedCategories();
}

module.exports = { seedCategories, demoCategories };
