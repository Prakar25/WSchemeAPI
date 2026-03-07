const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "welfare-scheme-api-secret-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d"; // 7 days default

/**
 * Sign a JWT for admin user
 * @param {Object} payload - { adminId, username, role, roleLevel, ... }
 * @returns {string} JWT token
 */
function signAdminToken(payload) {
  return jwt.sign(
    {
      adminId: payload.adminId || payload._id,
      username: payload.username,
      role: payload.role,
      roleLevel: payload.roleLevel,
      type: "admin",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify JWT and return payload
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload or null
 */
function verifyAdminToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== "admin") return null;
    return decoded;
  } catch {
    return null;
  }
}

module.exports = {
  signAdminToken,
  verifyAdminToken,
  JWT_SECRET,
  JWT_EXPIRES_IN,
};
