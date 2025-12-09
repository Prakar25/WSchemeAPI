const mongoose = require('mongoose');

const schemeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Scheme name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Education', 'Healthcare', 'Housing', 'Employment', 'Financial', 'Other'],
    default: 'Other'
  },
  eligibility: {
    type: String,
    required: [true, 'Eligibility criteria is required']
  },
  benefits: {
    type: [String],
    default: []
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Draft'],
    default: 'Active'
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for faster queries
schemeSchema.index({ name: 1 });
schemeSchema.index({ category: 1 });
schemeSchema.index({ status: 1 });

module.exports = mongoose.model('Scheme', schemeSchema);

