const mongoose = require('mongoose');

// Admin roles hierarchy (Super Admin = highest, Post Operator = lowest)
const ADMIN_ROLES = {
  POST_OPERATOR: 'Post Operator',
  DISTRICT_OVERLOOKERS: 'District Overlookers',
  DISTRICTHQ_HEAD: 'DistrictHQ Head',
  DEPARTMENT_USER: 'Department User',
  DEPARTMENT_HEAD: 'Department Head',
  DEPARTMENT_SECRETARY: 'Department Secretary',
  ADMIN: 'Admin',
  CSD_ADMIN: 'CSDAdmin', // Citizen Service Desk Admin - verifies public users via bio-authentication
  SUPER_ADMIN: 'Super Admin'
};

// Role hierarchy levels for comparison (Super Admin = 1, descending)
const ROLE_LEVELS = {
  [ADMIN_ROLES.SUPER_ADMIN]: 1,
  [ADMIN_ROLES.ADMIN]: 2,
  [ADMIN_ROLES.CSD_ADMIN]: 2.5, // Same level as Admin, specialized for user verification
  [ADMIN_ROLES.DEPARTMENT_SECRETARY]: 3,
  [ADMIN_ROLES.DEPARTMENT_HEAD]: 4,
  [ADMIN_ROLES.DEPARTMENT_USER]: 5,
  [ADMIN_ROLES.DISTRICTHQ_HEAD]: 6,
  [ADMIN_ROLES.DISTRICT_OVERLOOKERS]: 7,
  [ADMIN_ROLES.POST_OPERATOR]: 8
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
  contactNumber: {
    type: String,
    required: [true, 'Contact number is required'],
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required']
  },
  role: {
    type: String,
    enum: Object.values(ADMIN_ROLES),
    default: ADMIN_ROLES.POST_OPERATOR,
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
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Instance method to check if user has required role level
// Lower number = higher authority (Super Admin = 1, Post Operator = 8)
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

// Index for faster queries
adminUserSchema.index({ department: 1 });
adminUserSchema.index({ role: 1 });

// Note: username index is automatically created by unique: true
// No need to manually create it again

module.exports = AdminUser;

