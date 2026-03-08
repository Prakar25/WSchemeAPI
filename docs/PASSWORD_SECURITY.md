# Password Security

## Overview

Admin passwords are hashed with **bcrypt** before storage. Plain passwords are never stored.

---

## Implementation

- **Library:** `bcrypt` (salt rounds: 10)
- **Hash on save:** `POST /api/admin-register`, seed script
- **Verify on login:** `POST /api/admin-login`, `adminAuth` middleware (legacy headers)

---

## Password Policy

- **Min length:** 8 characters
- **Max length:** 128 characters

Frontend should enforce the same rules.

---

## Backward Compatibility

`comparePassword` supports both:
1. **Bcrypt hashes** (new registrations)
2. **Plain-text** (legacy accounts, during migration)

Existing admins with plain passwords continue to work until migrated.

### Migrate Existing Plain Passwords

Run the one-time migration script:

```bash
npm run migrate:admin-passwords
```

This hashes all admin passwords that are not already bcrypt.

---

## API

Passwords are never returned in API responses. The `user` object from login excludes `password`.
