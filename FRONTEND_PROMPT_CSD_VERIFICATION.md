# Frontend Prompt: CSDAdmin Public User Verification

## Objective

Implement the CSDAdmin interface for verifying public users. CSDAdmin performs bio-authentication and marks public users as verified or rejected. Only verified users can apply to schemes.

---

## API Endpoints

### 1. Pending Applications (Scheme Applications)

CSD Admin is the **first** step in application verification. New applications start at "CSD Admin Review" before going to Post Operator.

**GET /api/csd/pending-applications** – List scheme applications pending CSD Admin review (`verification_level === 9`).

**Response (200):**
```json
{
  "status": "success",
  "pendingApplications": [
    {
      "_id": "application_id",
      "applicantName": "Tashi Lepcha",
      "applicantMobile": "9800015247",
      "schemeName": "Student Scholarship",
      "schemeId": "...",
      "date_applied": "2025-01-15T10:30:00.000Z",
      "verification_level": 9,
      "verification_stage": "CSD Admin Review",
      "status": "Applied"
    }
  ],
  "count": 1
}
```

To verify these applications, use **POST /api/applications/:id/verify** with `action: "Verified"` or `action: "Forwarded"` (same as other admins).

---

### 2. Pending Public Users (Identity Verification)

**GET /api/csd/pending-public-users** – List public users (citizens) with `verificationStatus === "pending"` who need bio-authentication.

---

### Authentication

All endpoints require admin authentication via headers:
```
x-admin-username: <csd_admin_username>
x-admin-password: <csd_admin_password>
```

Only users with role **CSDAdmin** can access these endpoints. Others receive 403.

---

### 1. GET /api/csd/pending-public-users

List public users with `verificationStatus === "pending"`.

**Request:** GET (no body)

**Response (200):**
```json
{
  "status": "success",
  "pendingPublicUsers": [
    {
      "_id": "ObjectId string",
      "fullName": "Tashi Lepcha",
      "gender": "F",
      "dob": "1990-03-12T00:00:00.000Z",
      "mobile": "9800015247",
      "email": "tashi.lepcha@example.com",
      "address": { ... },
      "verificationStatus": "pending",
      "kycLevel": "FULL",
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "users": [ ... ],
  "count": 1
}
```

**Error (403):** "Only CSDAdmin can verify public users" – when logged-in admin is not CSDAdmin

**Error (401):** "Admin authentication required" or "Invalid admin credentials"

---

### 2. POST /api/csd/verify-public-user

Approve or reject a pending public user.

**Request body:**
```json
{
  "userId": "ObjectId string",    // PublicUser _id
  "action": "approve" | "reject",
  "rejectionReason": "Optional string for reject"
}
```

**Response (200):**
```json
{
  "status": "success",
  "message": "Public user verified successfully",
  "user": {
    "_id": "...",
    "fullName": "Tashi Lepcha",
    "verificationStatus": "verified"
  }
}
```

For `action: "reject"`:
```json
{
  "status": "success",
  "message": "Public user rejected",
  "user": {
    "_id": "...",
    "fullName": "Tashi Lepcha",
    "verificationStatus": "rejected"
  }
}
```

**Error (400):** "userId and action are required", "action must be 'approve' or 'reject'", "User is not pending"

**Error (404):** "Public user not found"

**Error (403):** "Only CSDAdmin can verify public users"

---

## UI Requirements

### 1. Pending Users List Page

- **Route:** e.g. `/admin/csd/pending-users` or `/csd/verify`
- **Access:** CSDAdmin only (redirect or hide if not CSDAdmin)
- **Data:** Fetch `GET /api/csd/pending-public-users`
- **Display:** Table or card list with:
  - Full name
  - Mobile
  - Email
  - KYC level (BASIC / PARTIAL / FULL)
  - Date registered
  - **Actions:** Approve button, Reject button
- **Empty state:** "No pending users" when list is empty

### 2. Approve Flow

- User clicks **Approve**
- Optional: confirmation modal ("Verify this user?")
- Call `POST /api/csd/verify-public-user` with `{ userId, action: "approve" }`
- On success: remove user from list (or refresh list), show success toast
- On error: show error message

### 3. Reject Flow

- User clicks **Reject**
- Show modal or inline form:
  - Optional: **Rejection reason** (textarea)
  - **Confirm** / **Cancel**
- Call `POST /api/csd/verify-public-user` with `{ userId, action: "reject", rejectionReason?: string }`
- On success: remove user from list, show success toast
- On error: show error message

### 4. Optional: User Detail View

- Click user row to see full profile (use existing public profile API if available)
- Helps CSDAdmin verify identity before approve/reject

---

## Navigation / Access Control

- Add **Verify Public Users** or **CSD Verification** link in admin sidebar/dashboard
- Show link only when `admin.role === "CSDAdmin"`
- If non-CSDAdmin visits the page, show 403 message or redirect to dashboard

---

## Tech Notes

- Use same admin auth pattern as other admin pages (headers or stored token)
- Handle 403 from API: show "You do not have permission" or redirect
- Refresh pending list after each approve/reject, or optimistically remove the row

---

## Example Request (JavaScript)

```javascript
// List pending users
const res = await fetch("/api/csd/pending-public-users", {
  headers: {
    "x-admin-username": adminUsername,
    "x-admin-password": adminPassword,
  },
});
const data = await res.json();

// Approve user
await fetch("/api/csd/verify-public-user", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-admin-username": adminUsername,
    "x-admin-password": adminPassword,
  },
  body: JSON.stringify({ userId: "abc123", action: "approve" }),
});

// Reject user
await fetch("/api/csd/verify-public-user", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-admin-username": adminUsername,
    "x-admin-password": adminPassword,
  },
  body: JSON.stringify({
    userId: "abc123",
    action: "reject",
    rejectionReason: "Documents did not match",
  }),
});
```
