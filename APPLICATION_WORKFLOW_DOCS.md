# Application Verification Workflow

## Multi-Level Verification Process

Applications go through a 4-stage verification process with role-based access control.

## Verification Stages

### Stage 1: Initial Admin Verification
- **Stage Name:** `Level_7_8_Review`
- **Allowed Roles:** Level 1 (Super Admin) and Level 2 (Admin)
- **Next Stage:** District Head Review (if verified)

### Stage 2: District Head Verification
- **Stage Name:** `District_Head_Review`
- **Allowed Roles:** Level 6 (DistrictHQ Head)
- **Next Stage:** Department Review (if verified)

### Stage 3: Department Verification
- **Stage Name:** `Department_Review`
- **Allowed Roles:** Level 4 (Department Head) and Level 5 (Department User)
- **Next Stage:** Secretary Review (if verified)

### Stage 4: Secretary Verification
- **Stage Name:** `Secretary_Review`
- **Allowed Roles:** Level 3 (Department Secretary)
- **Next Stage:** Completed (if verified)

## Application Model Fields

### Verification Fields

```javascript
{
  verification_stage: "Applied" | "Level_7_8_Review" | "District_Head_Review" | "Department_Review" | "Secretary_Review" | "Completed",
  verification_history: [
    {
      stage: String,
      verified_by: ObjectId (ref: AdminUser),
      verified_by_name: String,
      verified_by_role: String,
      verified_by_role_level: Number,
      action: "Verified" | "Rejected" | "Forwarded" | "Returned",
      remarks: String,
      verified_at: Date
    }
  ],
  current_verifier: {
    verified_by: ObjectId,
    verified_by_name: String,
    verified_by_role: String,
    verified_by_role_level: Number,
    remarks: String,
    verified_at: Date
  },
  form_data: Object, // Application form data
  documents_submitted: Array
}
```

## API Endpoints

### 1. Apply to Scheme
**POST** `/api/applications/apply`

**Request Body:**
```json
{
  "user_id": "507f1f77bcf86cd799439011",
  "scheme_id": "507f1f77bcf86cd799439012",
  "form_data": {
    "field1": "value1",
    "field2": "value2"
  },
  "documents_submitted": [
    {
      "document_type": "Aadhaar Card",
      "file_url": "public/uploads/user-docs/aadhaar_123.pdf"
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Application submitted successfully",
  "application": {
    "_id": "...",
    "user_id": {...},
    "scheme_id": {...},
    "status": "Applied",
    "verification_stage": "Applied",
    "form_data": {...},
    "documents_submitted": [...]
  }
}
```

### 2. Get Applications
**GET** `/api/applications`

**Query Parameters:**
- `user_id` - Filter by user
- `scheme_id` - Filter by scheme
- `status` - Filter by status
- `verification_stage` - Filter by verification stage
- `assigned_to_me` - Get applications assigned to current admin

**Headers:**
```
x-admin-username: admin_username
x-admin-password: admin_password
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "_id": "...",
      "user_id": {...},
      "scheme_id": {...},
      "status": "Under Review",
      "verification_stage": "Level_7_8_Review",
      "form_data": {...},
      "documents_submitted": [...],
      "verification_history": [...],
      "current_verifier": {...}
    }
  ],
  "count": 10
}
```

**Auto-filtering:** If no filters provided, applications are automatically filtered based on admin's role level:
- Level 1 & 2 → See `Level_7_8_Review` stage
- Level 6 → See `District_Head_Review` stage
- Level 4 & 5 → See `Department_Review` stage
- Level 3 → See `Secretary_Review` stage

### 3. Get Application Details
**GET** `/api/applications/:id`

**Response:**
```json
{
  "status": "success",
  "data": {
    "_id": "...",
    "user_id": {...},
    "scheme_id": {...},
    "status": "Under Review",
    "verification_stage": "Level_7_8_Review",
    "form_data": {...},
    "documents_submitted": [...],
    "verification_history": [
      {
        "stage": "Applied",
        "verified_by": {...},
        "verified_by_name": "Admin Name",
        "verified_by_role": "Admin",
        "verified_by_role_level": 2,
        "action": "Forwarded",
        "remarks": "Looks good, forwarding to district head",
        "verified_at": "2025-01-15T10:30:00.000Z"
      }
    ],
    "current_verifier": {...}
  }
}
```

