const mongoose = require("mongoose");
require("dotenv").config();
const connectDB = require("../config/database");
const Scheme = require("../models/Scheme");
const Department = require("../models/Department");
const Category = require("../models/Category");
const AdminUser = require("../models/AdminUser");

/**
 * Script to insert existing schemes with updated structure:
 * - Remove sub_category field
 * - Convert category and department to ObjectId references
 * - Add approval_status field
 */

const schemesData = [
  {
    scheme_name: "Mukhyamantri Kanya Utthan Yojana",
    scheme_date: "2025-12-01T00:00:00.000Z",
    gender: "Female",
    category: "Pension", // Will be converted to ObjectId
    department: "Social Welfare Department", // Will be converted to ObjectId
    scheme_description: "Mukhyamantri Kanya Utthan Yojana is a flagship welfare initiative aimed at improving the social, educational, and health status of girl children in Sikkim. The scheme focuses on providing financial assistance and institutional support to encourage education, reduce dropout rates, and improve overall well-being. It addresses gender inequality by supporting girls from early childhood to higher education. The scheme also promotes awareness regarding health, nutrition, and personal development. By empowering girl children economically and socially, the program aims to build a stronger and more inclusive society where women are self-reliant and confident contributors to the state's growth.",
    scheme_objectives: [
      "Promote education among girl children",
      "Reduce school dropout rates",
      "Encourage higher education for girls",
      "Improve health and nutritional awareness",
      "Provide financial assistance to families",
      "Empower women socially and economically"
    ],
    scheme_benefits: [
      "Direct financial assistance",
      "Educational scholarships",
      "Skill development opportunities",
      "Health and nutrition support"
    ],
    scheme_eligibility: {
      lower_age_limit: 5,
      upper_age_limit: 18
    },
    scheme_required_document_types: [
      "Aadhaar Card",
      "Birth Certificate",
      "School/College ID",
      "Bank Account Details"
    ],
    scheme_required_documents: [
      {
        document_type: "Aadhaar Card",
        file_url: "public/uploads/user-docs/aadhaar_98347.pdf",
        uploaded_at: "2026-01-04T17:40:00.000Z"
      }
    ],
    scheme_image_file_url: "public/uploads/admin-uploads/childDevelopment-1766327873928-783726536.jpeg",
    approval_status: "approved" // Adding approval status
  },
  {
    scheme_name: "Sikkim Youth Employment Scheme",
    scheme_date: "2025-12-03T00:00:00.000Z",
    gender: "All",
    category: "Pension",
    department: "Social Welfare Department",
    scheme_description: "The Sikkim Youth Employment Scheme is designed to tackle unemployment among educated youth by providing skill development, training, and employment opportunities. The scheme focuses on enhancing employability through industry-relevant training and career guidance. It aims to bridge the gap between education and employment by preparing young individuals for the job market. Special emphasis is placed on entrepreneurship and self-employment opportunities. By supporting youth from diverse backgrounds, the scheme contributes to sustainable economic development and workforce readiness in the state.",
    scheme_objectives: [
      "Reduce youth unemployment",
      "Enhance employability skills",
      "Provide industry-oriented training",
      "Encourage entrepreneurship",
      "Support self-employment initiatives",
      "Strengthen workforce participation"
    ],
    scheme_benefits: [
      "Skill training programs",
      "Placement assistance",
      "Entrepreneurship support",
      "Career counseling"
    ],
    scheme_eligibility: {
      lower_age_limit: 18,
      upper_age_limit: 40
    },
    scheme_required_document_types: [
      "Aadhaar Card",
      "Educational Certificates",
      "Residence Proof",
      "Bank Passbook"
    ],
    scheme_required_documents: [],
    scheme_image_file_url: "public/uploads/admin-uploads/educationFinance-1766329674475-849100771.jpeg",
    approval_status: "approved"
  },
  {
    scheme_name: "National Maternity Benefit Scheme",
    scheme_date: "2025-12-05T00:00:00.000Z",
    gender: "Female",
    category: "Pension",
    department: "Social Welfare Department",
    scheme_description: "The National Maternity Benefit Scheme provides financial assistance to pregnant and lactating women to support their health and nutrition needs. The scheme ensures better maternal care, safe delivery, and postnatal support. It aims to reduce maternal and infant mortality by encouraging institutional deliveries. Financial aid under the scheme helps women access proper healthcare facilities and maintain nutritional standards. This initiative plays a critical role in promoting maternal well-being and child health across the country.",
    scheme_objectives: [
      "Improve maternal health",
      "Reduce infant mortality",
      "Encourage institutional deliveries",
      "Provide nutritional support",
      "Ensure financial assistance",
      "Promote postnatal care"
    ],
    scheme_benefits: [
      "Cash incentives",
      "Free health checkups",
      "Nutritional support",
      "Postnatal care assistance"
    ],
    scheme_eligibility: {
      lower_age_limit: 18,
      upper_age_limit: 35
    },
    scheme_required_document_types: [
      "Aadhaar Card",
      "Pregnancy Certificate",
      "Bank Account Details",
      "Residence Proof"
    ],
    scheme_required_documents: [],
    scheme_image_file_url: "public/uploads/admin-uploads/expectingMother-1766329861849-271141926.jpeg",
    approval_status: "approved"
  },
  {
    scheme_name: "Sikkim Women Self Employment Scheme",
    scheme_date: "2025-12-07T00:00:00.000Z",
    gender: "Female",
    category: "Pension",
    department: "Social Welfare Department",
    scheme_description: "This scheme empowers women by promoting self-employment and entrepreneurship. It provides financial assistance, training, and mentorship to women interested in starting small businesses. The scheme encourages economic independence and skill enhancement, helping women become active contributors to household and community development. It also focuses on improving access to credit and market linkages for women-led enterprises.",
    scheme_objectives: [
      "Promote women entrepreneurship",
      "Encourage self-employment",
      "Provide financial assistance",
      "Enhance business skills",
      "Improve market access",
      "Strengthen women empowerment"
    ],
    scheme_benefits: [
      "Business loans",
      "Skill training",
      "Mentorship support",
      "Subsidy benefits"
    ],
    scheme_eligibility: {
      lower_age_limit: 18,
      upper_age_limit: 60
    },
    scheme_required_document_types: [
      "Aadhaar Card",
      "Business Proposal",
      "Bank Account Details",
      "Residence Proof"
    ],
    scheme_required_documents: [],
    scheme_image_file_url: "public/uploads/admin-uploads/womenEmpowerment-1766330138312-50115772.jpeg",
    approval_status: "approved"
  },
  {
    scheme_name: "Integrated Child Development Scheme",
    scheme_date: "2025-12-09T00:00:00.000Z",
    gender: "All",
    category: "Pension",
    department: "Social Welfare Department",
    scheme_description: "The Integrated Child Development Scheme focuses on improving the health, nutrition, and education of children. It provides supplementary nutrition, healthcare services, and early childhood education. The scheme aims to reduce malnutrition and enhance developmental outcomes for children while supporting mothers through awareness programs.",
    scheme_objectives: [
      "Improve child nutrition",
      "Reduce malnutrition",
      "Promote early education",
      "Provide healthcare services",
      "Support mothers",
      "Enhance child development"
    ],
    scheme_benefits: [
      "Supplementary nutrition",
      "Health checkups",
      "Early education",
      "Immunization support"
    ],
    scheme_eligibility: {
      lower_age_limit: 0,
      upper_age_limit: 10
    },
    scheme_required_document_types: [
      "Birth Certificate",
      "Aadhaar Card (parent)",
      "Residence Proof",
      "Health Card"
    ],
    scheme_required_documents: [],
    scheme_image_file_url: "public/uploads/admin-uploads/childHealth-1766330363713-212745249.jpeg",
    approval_status: "approved"
  }
];

