const express = require('express');
const router = express.Router();

// Health check route
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
});

// Scheme routes
router.use('/schemes', require('./schemes'));

module.exports = router;

