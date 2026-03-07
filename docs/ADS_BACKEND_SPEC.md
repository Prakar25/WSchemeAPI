# Ads Backend API – Request/Response Reference

## Overview

- **Public:** `GET /api/ads/public` (no auth)
- **Admin:** All other endpoints require `x-admin-username` and `x-admin-password`. Super Admin only.

---

## 1. GET /api/ads/public (Public – no auth)

### Request
```
GET /api/ads/public
```
No headers or body required.

### Response 200
```json
[
  {
    "id": "69a5cc6e83bddc5e79767e91",
    "_id": "69a5cc6e83bddc5e79767e91",
    "text": "Welfare Schemes",
    "link": "https://example.com/schemes",
    "image": "https://example.com/uploads/ad1.jpg",
    "image_url": "https://example.com/uploads/ad1.jpg"
  },
  {
    "id": "69a5cc6e83bddc5e79767e92",
    "_id": "69a5cc6e83bddc5e79767e92",
    "text": "Apply Now",
    "link": "https://example.com/apply",
    "image": null,
    "image_url": null
  }
]
```

---

## 2. GET /api/ads (Admin – list all)

### Request
```
GET /api/ads
Headers:
  x-admin-username: super.admin
  x-admin-password: Admin@123
```

### Response 200
```json
[
  {
    "_id": "69a5cc6e83bddc5e79767e91",
    "text": "Welfare Schemes",
    "link": "https://example.com/schemes",
    "image_url": "https://example.com/uploads/ad1.jpg",
    "order": 0,
    "active": true,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  },
  {
    "_id": "69a5cc6e83bddc5e79767e92",
    "text": "Apply Now",
    "link": "https://example.com/apply",
    "image_url": null,
    "order": 1,
    "active": false,
    "createdAt": "2025-01-15T11:00:00.000Z",
    "updatedAt": "2025-01-15T11:00:00.000Z"
  }
]
```

---

## 3. POST /api/ads (Admin – create)

### Request
```
POST /api/ads
Headers:
  Content-Type: application/json
  x-admin-username: super.admin
  x-admin-password: Admin@123

Body:
{
  "text": "Welfare Schemes",
  "link": "https://example.com/schemes",
  "image_url": "https://example.com/uploads/ad.jpg",
  "order": 0,
  "active": true
}
```

| Field     | Type    | Required | Description              |
|-----------|---------|----------|--------------------------|
| text      | string  | Yes      | Display text             |
| link      | string  | No       | URL on click             |
| image_url | string  | No       | Image URL                |
| order     | number  | No       | Display order (default 0)|
| active    | boolean | No       | Show on public (default true) |

### Response 201
```json
{
  "_id": "69a5cc6e83bddc5e79767e93",
  "text": "Welfare Schemes",
  "link": "https://example.com/schemes",
  "image_url": "https://example.com/uploads/ad.jpg",
  "order": 0,
  "active": true,
  "createdAt": "2025-01-15T12:00:00.000Z",
  "updatedAt": "2025-01-15T12:00:00.000Z"
}
```

### Error 400
```json
{
  "status": "error",
  "message": "text is required"
}
```

---

## 4. PUT /api/ads/:id (Admin – update)

### Request
```
PUT /api/ads/69a5cc6e83bddc5e79767e93
Headers:
  Content-Type: application/json
  x-admin-username: super.admin
  x-admin-password: Admin@123

Body (all fields optional):
{
  "text": "Updated Welfare Schemes",
  "link": "https://example.com/schemes-v2",
  "image_url": "https://example.com/uploads/ad-new.jpg",
  "order": 1,
  "active": false
}
```

### Response 200
```json
{
  "_id": "69a5cc6e83bddc5e79767e93",
  "text": "Updated Welfare Schemes",
  "link": "https://example.com/schemes-v2",
  "image_url": "https://example.com/uploads/ad-new.jpg",
  "order": 1,
  "active": false,
  "createdAt": "2025-01-15T12:00:00.000Z",
  "updatedAt": "2025-01-15T12:30:00.000Z"
}
```

### Error 404
```json
{
  "status": "error",
  "message": "Ad not found"
}
```

---

## 5. DELETE /api/ads/:id (Admin – delete)

### Request
```
DELETE /api/ads/69a5cc6e83bddc5e79767e93
Headers:
  x-admin-username: super.admin
  x-admin-password: Admin@123
```

### Response 200
```json
{
  "status": "success",
  "message": "Ad deleted successfully"
}
```

### Error 404
```json
{
  "status": "error",
  "message": "Ad not found"
}
```

---

## 6. POST /api/ads/reorder (Admin – reorder)

### Request
```
POST /api/ads/reorder
Headers:
  Content-Type: application/json
  x-admin-username: super.admin
  x-admin-password: Admin@123

Body:
{
  "orders": [
    { "id": "69a5cc6e83bddc5e79767e92", "order": 0 },
    { "id": "69a5cc6e83bddc5e79767e91", "order": 1 }
  ]
}
```

### Response 200
```json
{
  "status": "success",
  "message": "Ads reordered",
  "ads": [
    {
      "_id": "69a5cc6e83bddc5e79767e92",
      "text": "Apply Now",
      "link": "https://example.com/apply",
      "image_url": null,
      "order": 0,
      "active": true,
      "createdAt": "2025-01-15T11:00:00.000Z",
      "updatedAt": "2025-01-15T12:35:00.000Z"
    },
    {
      "_id": "69a5cc6e83bddc5e79767e91",
      "text": "Welfare Schemes",
      "link": "https://example.com/schemes",
      "image_url": "https://example.com/uploads/ad1.jpg",
      "order": 1,
      "active": true,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T12:35:00.000Z"
    }
  ]
}
```

### Error 400
```json
{
  "status": "error",
  "message": "orders array is required with items { id, order }"
}
```

---

## Common Errors

### 401 Unauthorized
```json
{
  "status": "error",
  "message": "Admin authentication required"
}
```

### 403 Forbidden (not Super Admin)
```json
{
  "status": "error",
  "message": "Access denied. Required role: Super Admin",
  "userRole": "Admin"
}
```
