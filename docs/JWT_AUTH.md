# JWT Admin Authentication

## Overview

The backend supports two auth methods for admin endpoints:

1. **JWT** (preferred): `Authorization: Bearer <token>`
2. **Legacy headers**: `x-admin-username` + `x-admin-password`

Both work. JWT is returned on login; use it for subsequent requests.

---

## Login

**POST /api/admin-login**

**Request:**
```json
{
  "username": "super.admin",
  "password": "Admin@123"
}
```

**Response (200):**
```json
{
  "status": "success",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "...",
    "fullName": "...",
    "username": "super.admin",
    "role": "Super Admin",
    "roleLevel": 1,
    ...
  }
}
```

Store `token` and send it on all admin API requests.

---

## Using the Token

**Option A – Authorization header (recommended):**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Example (axios):**
```javascript
axios.get("/api/ads", {
  headers: {
    Authorization: `Bearer ${storedToken}`,
  },
});
```

**Option B – Legacy headers (still supported):**
```
x-admin-username: super.admin
x-admin-password: Admin@123
```

---

## Environment Variables

Add to `.env`:

| Variable     | Description                 | Default                          |
|-------------|-----------------------------|----------------------------------|
| `JWT_SECRET`| Secret for signing tokens   | `welfare-scheme-api-secret-...` (dev) |
| `JWT_EXPIRES_IN` | Token expiry           | `7d`                             |

**Production:** Set `JWT_SECRET` to a strong random string.
