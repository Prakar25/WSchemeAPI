# API Quick Reference

## Base URL
```
http://localhost:3000/api
```

## Authentication Headers (Admin)
```
x-admin-username: admin_username
x-admin-password: admin_password
```

---

## Public User Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/public-users?aadhaarNumber=XXXXXXXXXXXX` | Get user by Aadhaar |
| GET | `/profile/:user_id` | Get user profile |
| PUT | `/profile/:user_id` | Update user profile |
| PATCH | `/profile/:user_id/economic-status` | Update economic status |

---

## Scheme Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/schemes?user_id=XXX` | Get all schemes (filtered for user) |
| POST | `/schemes` | Create scheme (admin) |
| POST | `/schemes/update` | Update scheme (admin) |
| POST | `/schemes/delete` | Delete scheme (admin) |

---

## Application Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/applications/apply` | Apply to scheme |
| GET | `/applications` | Get applications (admin, auto-filtered) |
| GET | `/applications/:id` | Get application details (admin) |
| POST | `/applications/:id/verify` | Verify application (admin) |
| POST | `/applications/:id/assign` | Assign to admin (admin) |
| GET | `/applications/user/:user_id` | Get user's applications |

**Verify Actions:** `Verified` | `Rejected` | `Forwarded` | `Returned`

---

## Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin-login` | Admin login |
| GET | `/admin/profile` | Get admin profile |
| GET | `/admin/profile/roles/list` | Get all roles |
| GET | `/admin/dashboard/statistics` | Dashboard stats |
| GET | `/admin/dashboard/scheme-beneficiaries` | Scheme beneficiaries |
| GET | `/admin/dashboard/fraud-alerts` | Fraud alerts |

---

## Verification Stages & Roles

| Stage | Allowed Role Levels |
|-------|---------------------|
| `Level_7_8_Review` | 1 (Super Admin), 2 (Admin) |
| `District_Head_Review` | 6 (DistrictHQ Head) |
| `Department_Review` | 4 (Dept Head), 5 (Dept User) |
| `Secretary_Review` | 3 (Dept Secretary) |

---

## Status Values

- `Applied` - Initial application
- `Under Review` - Being reviewed
- `Approved` - Final approval
- `Rejected` - Rejected
- `Pending` - Pending info

---

## Common Request/Response Examples

### Apply to Scheme
```javascript
POST /applications/apply
{
  "user_id": "user_id",
  "scheme_id": "scheme_id",
  "form_data": {...},
  "documents_submitted": [
    {"document_type": "Aadhaar", "file_url": "path/to/file.pdf"}
  ]
}
```

### Verify Application
```javascript
POST /applications/:id/verify
Headers: x-admin-username, x-admin-password
{
  "action": "Verified",
  "remarks": "Looks good"
}
```

### Get Applications (Auto-filtered by Role)
```javascript
GET /applications
Headers: x-admin-username, x-admin-password
// Automatically shows only applications at admin's verification stage
```

---

## Error Codes

- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden (permission denied)
- `404` - Not Found
- `422` - Validation Error
- `500` - Server Error


