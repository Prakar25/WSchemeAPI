const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../config/database');
const AdminUser = require('../models/AdminUser');

const updateAdminRole = async () => {
  await connectDB();

  try {
    // Update karma.tshering to Super Admin
    const result = await AdminUser.updateOne(
      { username: 'karma.tshering' },
      { $set: { role: AdminUser.ROLES.SUPER_ADMIN } }
    );

    if (result.matchedCount === 0) {
      console.log('Admin not found: karma.tshering');
    } else if (result.modifiedCount === 0) {
      console.log('Admin role already set correctly');
    } else {
      console.log('✅ Updated karma.tshering to Super Admin');
    }

    // Update maya.subba to Admin (optional)
    const result2 = await AdminUser.updateOne(
      { username: 'maya.subba' },
      { $set: { role: AdminUser.ROLES.ADMIN } }
    );

    if (result2.matchedCount === 0) {
      console.log('Admin not found: maya.subba');
    } else if (result2.modifiedCount === 0) {
      console.log('Admin role already set correctly');
    } else {
      console.log('✅ Updated maya.subba to Admin');
    }

    // Show all admins
    const admins = await AdminUser.find().select('username role');
    console.log('\n📋 All Admins:');
    admins.forEach(admin => {
      console.log(`  - ${admin.username}: ${admin.role} (Level ${AdminUser.ROLE_LEVELS[admin.role]})`);
    });

  } catch (error) {
    console.error('Error updating admin role:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
  }
};

updateAdminRole();