async function insertSchemes() {
  try {
    // Connect to database
    await connectDB();
    console.log("Connected to MongoDB");
    console.log("\n🚀 Starting scheme insertion...\n");

    // Get all departments and categories
    const departments = await Department.find({});
    const categories = await Category.find({});

    console.log(`Available Departments: ${departments.length}`);
    console.log(`Available Categories: ${categories.length}\n`);

    if (departments.length === 0) {
      console.error("❌ No departments found! Please run: npm run seed:departments");
      process.exit(1);
    }

    if (categories.length === 0) {
      console.error("❌ No categories found! Please run: npm run seed:categories");
      process.exit(1);
    }

    // Create lookup maps
    const departmentMap = new Map();
    departments.forEach(dept => {
      departmentMap.set(dept.department_display_name.toLowerCase(), dept);
      departmentMap.set(dept.department_name.toLowerCase(), dept);
    });

    const categoryMap = new Map();
    categories.forEach(cat => {
      categoryMap.set(cat.category_display_name.toLowerCase(), cat);
      categoryMap.set(cat.category_name.toLowerCase(), cat);
    });

    // Check if "Pension" category exists, if not create it
    let pensionCategory = categoryMap.get("pension");
    if (!pensionCategory) {
      console.log("⚠️  'Pension' category not found. Creating it...");
      pensionCategory = await Category.create({
        category_name: "pension",
        category_display_name: "Pension",
        description: "Pension and social security schemes",
        isActive: true
      });
      console.log(`✅ Created category: ${pensionCategory.category_display_name}`);
    }

    // Check if "Social Welfare Department" exists, if not create it
    let socialWelfareDept = departmentMap.get("social welfare department");
    if (!socialWelfareDept) {
      console.log("⚠️  'Social Welfare Department' not found. Creating it...");
      socialWelfareDept = await Department.create({
        department_name: "social_welfare_department",
        department_display_name: "Social Welfare Department",
        description: "Department responsible for social welfare schemes, pensions, and community support programs",
        isActive: true,
        categories: [pensionCategory._id] // Link pension category
      });
      console.log(`✅ Created department: ${socialWelfareDept.department_display_name}`);
    } else {
      // Ensure pension category is linked to department
      const deptCategories = socialWelfareDept.categories.map(c => c.toString());
      if (!deptCategories.includes(pensionCategory._id.toString())) {
        socialWelfareDept.categories.push(pensionCategory._id);
        await socialWelfareDept.save();
        console.log(`✅ Linked 'Pension' category to 'Social Welfare Department'`);
      }
    }

    // Get admin user for created_by field
    const adminUser = await AdminUser.findOne({});
    if (!adminUser) {
      console.error("❌ No admin user found. Please create an admin user first.");
      process.exit(1);
    }

    // Convert schemes data (department and category ObjectIds stored as strings)
    const schemesToInsert = [];
    
    for (const schemeData of schemesData) {
      // Find department
      const deptKey = schemeData.department.toLowerCase();
      const department = departmentMap.get(deptKey);
      
      if (!department) {
        console.error(`❌ Department "${schemeData.department}" not found for scheme "${schemeData.scheme_name}"`);
        continue;
      }

      // Find category (use pensionCategory we found/created, or lookup)
      const catKey = schemeData.category.toLowerCase();
      let category = catKey === "pension" ? pensionCategory : categoryMap.get(catKey);
      
      if (!category) {
        console.error(`❌ Category "${schemeData.category}" not found for scheme "${schemeData.scheme_name}"`);
        continue;
      }

      // Create scheme object (sub_category is removed automatically, approval_status is added)
      const scheme = {
        ...schemeData,
        department: department._id.toString(),  // ObjectId as string (e.g., "69652457fc10b345178f75a5")
        category: category._id.toString(),      // ObjectId as string (e.g., "69652454b19f52b831b4ce4d")
        // sub_category is removed (not included in new schema)
        // approval_status is already in the data
        created_by: {
          admin_id: adminUser._id,
          admin_username: adminUser.username || "system",
          admin_role: adminUser.role || "Admin",
          created_at: new Date(),
        },
        // If approved, set department_head_approval
        ...(schemeData.approval_status === "approved" ? {
          department_head_approval: {
            approved_by: adminUser._id,
            approved_by_username: adminUser.username || "system",
            approved_at: new Date(),
          }
        } : {}),
      };

      schemesToInsert.push(scheme);
    }

    if (schemesToInsert.length === 0) {
      console.error("❌ No valid schemes to insert!");
      process.exit(1);
    }

    console.log(`\n📝 Prepared ${schemesToInsert.length} schemes for insertion\n`);

    // Insert schemes
    const insertedSchemes = await Scheme.insertMany(schemesToInsert);

    console.log(`✅ Successfully inserted ${insertedSchemes.length} schemes:\n`);

    // Display inserted schemes
    for (const scheme of insertedSchemes) {
      console.log(`${scheme.scheme_name}`);
      console.log(`  Department ID (string): ${scheme.department}`);
      console.log(`  Category ID (string): ${scheme.category}`);
      console.log(`  Approval Status: ${scheme.approval_status}`);
      console.log(`  Scheme ID: ${scheme._id}`);
      console.log();
    }

    console.log("✨ All schemes inserted successfully!");
    console.log(`\nTotal Schemes: ${insertedSchemes.length}`);

    // Close database connection
    await mongoose.connection.close();
    console.log("\nDatabase connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error inserting schemes:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  insertSchemes();
}

module.exports = { insertSchemes, schemesData };