### 4. Verify Application
**POST** `/api/applications/:id/verify`

**Request Body:**
```json
{
  "action": "Verified",  // "Verified" | "Rejected" | "Forwarded" | "Returned"
  "remarks": "Application verified. All documents are in order."
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Application verified successfully",
  "data": {
    "_id": "...",
    "verification_stage": "District_Head_Review",  // Moved to next stage
    "verification_history": [...],
    "current_verifier": {...}
  }
}
```

**Actions:**
- **Verified/Forwarded:** Moves to next stage
- **Rejected:** Sets status to "Rejected" and stage to "Completed"
- **Returned:** Returns to previous stage

### 5. Assign Application
**POST** `/api/applications/:id/assign`

**Request Body:**
```json
{
  "assign_to_admin_id": "507f1f77bcf86cd799439011"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Application assigned successfully",
  "data": {...}
}
```

### 6. Get User Applications
**GET** `/api/applications/user/:user_id`

**Response:**
```json
{
  "status": "success",
  "data": [...],
  "count": 5
}
```

## Workflow Flow

```
1. User Applies
   ↓
   Status: "Applied"
   Stage: "Applied"
   
2. Level 1 or 2 Admin Verifies
   ↓
   Status: "Under Review"
   Stage: "Level_7_8_Review"
   Action: "Verified" or "Forwarded"
   ↓
   Stage: "District_Head_Review"
   
3. Level 6 (DistrictHQ Head) Verifies
   ↓
   Action: "Verified" or "Forwarded"
   ↓
   Stage: "Department_Review"
   
4. Level 4 or 5 (Department Head/User) Verifies
   ↓
   Action: "Verified" or "Forwarded"
   ↓
   Stage: "Secretary_Review"
   
5. Level 3 (Department Secretary) Verifies
   ↓
   Action: "Verified" or "Forwarded"
   ↓
   Status: "Approved"
   Stage: "Completed"
```

## Verification History

Each verification is recorded with:
- Who verified (admin details)
- When verified
- What action was taken
- Remarks/comments

## Role Permissions

| Role Level | Role Name | Can Verify Stage |
|------------|-----------|------------------|
| 1 | Super Admin | Level_7_8_Review |
| 2 | Admin | Level_7_8_Review |
| 6 | DistrictHQ Head | District_Head_Review |
| 4 | Department Head | Department_Review |
| 5 | Department User | Department_Review |
| 3 | Department Secretary | Secretary_Review |

## Error Responses

**403 Forbidden:**
```json
{
  "status": "error",
  "message": "You don't have permission to verify applications at Level_7_8_Review stage",
  "currentStage": "Level_7_8_Review",
  "yourRoleLevel": 5
}
```

**400 Bad Request:**
```json
{
  "status": "error",
  "message": "Valid action is required (Verified, Rejected, Forwarded, Returned)"
}
```

## Example Usage

### 1. User Applies
```bash
POST /api/applications/apply
{
  "user_id": "user123",
  "scheme_id": "scheme456",
  "form_data": {
    "income": "50000",
    "family_members": 4
  },
  "documents_submitted": [
    {
      "document_type": "Aadhaar Card",
      "file_url": "path/to/file.pdf"
    }
  ]
}
```

### 2. Admin Verifies (Level 1 or 2)
```bash
POST /api/applications/application_id/verify
Headers: x-admin-username, x-admin-password
{
  "action": "Verified",
  "remarks": "Documents verified. Forwarding to district head."
}
```

### 3. District Head Verifies (Level 6)
```bash
POST /api/applications/application_id/verify
{
  "action": "Forwarded",
  "remarks": "Approved for department review."
}
```

### 4. Department Verifies (Level 4 or 5)
```bash
POST /api/applications/application_id/verify
{
  "action": "Verified",
  "remarks": "All requirements met."
}
```

### 5. Secretary Verifies (Level 3)
```bash
POST /api/applications/application_id/verify
{
  "action": "Verified",
  "remarks": "Final approval granted."
}
```

## Notes

- Each verification is logged in `verification_history`
- Applications can be rejected at any stage
- Applications can be returned to previous stage
- Only admins with appropriate role levels can verify at each stage
- Applications are automatically filtered based on admin's role level when fetching


