const mongoose = require('mongoose');

// Admin roles hierarchy (Super Admin = highest, CSCAdmin = lowest)
const ADMIN_ROLES = {
  DISTRICTHQ_HEAD: 'DistrictHQ Head',
  ADMIN: 'Admin',
  DISTRICT_OVERLOOKERS: 'District Overlookers',
  CSC_ADMIN: 'CSCAdmin', // Citizen Service Desk Admin - verifies public users via bio-authentication
  SUPER_ADMIN: 'Super Admin'
};

// Role hierarchy levels for comparison (sequential: 1-5)
// 1=Super Admin, 2=Admin, 3=DistrictHQ Head, 4=District Overlookers, 5=CSCAdmin
const ROLE_LEVELS = {
  [ADMIN_ROLES.SUPER_ADMIN]: 1,
  [ADMIN_ROLES.ADMIN]: 2,
  [ADMIN_ROLES.DISTRICTHQ_HEAD]: 3,
  [ADMIN_ROLES.DISTRICT_OVERLOOKERS]: 4,
  [ADMIN_ROLES.CSC_ADMIN]: 5, // Citizen Service Desk - verifies public users
};

// Map roleLevel (2-5) from admin registration to role string
const ROLE_LEVEL_TO_ROLE = {
  2: ADMIN_ROLES.ADMIN,
  3: ADMIN_ROLES.DISTRICTHQ_HEAD,
  4: ADMIN_ROLES.DISTRICT_OVERLOOKERS,
  5: ADMIN_ROLES.CSC_ADMIN, // Citizen Service Desk - verifies public users
};

const adminUserSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  email: {
    type: String,
    required: false,
    trim: true,
    lowercase: true,
    default: null
  },
  contactNumber: {
    type: String,
    required: false,
    trim: true,
    default: null
  },
  password: {
    type: String,
    required: [true, 'Password is required']
  },
  role: {
    type: String,
    enum: Object.values(ADMIN_ROLES),
    default: ADMIN_ROLES.DISTRICT_OVERLOOKERS,
    required: [true, 'Role is required']
  },
  department: {
    type: String,
    required: false,
    trim: true,
    default: null
  },
  departmentId: {
    type: String,
    required: false,
    trim: true,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'verified' // Existing admins remain verified; new registrations set pending
  },
  rejectionReason: {
    type: String,
    required: false,
    default: null
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser',
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Instance method to check if user has required role level
// Lower number = higher authority (Super Admin = 1, CSCAdmin = 5)
adminUserSchema.methods.hasRoleLevel = function(requiredRole) {
  const userLevel = ROLE_LEVELS[this.role] || 999; // Default to lowest if not found
  const requiredLevel = ROLE_LEVELS[requiredRole] || 999;
  return userLevel <= requiredLevel; // Lower number means higher authority
};

// Static method to get role level
adminUserSchema.statics.getRoleLevel = function(role) {
  return ROLE_LEVELS[role] || 0;
};

const AdminUser = mongoose.model('AdminUser', adminUserSchema);

// Attach roles and levels to the model for easy access
AdminUser.ROLES = ADMIN_ROLES;
AdminUser.ROLE_LEVELS = ROLE_LEVELS;
AdminUser.ROLE_LEVEL_TO_ROLE = ROLE_LEVEL_TO_ROLE;

// Index for faster queries
adminUserSchema.index({ department: 1 });
adminUserSchema.index({ role: 1 });

// Note: username index is automatically created by unique: true
// No need to manually create it again

module.exports = AdminUser;

