const mongoose = require('mongoose');

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
  }
}, {
  timestamps: true
});

// Index for faster queries
adminUserSchema.index({ username: 1 });

module.exports = mongoose.model('AdminUser', adminUserSchema);

