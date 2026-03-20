/**
 * Migration script to add role and isActive fields to existing admin users
 * 
 * This script will:
 * 1. Find all admin users without role field
 * 2. Add default role "District Overlookers" to them
 * 3. Add isActive: true to users without it
 * 
 * Usage: node scripts/migrateAdminUsers.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const AdminUser = require('../models/AdminUser');

async function migrateAdminUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wscheme');
    console.log('✅ Connected to MongoDB');

    // Find all admin users
    const adminUsers = await AdminUser.find({});
    console.log(`📊 Found ${adminUsers.length} admin users to check`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const admin of adminUsers) {
      let needsUpdate = false;
      const updates = {};

      // Check if role is missing
      if (!admin.role) {
        updates.role = AdminUser.ROLES.DISTRICT_OVERLOOKERS;
        needsUpdate = true;
        console.log(`  📝 Adding default role "District Overlookers" to: ${admin.fullName}`);
      }

      // Check if isActive is missing
      if (admin.isActive === undefined || admin.isActive === null) {
        updates.isActive = true;
        needsUpdate = true;
        console.log(`  📝 Adding isActive: true to: ${admin.fullName}`);
      }

      // Update if needed
      if (needsUpdate) {
        await AdminUser.findByIdAndUpdate(admin._id, updates);
        updatedCount++;
        console.log(`  ✅ Updated admin: ${admin.fullName}`);
      } else {
        skippedCount++;
        console.log(`  ⏭️  Skipped admin: ${admin.fullName} (already has role and isActive)`);
      }
    }

    console.log(`\n🎉 Migration completed!`);
    console.log(`   ✅ Updated: ${updatedCount} admin users`);
    console.log(`   ⏭️  Skipped: ${skippedCount} admin users`);
    
    // Display updated users
    const updatedUsers = await AdminUser.find({});
    console.log(`\n📋 Updated Admin Users:`);
    updatedUsers.forEach(user => {
      console.log(`   - ${user.fullName} (${user.username}): ${user.role} [Active: ${user.isActive}]`);
    });
    
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run migration
console.log('🚀 Starting Admin Users migration...\n');
migrateAdminUsers();

