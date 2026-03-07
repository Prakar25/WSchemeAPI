# Frontend Prompt: JWT Admin Authentication

## Objective

Integrate JWT-based authentication for admin flows. The backend now supports **Bearer token** auth instead of (or in addition to) sending username/password on every request. The frontend must:

1. Call login once and receive a JWT token
2. Store the token (e.g. `localStorage` or secure storage)
3. Send the token on **every admin API request** via `Authorization: Bearer <token>`
4. Handle token expiry / 401 by redirecting to login

---

## API

### Login

**POST /api/admin-login**

**Request body (JSON):**
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
    "_id": "507f1f77bcf86cd799439011",
    "fullName": "Super Admin",
    "username": "super.admin",
    "contactNumber": "9876543210",
    "role": "Super Admin",
    "roleLevel": 1,
    "department": null,
    "departmentId": null
  }
}
```

**Error responses:**
- `400` – Missing `username` or `password`
- `401` – Invalid credentials
- `403` – Account inactive or pending/rejected verification

---

## Changes to Implement

### 1. Login Flow

- On successful login, store:
  - `token` – JWT (required for all admin requests)
  - `user` – Admin profile (display name, role, roleLevel, etc.)
- Redirect to admin dashboard (or intended destination)

### 2. Token Storage

- Store token in `localStorage`, `sessionStorage`, or a secure cookie, depending on your security/UX needs
- Store `user` alongside or derive from token (backend does not expose user in token payload; keep it from login response)

### 3. Attach Token to Admin Requests

On **every** admin API request, include the header:

```
Authorization: Bearer <stored_token>
```

**Example (axios):**
```javascript
const token = localStorage.getItem("adminToken");
axios.get("/api/ads", {
  headers: {
    Authorization: token ? `Bearer ${token}` : "",
  },
});
```

**Example (fetch):**
```javascript
const token = localStorage.getItem("adminToken");
fetch("/api/ads", {
  headers: {
    Authorization: token ? `Bearer ${token}` : "",
  },
});
```

**Recommended:** Use a single axios/fetch instance or interceptor so all admin calls automatically include the header:

```javascript
// Axios interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("adminToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("adminToken");
      window.location.href = "/admin/login";
    }
    return Promise.reject(err);
  }
);
```

### 4. Affected Endpoints

All admin routes require this auth. Examples:
- `GET/POST /api/ads`, `PUT/DELETE /api/ads/:id`, `POST /api/ads/reorder`
- `GET/POST /api/schemes`, `GET /api/schemes/:id`, `POST /api/schemes/update`
- `GET/POST /api/applications`, `/api/applications/:id/verify`, etc.
- `GET /api/csd/pending-applications`, `GET /api/csd/pending-public-users`, `POST /api/csd/verify-public-user`
- `GET /api/admin-users`, `PUT /api/admin-login/:adminId/update-role`, etc.

Any route protected by `adminAuth` accepts `Authorization: Bearer <token>`.

### 5. Logout

- Remove stored token and user
- Redirect to login page

### 6. Handle 401

- If any admin request returns `401` (invalid/expired token), clear token and redirect to login

---

## Migration from Legacy Auth

If the frontend currently sends `x-admin-username` and `x-admin-password` on each request:

- **Replace** with login once → store token → send `Authorization: Bearer <token>`
- Do **not** store or send passwords in headers anymore
- The legacy headers still work for backwards compatibility, but JWT is preferred and more secure

---

## Summary Checklist

- [ ] Login: POST `/api/admin-login`, store `token` and `user`
- [ ] Add axios/fetch interceptor to attach `Authorization: Bearer <token>` to all admin requests
- [ ] Add 401 handler: clear token, redirect to login
- [ ] Logout: clear token and user, redirect to login
- [ ] Remove or deprecate use of `x-admin-username` and `x-admin-password` for admin API calls
