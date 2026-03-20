/**
 * OTP Service
 * Handles OTP generation, storage, verification, and SMS sending via ThunderSMS
 */

const axios = require("axios");
const https = require("https");

const WEBSITE_NAME = "Himalayan Creators";

// HTTPS agent for ThunderSMS (some servers have cert issues)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

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
 * Send OTP via ThunderSMS (when configured) or log only
 * Always logs OTP to console for debugging
 * @param {string} mobileNumber - Mobile number (10 digits)
 * @param {string} otp - OTP code
 * @param {string} purpose - Purpose: 'register' or 'login'
 * @returns {Promise<boolean>} - Success status
 */
const sendOTP = async (mobileNumber, otp, purpose = "register") => {
  let reason = "Login";
  if (purpose === "register") reason = "Registration";
  else if (purpose.startsWith("application_complete")) reason = "Application Approval";

  // Always log OTP to terminal for debugging
  console.log(`[OTP] ${mobileNumber} (${purpose}): ${otp}`);

  const smsUser = process.env.THUNDER_SMS_USER || process.env.THUNDER_SMS_MOBILE_NO;
  const hasThunderConfig =
    smsUser &&
    process.env.THUNDER_SMS_API_KEY &&
    process.env.THUNDER_SMS_SENDER_ID &&
    process.env.THUNDER_SMS_TEMPLATE_ID &&
    process.env.THUNDER_SMS_PE_ID;

  if (!hasThunderConfig) {
    console.log(`[OTP] ThunderSMS not configured. Add THUNDER_SMS_* env vars to send real SMS.`);
    return true;
  }

  try {
    // newportal push API - message must match DLT template exactly
    const contextMap = {
      Registration: "Registration Portal",
      Login: "Login Portal",
      "Application Approval": "Application Approval Portal",
    };
    const context = contextMap[reason] || "Login Portal";
    const msgtxt = `${otp} is your OTP to ${context}. Kindly keep this confidential for security purposes. -HYN Hive`;

    const params = {
      username: smsUser,
      signature: process.env.THUNDER_SMS_SENDER_ID,
      apikey: process.env.THUNDER_SMS_API_KEY,
      msgtxt,
      msgtype: "PM",
      dest: mobileNumber,
      entityid: process.env.THUNDER_SMS_PE_ID,
      templateid: process.env.THUNDER_SMS_TEMPLATE_ID,
    };

    const required = ["username", "signature", "apikey", "msgtxt", "msgtype", "dest", "entityid", "templateid"];
    console.log("[OTP] ThunderSMS (newportal) params:", required.map((k) => `${k}=${k === "apikey" ? "***" : params[k]}`).join(", "));

    const sendRes = await axios.get("https://newportal.thundersms.com/pushapi/sendmsg", {
      params,
      httpsAgent,
    });

    console.log("[OTP] ThunderSMS response:", JSON.stringify(sendRes.data));
    return true;
  } catch (error) {
    console.error("[OTP] ThunderSMS error:", error.message);
    return false;
  }
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
