const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/wscheme'
    );

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // One-time safe backfill for Application refPath (Option A: applicant_ref_model)
    try {
      const Application = require("../models/Application");
      const r = await Application.updateMany(
        { applicant_ref_model: { $exists: false } },
        { $set: { applicant_ref_model: "PublicUser" } }
      );
      if (r.modifiedCount > 0) {
        console.log(`Startup migration: set applicant_ref_model on ${r.modifiedCount} application(s).`);
      }
    } catch (e) {
      console.error("Startup migration (applicant_ref_model) failed:", e.message);
    }

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });

    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;

