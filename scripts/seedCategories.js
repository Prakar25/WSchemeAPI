const mongoose = require("mongoose");
require("dotenv").config();
const connectDB = require("../config/database");
const Category = require("../models/Category");

// Demo data for categories and subcategories
const demoCategories = [
  {
    category_name: "education",
    category_display_name: "Education",
    description: "Educational schemes and programs for students and learners",
    isActive: true,
    subcategories: [
      {
        subcategory_name: "scholarship",
        subcategory_display_name: "Scholarship",
        description: "Financial assistance in the form of scholarships",
        isActive: true,
      },
      {
        subcategory_name: "tuition_fee",
        subcategory_display_name: "Tuition Fee Assistance",
        description: "Financial support for tuition fees",
        isActive: true,
      },
      {
        subcategory_name: "school_supplies",
        subcategory_display_name: "School Supplies",
        description: "Free or subsidized school supplies and materials",
        isActive: true,
      },
      {
        subcategory_name: "book_bank",
        subcategory_display_name: "Book Bank",
        description: "Textbook lending and distribution programs",
        isActive: true,
      },
      {
        subcategory_name: "uniform_assistance",
        subcategory_display_name: "Uniform Assistance",
        description: "Financial aid for school uniforms",
        isActive: true,
      },
    ],
  },
  {
    category_name: "health",
    category_display_name: "Health",
    description: "Health and medical welfare schemes",
    isActive: true,
    subcategories: [
      {
        subcategory_name: "medical_insurance",
        subcategory_display_name: "Medical Insurance",
        description: "Health insurance coverage for eligible beneficiaries",
        isActive: true,
      },
      {
        subcategory_name: "vaccination",
        subcategory_display_name: "Vaccination Programs",
        description: "Free vaccination and immunization programs",
        isActive: true,
      },
      {
        subcategory_name: "maternal_health",
        subcategory_display_name: "Maternal Health",
        description: "Healthcare support for expecting and new mothers",
        isActive: true,
      },
      {
        subcategory_name: "child_health",
        subcategory_display_name: "Child Health",
        description: "Healthcare programs for children",
        isActive: true,
      },
      {
        subcategory_name: "elderly_care",
        subcategory_display_name: "Elderly Care",
        description: "Healthcare and support services for senior citizens",
        isActive: true,
      },
    ],
  },
  {
    category_name: "social_welfare",
    category_display_name: "Social Welfare",
    description: "Social welfare and community support schemes",
    isActive: true,
    subcategories: [
      {
        subcategory_name: "pension",
        subcategory_display_name: "Pension Schemes",
        description: "Old age and disability pension programs",
        isActive: true,
      },
      {
        subcategory_name: "disability_support",
        subcategory_display_name: "Disability Support",
        description: "Financial and medical support for persons with disabilities",
        isActive: true,
      },
      {
        subcategory_name: "orphan_support",
        subcategory_display_name: "Orphan Support",
        description: "Welfare programs for orphaned children",
        isActive: true,
      },
      {
        subcategory_name: "widow_support",
        subcategory_display_name: "Widow Support",
        description: "Financial assistance and support for widows",
        isActive: true,
      },
    ],
  },
  {
    category_name: "housing",
    category_display_name: "Housing",
    description: "Housing and infrastructure development schemes",
    isActive: true,
    subcategories: [
      {
        subcategory_name: "pradhan_mantri_awas_yojana",
        subcategory_display_name: "Pradhan Mantri Awas Yojana",
        description: "Affordable housing scheme",
        isActive: true,
      },
      {
        subcategory_name: "housing_loan_subsidy",
        subcategory_display_name: "Housing Loan Subsidy",
        description: "Interest subsidy on home loans",
        isActive: true,
      },
      {
        subcategory_name: "slum_redevelopment",
        subcategory_display_name: "Slum Redevelopment",
        description: "Rehabilitation and redevelopment of slum areas",
        isActive: true,
      },
    ],
  },
  {
    category_name: "employment",
    category_display_name: "Employment",
    description: "Employment and skill development schemes",
    isActive: true,
    subcategories: [
      {
        subcategory_name: "skill_development",
        subcategory_display_name: "Skill Development",
        description: "Training and skill enhancement programs",
        isActive: true,
      },
      {
        subcategory_name: "entrepreneurship",
        subcategory_display_name: "Entrepreneurship Support",
        description: "Financial assistance and training for entrepreneurs",
        isActive: true,
      },
      {
        subcategory_name: "job_placement",
        subcategory_display_name: "Job Placement",
        description: "Employment assistance and job placement services",
        isActive: true,
      },
      {
        subcategory_name: "unemployment_benefit",
        subcategory_display_name: "Unemployment Benefit",
        description: "Financial support during unemployment",
        isActive: true,
      },
    ],
  },
  {
    category_name: "women_empowerment",
    category_display_name: "Women Empowerment",
    description: "Schemes focused on empowering women",
    isActive: true,
    subcategories: [
      {
        subcategory_name: "financial_literacy",
        subcategory_display_name: "Financial Literacy",
        description: "Programs to improve financial knowledge and skills",
        isActive: true,
      },
      {
        subcategory_name: "self_help_groups",
        subcategory_display_name: "Self Help Groups",
        description: "Support for women's self-help groups",
        isActive: true,
      },
      {
        subcategory_name: "microfinance",
        subcategory_display_name: "Microfinance",
        description: "Small loans and financial services for women",
        isActive: true,
      },
      {
        subcategory_name: "vocational_training",
        subcategory_display_name: "Vocational Training",
        description: "Skill training programs for women",
        isActive: true,
      },
    ],
  },
  {
    category_name: "agriculture",
    category_display_name: "Agriculture",
    description: "Agricultural and farming support schemes",
    isActive: true,
    subcategories: [
      {
        subcategory_name: "crop_insurance",
        subcategory_display_name: "Crop Insurance",
        description: "Insurance coverage for agricultural crops",
        isActive: true,
      },
      {
        subcategory_name: "farm_subsidies",
        subcategory_display_name: "Farm Subsidies",
        description: "Subsidies on seeds, fertilizers, and farming equipment",
        isActive: true,
      },
      {
        subcategory_name: "irrigation_support",
        subcategory_display_name: "Irrigation Support",
        description: "Financial assistance for irrigation systems",
        isActive: true,
      },
      {
        subcategory_name: "loan_waiver",
        subcategory_display_name: "Loan Waiver",
        description: "Farm loan waiver and relief programs",
        isActive: true,
      },
    ],
  },
  {
    category_name: "food_security",
    category_display_name: "Food Security",
    description: "Food security and nutrition schemes",
    isActive: true,
    subcategories: [
      {
        subcategory_name: "ration_card",
        subcategory_display_name: "Ration Card",
        description: "Public distribution system for food grains",
        isActive: true,
      },
      {
        subcategory_name: "mid_day_meal",
        subcategory_display_name: "Mid-Day Meal",
        description: "Nutritional meal programs in schools",
        isActive: true,
      },
      {
        subcategory_name: "maternity_benefit",
        subcategory_display_name: "Maternity Benefit",
        description: "Nutritional and financial support during pregnancy",
        isActive: true,
      },
      {
        subcategory_name: "child_nutrition",
        subcategory_display_name: "Child Nutrition",
        description: "Nutrition programs for malnourished children",
        isActive: true,
      },
    ],
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
      console.log(`   Subcategories: ${category.subcategories.length}`);
      category.subcategories.forEach((sub) => {
        console.log(`      - ${sub.subcategory_display_name}`);
      });
    });

    console.log(`\n✨ Seed data inserted successfully!`);
    console.log(`\nTotal Categories: ${createdCategories.length}`);
    
    const totalSubcategories = createdCategories.reduce(
      (sum, cat) => sum + cat.subcategories.length,
      0
    );
    console.log(`Total Subcategories: ${totalSubcategories}`);

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
