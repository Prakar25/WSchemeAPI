const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

/**
 * Hash a plain password for storage.
 * @param {string} plainPassword - Raw password from user
 * @returns {Promise<string>} Bcrypt hash
 */
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compare plain password with stored hash.
 * Supports both bcrypt hashes and legacy plain-text (for migration).
 * @param {string} plainPassword - Password from login/session
 * @param {string} storedPassword - Value from DB (hash or legacy plain)
 * @returns {Promise<boolean>} True if match
 */
async function comparePassword(plainPassword, storedPassword) {
  if (!plainPassword || !storedPassword) return false;

  // Bcrypt hashes start with $2a$, $2b$, or $2y$
  if (/^\$2[aby]\$/.test(storedPassword)) {
    return bcrypt.compare(plainPassword, storedPassword);
  }

  // Legacy plain-text (backward compatibility during migration)
  return plainPassword === storedPassword;
}

/**
 * Validate password strength (min length, optional complexity).
 * @param {string} password
 * @returns {{ valid: boolean, message?: string }}
 */
function validatePasswordStrength(password) {
  if (!password || typeof password !== "string") {
    return { valid: false, message: "Password is required" };
  }
  const p = password.trim();
  if (p.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters" };
  }
  if (p.length > 128) {
    return { valid: false, message: "Password must be at most 128 characters" };
  }
  // Optional: require mix of character types (common policy)
  // Uncomment if needed:
  // if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/\d/.test(p)) {
  //   return { valid: false, message: "Password must contain uppercase, lowercase, and a number" };
  // }
  return { valid: true };
}

module.exports = {
  hashPassword,
  comparePassword,
  validatePasswordStrength,
};
