const mongoose = require("mongoose");
require("dotenv").config();
const connectDB = require("../config/database");
const Department = require("../models/Department");
const Category = require("../models/Category");

// Demo data for departments
const demoDepartments = [
  {
    department_name: "education_department",
    department_display_name: "Education Department",
    description: "Department responsible for educational schemes, scholarships, and academic programs",
    contact_info: {
      email: "education@gov.sikkim.in",
      phone: "03592-123456",
      address: "Education Building, Gangtok, Sikkim",
    },
    isActive: true,
  },
  {
    department_name: "health_department",
    department_display_name: "Health Department",
    description: "Department responsible for health schemes, medical services, and public health programs",
    contact_info: {
      email: "health@gov.sikkim.in",
      phone: "03592-234567",
      address: "Health Building, Gangtok, Sikkim",
    },
    isActive: true,
  },
  {
    department_name: "social_welfare_department",
    department_display_name: "Social Welfare Department",
    description: "Department responsible for social welfare schemes, pensions, and community support programs",
    contact_info: {
      email: "socialwelfare@gov.sikkim.in",
      phone: "03592-345678",
      address: "Social Welfare Building, Gangtok, Sikkim",
    },
    isActive: true,
  },
  {
    department_name: "housing_department",
    department_display_name: "Housing Department",
    description: "Department responsible for housing schemes and infrastructure development",
    contact_info: {
      email: "housing@gov.sikkim.in",
      phone: "03592-456789",
      address: "Housing Building, Gangtok, Sikkim",
    },
    isActive: true,
  },
  {
    department_name: "employment_department",
    department_display_name: "Employment Department",
    description: "Department responsible for employment schemes, skill development, and job placement",
    contact_info: {
      email: "employment@gov.sikkim.in",
      phone: "03592-567890",
      address: "Employment Building, Gangtok, Sikkim",
    },
    isActive: true,
  },
  {
    department_name: "women_empowerment_department",
    department_display_name: "Women Empowerment Department",
    description: "Department focused on women's welfare and empowerment schemes",
    contact_info: {
      email: "womenempowerment@gov.sikkim.in",
      phone: "03592-678901",
      address: "Women Empowerment Building, Gangtok, Sikkim",
    },
    isActive: true,
  },
  {
    department_name: "agriculture_department",
    department_display_name: "Agriculture Department",
    description: "Department responsible for agricultural schemes, farmer support, and rural development",
    contact_info: {
      email: "agriculture@gov.sikkim.in",
      phone: "03592-789012",
      address: "Agriculture Building, Gangtok, Sikkim",
    },
    isActive: true,
  },
  {
    department_name: "food_security_department",
    department_display_name: "Food Security Department",
    description: "Department responsible for food security schemes, ration distribution, and nutrition programs",
    contact_info: {
      email: "foodsecurity@gov.sikkim.in",
      phone: "03592-890123",
      address: "Food Security Building, Gangtok, Sikkim",
    },
    isActive: true,
  },
];

// Function to seed departments
async function seedDepartments() {
  try {
    // Connect to database
    await connectDB();
    console.log("Connected to MongoDB");

    // Clear existing departments (optional - comment out if you want to keep existing data)
    const deleteResult = await Department.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing departments`);

    // Get all categories to link them with departments
    const allCategories = await Category.find({ isActive: true });
    
    if (allCategories.length === 0) {
      console.log("⚠️  Warning: No categories found. Please run 'npm run seed:categories' first to create categories.");
    }

    // Map categories to departments
    const categoryMap = {
      education: allCategories.find(cat => cat.category_name === "education"),
      health: allCategories.find(cat => cat.category_name === "health"),
      social_welfare: allCategories.find(cat => cat.category_name === "social_welfare"),
      housing: allCategories.find(cat => cat.category_name === "housing"),
      employment: allCategories.find(cat => cat.category_name === "employment"),
      women_empowerment: allCategories.find(cat => cat.category_name === "women_empowerment"),
      agriculture: allCategories.find(cat => cat.category_name === "agriculture"),
      food_security: allCategories.find(cat => cat.category_name === "food_security"),
    };

    // Add category IDs to departments based on their names
    const departmentsWithCategories = demoDepartments.map(dept => {
      const categoryKey = dept.department_name.replace("_department", "");
      const category = categoryMap[categoryKey];
      
      return {
        ...dept,
        categories: category ? [category._id] : [],
      };
    });

    // Insert demo departments
    const createdDepartments = await Department.insertMany(departmentsWithCategories);

    console.log(`\n✅ Successfully seeded ${createdDepartments.length} departments:`);
    
    for (let i = 0; i < createdDepartments.length; i++) {
      const department = createdDepartments[i];
      await department.populate("categories", "category_name category_display_name");
      
      console.log(`\n${i + 1}. ${department.department_display_name}`);
      console.log(`   Department Name: ${department.department_name}`);
      console.log(`   Email: ${department.contact_info?.email || 'N/A'}`);
      console.log(`   Phone: ${department.contact_info?.phone || 'N/A'}`);
      
      if (department.categories && department.categories.length > 0) {
        console.log(`   Categories: ${department.categories.map(cat => cat.category_display_name).join(", ")}`);
      } else {
        console.log(`   Categories: None (category not found in database)`);
      }
    }

    console.log(`\n✨ Seed data inserted successfully!`);
    console.log(`\nTotal Departments: ${createdDepartments.length}`);
    console.log(`\nNote: Categories are linked to departments. Make sure categories are seeded first.`);

    // Close database connection
    await mongoose.connection.close();
    console.log("\nDatabase connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding departments:", error);
    process.exit(1);
  }
}

// Run the seed function
if (require.main === module) {
  seedDepartments();
}

module.exports = { seedDepartments, demoDepartments };
