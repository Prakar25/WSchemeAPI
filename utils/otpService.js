/**
 * OTP Service
 * Handles OTP generation, storage, and verification
 * For production, integrate with SMS service provider (e.g., Twilio, AWS SNS, etc.)
 */

// In-memory OTP store (for development)
// In production, consider using Redis or database for OTP storage
const otpStore = new Map();

// OTP expiration time: 10 minutes
const OTP_EXPIRY_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds

/**
 * Generate a 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Store OTP with expiration
 * @param {string} mobileNumber - Mobile number
 * @param {string} otp - OTP code
 * @param {string} purpose - Purpose: 'register' or 'login'
 */
const storeOTP = (mobileNumber, otp, purpose = 'register') => {
  const key = `${mobileNumber}_${purpose}`;
  const expiryTime = Date.now() + OTP_EXPIRY_TIME;
  
  otpStore.set(key, {
    otp,
    expiryTime,
    purpose,
    attempts: 0,
    maxAttempts: 5
  });

  // Clean up expired OTPs periodically
  setTimeout(() => {
    if (otpStore.has(key)) {
      const stored = otpStore.get(key);
      if (Date.now() > stored.expiryTime) {
        otpStore.delete(key);
      }
    }
  }, OTP_EXPIRY_TIME);
};

/**
 * Verify OTP
 * @param {string} mobileNumber - Mobile number
 * @param {string} otp - OTP code to verify
 * @param {string} purpose - Purpose: 'register' or 'login'
 * @returns {object} - { valid: boolean, message: string }
 */
const verifyOTP = (mobileNumber, otp, purpose = 'register') => {
  const key = `${mobileNumber}_${purpose}`;
  const stored = otpStore.get(key);

  if (!stored) {
    return {
      valid: false,
      message: 'OTP not found or expired. Please request a new OTP.'
    };
  }

  // Check if OTP has expired
  if (Date.now() > stored.expiryTime) {
    otpStore.delete(key);
    return {
      valid: false,
      message: 'OTP has expired. Please request a new OTP.'
    };
  }

  // Check max attempts
  if (stored.attempts >= stored.maxAttempts) {
    otpStore.delete(key);
    return {
      valid: false,
      message: 'Maximum OTP verification attempts exceeded. Please request a new OTP.'
    };
  }

  // Increment attempts
  stored.attempts += 1;

  // Verify OTP
  if (stored.otp !== otp) {
    return {
      valid: false,
      message: 'Invalid OTP. Please try again.'
    };
  }

  // OTP is valid - remove it from store
  otpStore.delete(key);

  return {
    valid: true,
    message: 'OTP verified successfully.'
  };
};

/**
 * Send OTP via SMS (placeholder - integrate with SMS service)
 * @param {string} mobileNumber - Mobile number
 * @param {string} otp - OTP code
 * @param {string} purpose - Purpose: 'register' or 'login'
 * @returns {Promise<boolean>} - Success status
 */
const sendOTP = async (mobileNumber, otp, purpose = 'register') => {
  // TODO: Integrate with SMS service provider (Twilio, AWS SNS, etc.)
  // For now, just log it (in development)
  console.log(`[OTP Service] OTP for ${mobileNumber} (${purpose}): ${otp}`);
  
  // In production, implement actual SMS sending:
  // Example with Twilio:
  // const client = require('twilio')(accountSid, authToken);
  // await client.messages.create({
  //   body: `Your OTP for ${purpose === 'register' ? 'registration' : 'login'} is ${otp}. Valid for 10 minutes.`,
  //   to: mobileNumber,
  //   from: '+1234567890'
  // });

  // For development, return true
  return true;
};

/**
 * Request OTP for mobile number
 * @param {string} mobileNumber - Mobile number
 * @param {string} purpose - Purpose: 'register' or 'login'
 * @returns {Promise<object>} - { success: boolean, message: string, otp?: string }
 */
const requestOTP = async (mobileNumber, purpose = 'register') => {
  // Validate mobile number format (Indian format: 10 digits)
  const mobileRegex = /^[6-9]\d{9}$/;
  if (!mobileRegex.test(mobileNumber)) {
    return {
      success: false,
      message: 'Invalid mobile number. Please enter a valid 10-digit Indian mobile number.'
    };
  }

  // Generate OTP
  const otp = generateOTP();

  // Store OTP
  storeOTP(mobileNumber, otp, purpose);

  // Send OTP via SMS
  const sent = await sendOTP(mobileNumber, otp, purpose);

  if (!sent) {
    return {
      success: false,
      message: 'Failed to send OTP. Please try again.'
    };
  }

  // In development, return OTP for testing
  // Remove this in production
  if (process.env.NODE_ENV !== 'production') {
    return {
      success: true,
      message: 'OTP sent successfully.',
      otp: otp // Only in development
    };
  }

  return {
    success: true,
    message: 'OTP sent successfully to your mobile number.'
  };
};

/**
 * Clean up expired OTPs (call periodically)
 */
const cleanupExpiredOTPs = () => {
  const now = Date.now();
  for (const [key, value] of otpStore.entries()) {
    if (now > value.expiryTime) {
      otpStore.delete(key);
    }
  }
};

// Clean up expired OTPs every 5 minutes
setInterval(cleanupExpiredOTPs, 5 * 60 * 1000);

module.exports = {
  requestOTP,
  verifyOTP,
  generateOTP,
  sendOTP
};
