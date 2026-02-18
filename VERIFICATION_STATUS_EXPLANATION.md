# Verification Status & KYC Levels Explanation

## Public user statuses (summary)

| Status type | Values | Meaning |
|------------|--------|--------|
| **Verification status** | `pending` | Not yet verified by CSDAdmin. Can **view** schemes only; **cannot apply**. |
| | `verified` | Bio-authenticated by CSDAdmin. Can **view and apply** to schemes. |
| | `rejected` | Verification rejected. Can **view** schemes only; **cannot apply**. |
| **Account status** | `isActive: true` | Account can log in and use the portal. |
| | `isActive: false` / `isDeactivated: true` | Account disabled; cannot use the portal. |

**Universal rule:** Only public users with **`verificationStatus === "verified"`** can **apply** to schemes. All others (pending or rejected) can only **view** schemes.

---

## What is KYC Level?

**KYC (Know Your Customer)** is a process of verifying the identity of users. The KYC level indicates **how much profile information has been collected**, not whether the user is verified.

### KYC Levels:

1. **BASIC**
   - User has only registered with mobile number
   - Minimal information collected
   - Default level after registration

2. **PARTIAL**
   - User has provided some profile data
   - Requirements: Full name + at least one of:
     - Date of birth, OR
     - Gender, OR
     - Address (locality)
   - User has started filling profile but not complete

3. **FULL**
   - User has provided all required profile fields
   - Requirements: All of the following:
     - Aadhaar number (12 digits)
     - Full name
     - Date of birth
     - Gender
     - Complete address (locality, district, state, pincode)
   - User has completed all profile fields

**Important:** KYC level only indicates **data completeness**. It does NOT mean the user is verified.

---

## Verification Status

**Verification Status** is separate from KYC level and indicates whether a user has been **bio-authenticated by a CSDAdmin**.

### Verification Status Values:

1. **pending** (Default)
   - User has completed profile but not yet verified
   - User needs to visit CSDAdmin for bio-authentication
   - Set automatically after registration and profile completion

2. **verified**
   - User has been bio-authenticated by CSDAdmin
   - User can access all services
   - Set by CSDAdmin after successful bio-authentication

3. **rejected**
   - User verification was rejected by CSDAdmin
   - Includes rejection reason
   - User may need to correct profile or re-submit

---

## Verification Workflow

```
1. User Registers
   └─> verificationStatus: "pending"
   └─> kycLevel: "BASIC"

2. User Completes Profile
   └─> verificationStatus: "pending" (remains pending)
   └─> kycLevel: "PARTIAL" or "FULL" (based on data)

3. User Visits CSDAdmin for Bio-Authentication
   └─> CSDAdmin performs bio-authentication
   └─> CSDAdmin verifies documents and biometrics

4. CSDAdmin Approves/Rejects
   └─> verificationStatus: "verified" OR "rejected"
   └─> verifiedBy: CSDAdmin ID
   └─> verifiedAt: Timestamp

5. User Can Apply to Schemes
   └─> Only if verificationStatus: "verified"
   └─> pending / rejected: can only view schemes, not apply
```

---

## Scheme applications (universal rule)

- **Apply to scheme:** Allowed only when `verificationStatus === "verified"`.
- **View schemes:** Allowed for any logged-in public user (pending, verified, or rejected).
- If a non-verified user tries to apply, the API returns **403** with a message that they must complete verification first (or that they were rejected).

---

## Who Can Verify Users?

- **Only CSDAdmin role** can verify public users
- CSDAdmin performs bio-authentication using:
  - Fingerprint scanning
  - Iris scanning
  - Face recognition
- After successful bio-authentication, CSDAdmin marks user as verified

**Note:** CSDAdmin verification endpoints will be added in the future. For now, users remain in "pending" status after profile completion.

---

## Database Schema

### PublicUser Model - Status Field:

```javascript
status: {
  isActive: Boolean,           // Account active status
  isDeactivated: Boolean,    // Account deactivated flag
  reason: String,             // Reason for deactivation
  verificationStatus: String, // "pending" | "verified" | "rejected"
  verifiedBy: ObjectId,       // CSDAdmin who verified (ref: AdminUser)
  verifiedAt: Date,          // Timestamp when verified
  rejectionReason: String     // Reason if rejected
}
```

### AdminUser Model - CSDAdmin Role:

```javascript
role: {
  enum: [
    "Post Operator",
    "District Overlookers",
    "DistrictHQ Head",
    "Department User",
    "Department Head",
    "Department Secretary",
    "Admin",
    "CSDAdmin",        // NEW: Citizen Service Desk Admin
    "Super Admin"
  ]
}
```

---

## API Response Changes

All profile and auth endpoints that return a `user` object now include:

- **`verificationStatus`**: `"pending"` | `"verified"` | `"rejected"`
- **`accountStatusMessage`**: User-facing message for the frontend to show when not verified:
  - **pending**: `"Please verify your account at the nearest CSD Center"`
  - **rejected**: `"Your account verification was rejected. Please contact support."`
  - **verified**: `null`

```json
{
  "status": "success",
  "user": {
    "_id": "...",
    "fullName": "John Doe",
    "kycLevel": "FULL",
    "verificationStatus": "pending",
    "accountStatusMessage": "Please verify your account at the nearest CSD Center",
    "documents": { ... }
  }
}
```

---

## Frontend Implementation

### Display Verification Status:

Use **`accountStatusMessage`** for a single, consistent message (no need to branch on status in the UI):

```jsx
{user?.accountStatusMessage && (
  <div className="alert alert-warning">{user.accountStatusMessage}</div>
)}
```

Or branch by status if needed:

```jsx
{profile.verificationStatus === "pending" && (
  <div className="alert alert-warning">
    Your profile is pending verification. 
    Please visit a CSDAdmin for bio-authentication.
  </div>
)}

{profile.verificationStatus === "verified" && (
  <div className="alert alert-success">
    Your profile has been verified. You can access all services.
  </div>
)}

{profile.verificationStatus === "rejected" && (
  <div className="alert alert-danger">
    Your verification was rejected. 
    Reason: {profile.rejectionReason}
  </div>
)}
```

### Check Before Allowing Actions:

```javascript
// Only allow actions if user is verified
if (user.verificationStatus !== "verified") {
  alert("Please complete verification with CSDAdmin first.");
  return;
}
```

---

## Summary

- **KYC Level**: Indicates how much profile data is collected (BASIC/PARTIAL/FULL)
- **Verification Status**: Indicates if user is bio-authenticated by CSDAdmin (pending/verified/rejected)
- **Default Status**: All users start with `verificationStatus: "pending"`
- **CSDAdmin Role**: Only CSDAdmin can verify users (endpoints to be added)
- **User Flow**: Register → Complete Profile → Visit CSDAdmin → Get Verified → Access Services
