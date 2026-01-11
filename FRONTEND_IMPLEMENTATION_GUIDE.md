# Frontend Implementation Guide - Welfare Scheme API

## Table of Contents
1. [API Base URL](#api-base-url)
2. [Authentication](#authentication)
3. [Public User APIs](#public-user-apis)
4. [Admin APIs](#admin-apis)
5. [Scheme APIs](#scheme-apis)
6. [Application APIs](#application-apis)
7. [Error Handling](#error-handling)
8. [Data Models](#data-models)
9. [Workflow Diagrams](#workflow-diagrams)

---

## API Base URL

```
http://localhost:3000/api
```

**Note:** If your frontend base URL is `http://localhost:3000/api`, use endpoints without `/api` prefix.
If your base URL is `http://localhost:3000`, use endpoints with `/api` prefix.

---

## Authentication

### Admin Authentication

All admin endpoints require authentication via headers, query params, or body:

**Option 1: Headers (Recommended)**
```javascript
headers: {
  'x-admin-username': 'admin_username',
  'x-admin-password': 'admin_password'
}
```

**Option 2: Query Parameters**
```
?username=admin_username&password=admin_password
```

**Option 3: Request Body**
```json
{
  "username": "admin_username",
  "password": "admin_password"
}
```

### Public User Authentication

Public user endpoints typically use `user_id` as a query parameter or in the request body.

---

## Public User APIs

### 1. Get User by Aadhaar
**GET** `/public-users?aadhaarNumber=XXXXXXXXXXXX`

**Response:**
```json
{
  "status": "success",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439011",
    "fullName": "Priya Sharma",
    "contactEmail": "priya@example.com",
    "phoneNumber": "9876543210",
    "address": {...},
    "dob": "1990-01-15T00:00:00.000Z",
    "aadhaarNumber": "123456789012",
    "gender": "F"
  }
}
```

**Use Case:** Login/lookup by Aadhaar number to get `userId` for subsequent API calls.

---

### 2. Get User Profile
**GET** `/profile/:user_id` or `/profile?user_id=XXX`

**Response:**
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "fullName": "Priya Sharma",
    "aadhaarNumber": "**** **** 1012",
    "aadhaarNumberFull": "123456789012",
    "eligibilityStatus": "Economically Weaker Section",
    "economicStatus": {
      "category": "Economically Weaker Section",
      "annualIncome": 50000
    },
    "dob": "1990-01-15T00:00:00.000Z",
    "gender": "F",
    "contact": {
      "mobile": {...},
      "email": {...}
    },
    "address": {...},
    "kycLevel": "FULL"
  }
}
```

**Use Case:** Display user profile in dashboard.

---

### 3. Update User Profile
**PUT** `/profile/:user_id`

**Request Body:**
```json
{
  "demographics": {
    "fullName": "Updated Name"
  },
  "contact": {
    "mobile": {
      "value": "9876543210"
    }
  }
}
```

---

### 4. Update Economic Status
**PATCH** `/profile/:user_id/economic-status`

**Request Body:**
```json
{
  "category": "Economically Weaker Section",
  "annualIncome": 50000
}
```

---

## Scheme APIs

### 1. Get All Schemes
**GET** `/schemes`

**Query Parameters (Optional):**
- `user_id` - Filter out schemes where user has applied to excluded schemes

**Response:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "scheme_name": "Mukhyamantri Kanya Utthan Yojana",
    "scheme_date": "2025-12-01T00:00:00.000Z",
    "gender": "Female",
    "category": "Pension",
    "sub_category": "Aama Yojana",
    "department": "Health Department",
    "scheme_description": "...",
    "scheme_objectives": [
      "Promote education among girl children",
      "Reduce school dropout rates"
    ],
    "scheme_benefits": [
      "Direct financial assistance",
      "Educational scholarships"
    ],
    "scheme_eligibility": {
      "lower_age_limit": 5,
      "upper_age_limit": 18
    },
    "scheme_required_document_types": [
      "Aadhaar Card",
      "Birth Certificate"
    ],
    "scheme_image_file_url": "public/uploads/admin-uploads/image.jpeg",
    "excluded_schemes": ["other_scheme_id_1", "other_scheme_id_2"],
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

**Use Case:** Display available schemes to users.

---

### 2. Create Scheme (Admin Only)
**POST** `/schemes`

**Request Body:**
```json
{
  "scheme_name": "Child Care Support",
  "scheme_date": "2025-12-01",
  "gender": "All",
  "category": "Child Care",
  "sub_category": "Support",
  "department": "Social Welfare Department",
  "scheme_description": "Description...",
  "scheme_objectives": ["Objective 1", "Objective 2"],
  "scheme_benefits": ["Benefit 1", "Benefit 2"],
  "scheme_eligibility": {
    "lower_age_limit": 0,
    "upper_age_limit": 6
  },
  "scheme_required_document_types": ["Aadhaar Card", "Birth Certificate"],
  "excluded_schemes": ["other_scheme_id"],
  "scheme_image_file_url": "path/to/image.jpeg"
}
```

---

### 3. Update Scheme
**POST** `/schemes/update`

**Request Body:**
```json
{
  "_id": "scheme_id",
  "scheme_name": "Updated Name",
  ...
}
```

---

### 4. Delete Scheme
**POST** `/schemes/delete`

**Request Body:**
```json
{
  "_id": "scheme_id"
}
```

---

## Application APIs

### 1. Apply to Scheme
**POST** `/applications/apply`

**Request Body:**
```json
{
  "user_id": "507f1f77bcf86cd799439011",
  "scheme_id": "507f1f77bcf86cd799439012",
  "form_data": {
    "income": "50000",
    "family_members": 4,
    "household_type": "Nuclear",
    "education_level": "Graduate",
    "employment_status": "Unemployed"
  },
  "documents_submitted": [
    {
      "document_type": "Aadhaar Card",
      "file_url": "public/uploads/user-docs/aadhaar_123.pdf"
    },
    {
      "document_type": "Birth Certificate",
      "file_url": "public/uploads/user-docs/birth_cert_123.pdf"
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
    "_id": "application_id",
    "user_id": {...},
    "scheme_id": {...},
    "status": "Applied",
    "verification_stage": "Level_7_8_Review",
    "form_data": {...},
    "documents_submitted": [...],
    "date_applied": "2025-01-15T10:30:00.000Z"
  }
}
```

**Use Case:** User submits application form with documents.

---

### 2. Get Applications (Admin)
**GET** `/applications`

**Query Parameters:**
- `user_id` - Filter by user
- `scheme_id` - Filter by scheme
- `status` - Filter by status ("Applied", "Under Review", "Approved", "Rejected", "Pending")
- `verification_stage` - Filter by stage
- `assigned_to_me` - Get applications assigned to current admin (true/false)

**Headers:** Admin authentication required

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "_id": "application_id",
      "user_id": {
        "demographics": {
          "fullName": "Priya Sharma",
          "gender": "F",
          "dob": {...}
        },
        "aadhaarNumber": "123456789012"
      },
      "scheme_id": {
        "scheme_name": "Maternity Support Scheme",
        "scheme_type": "CENTRAL",
        "category": "Healthcare",
        "department": "Health Department"
      },
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
          "remarks": "Documents verified",
          "verified_at": "2025-01-15T10:30:00.000Z"
        }
      ],
      "current_verifier": {
        "verified_by": {...},
        "verified_by_name": "Current Admin",
        "verified_by_role": "Admin",
        "verified_by_role_level": 2,
        "remarks": null,
        "verified_at": null
      },
      "date_applied": "2025-01-15T10:30:00.000Z"
    }
  ],
  "count": 10
}
```

**Auto-filtering:** If no filters provided, applications are automatically filtered based on admin's role:
- Level 1 & 2 (Super Admin/Admin) → See `Level_7_8_Review` stage
- Level 6 (DistrictHQ Head) → See `District_Head_Review` stage
- Level 4 & 5 (Department Head/User) → See `Department_Review` stage
- Level 3 (Department Secretary) → See `Secretary_Review` stage

**Use Case:** Admin dashboard to see pending applications for their level.

---

### 3. Get Application Details
**GET** `/applications/:id`

**Headers:** Admin authentication required

**Response:** Same format as above, single application object.

---

### 4. Verify Application
**POST** `/applications/:id/verify`

**Headers:** Admin authentication required

**Request Body:**
```json
{
  "action": "Verified",  // "Verified" | "Rejected" | "Forwarded" | "Returned"
  "remarks": "All documents verified. Application looks good. Forwarding to district head."
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Application verified successfully",
  "data": {
    "_id": "application_id",
    "verification_stage": "District_Head_Review",  // Moved to next stage
    "status": "Under Review",
    "verification_history": [...],
    "current_verifier": {...}
  }
}
```

**Actions:**
- **Verified/Forwarded:** Moves application to next verification stage
- **Rejected:** Sets status to "Rejected" and stage to "Completed"
- **Returned:** Returns application to previous stage

**Role Permissions:**
- Level 1 & 2 can verify at `Level_7_8_Review` stage
- Level 6 can verify at `District_Head_Review` stage
- Level 4 & 5 can verify at `Department_Review` stage
- Level 3 can verify at `Secretary_Review` stage

**Use Case:** Admin verifies and forwards/rejects application.

---

### 5. Assign Application
**POST** `/applications/:id/assign`

**Headers:** Admin authentication required

**Request Body:**
```json
{
  "assign_to_admin_id": "507f1f77bcf86cd799439011"
}
```

**Use Case:** Assign specific application to a particular admin for review.

---

### 6. Get User Applications
**GET** `/applications/user/:user_id`

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "_id": "application_id",
      "scheme_id": {
        "scheme_name": "Maternity Support Scheme",
        "scheme_type": "CENTRAL",
        "category": "Healthcare",
        "department": "Health Department"
      },
      "status": "Under Review",
      "verification_stage": "Level_7_8_Review",
      "date_applied": "2025-01-15T10:30:00.000Z",
      "current_verifier": {...}
    }
  ],
  "count": 3
}
```

**Use Case:** User dashboard to see their application status.

---

## Admin APIs

### 1. Admin Login
**POST** `/admin-login`

**Request Body:**
```json
{
  "username": "karma.tshering",
  "password": "Admin@123"
}
```

**Response:**
```json
{
  "status": "success",
  "user": {
    "_id": "69401881069f98a284aaacbd",
    "fullName": "Karma Tshering",
    "username": "karma.tshering",
    "contactNumber": "9876543210",
    "role": "Super Admin",
    "roleLevel": 1
  }
}
```

**Use Case:** Admin login, store `_id`, `role`, and `roleLevel` for subsequent API calls.

---

### 2. Get Admin Profile
**GET** `/admin/profile`

**Headers:** Admin authentication required

**Response:**
```json
{
  "status": "success",
  "user": {
    "_id": "...",
    "fullName": "Karma Tshering",
    "username": "karma.tshering",
    "contactNumber": "9876543210",
    "role": "Super Admin",
    "roleLevel": 1,
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### 3. Get All Roles
**GET** `/admin/profile/roles/list`

**Headers:** Admin authentication required

**Response:**
```json
{
  "status": "success",
  "roles": [
    {
      "key": "SUPER_ADMIN",
      "name": "Super Admin",
      "level": 1
    },
    {
      "key": "ADMIN",
      "name": "Admin",
      "level": 2
    },
    ...
  ]
}
```

---

### 4. Dashboard Statistics
**GET** `/admin/dashboard/statistics`

**Headers:** Admin authentication required

**Response:**
```json
{
  "status": "success",
  "data": {
    "totalApplicants": 12345,
    "approved": 8765,
    "pending": 2345,
    "rejected": 1235
  }
}
```

---

### 5. Scheme-wise Beneficiaries
**GET** `/admin/dashboard/scheme-beneficiaries`

**Query Parameters:**
- `search` - Filter by scheme name
- `limit` - Number of results (default: 50)
- `skip` - Pagination offset (default: 0)

**Response:**
```json
{
  "status": "success",
  "data": {
    "schemes": [
      {
        "schemeId": "scheme_id",
        "schemeName": "Child Care Support",
        "totalBeneficiaries": 3456,
        "approved": 2890,
        "pending": 456,
        "rejected": 110
      }
    ],
    "total": 10,
    "limit": 50,
    "skip": 0
  }
}
```

---

### 6. Fraud Detection Alerts
**GET** `/admin/dashboard/fraud-alerts`

**Query Parameters:**
- `limit` - Number of alerts (default: 10)
- `type` - "duplicate" | "ineligible" | "all" (default: "all")
- `status` - "active" | "resolved" | "all" (default: "active")

**Response:**
```json
{
  "status": "success",
  "data": {
    "alerts": [
      {
        "alertId": "dup_xxx",
        "type": "duplicate",
        "title": "Duplicate Application",
        "description": "Duplicate application detected for applicant: Priya Sharma",
        "applicantName": "Priya Sharma",
        "applicantId": "user_id",
        "applicationId": "app_id",
        "schemeId": "scheme_id",
        "schemeName": "Scheme Name",
        "detectedAt": "2025-01-15T10:30:00.000Z",
        "status": "active",
        "actionUrl": "/admin/applications/review/:applicationId"
      }
    ],
    "total": 2
  }
}
```

---

## Error Handling

### Standard Error Response Format

```json
{
  "status": "error",
  "message": "Error description",
  "error": "Detailed error (only in development)"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (missing/invalid parameters)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

### Common Error Scenarios

**Authentication Error:**
```json
{
  "status": "error",
  "message": "Admin authentication required"
}
```

**Permission Error:**
```json
{
  "status": "error",
  "message": "You don't have permission to verify applications at Level_7_8_Review stage",
  "currentStage": "Level_7_8_Review",
  "yourRoleLevel": 5
}
```

**Validation Error:**
```json
{
  "status": "error",
  "message": "Validation error",
  "errors": ["Scheme name is required", "Department is required"]
}
```

---

## Data Models

### Application Status Values
- `Applied` - Initial application submitted
- `Under Review` - Being reviewed at a verification stage
- `Approved` - Final approval granted
- `Rejected` - Application rejected
- `Pending` - Pending additional information

### Verification Stages
- `Applied` - Initial stage (backward compatibility)
- `Level_7_8_Review` - Admin/Super Admin verification (Level 1 & 2)
- `District_Head_Review` - DistrictHQ Head verification (Level 6)
- `Department_Review` - Department Head/User verification (Level 4 & 5)
- `Secretary_Review` - Department Secretary verification (Level 3)
- `Completed` - Final stage (Approved/Rejected)

### Verification Actions
- `Verified` - Verified and forwarded to next stage
- `Forwarded` - Same as Verified
- `Rejected` - Application rejected
- `Returned` - Returned to previous stage

### Admin Role Levels
- `1` - Super Admin (highest authority)
- `2` - Admin
- `3` - Department Secretary
- `4` - Department Head
- `5` - Department User
- `6` - DistrictHQ Head
- `7` - District Overlookers
- `8` - Post Operator (lowest authority)

---

## Workflow Diagrams

### Application Verification Flow

```
User Applies
    ↓
Status: "Applied"
Stage: "Level_7_8_Review"
    ↓
[Level 1 or 2 Admin Verifies]
    ↓
Action: "Verified" or "Forwarded"
    ↓
Stage: "District_Head_Review"
    ↓
[Level 6 (DistrictHQ Head) Verifies]
    ↓
Action: "Verified" or "Forwarded"
    ↓
Stage: "Department_Review"
    ↓
[Level 4 or 5 (Department Head/User) Verifies]
    ↓
Action: "Verified" or "Forwarded"
    ↓
Stage: "Secretary_Review"
    ↓
[Level 3 (Department Secretary) Verifies]
    ↓
Action: "Verified" or "Forwarded"
    ↓
Status: "Approved"
Stage: "Completed"
```

### Rejection Flow

```
Any Stage
    ↓
Action: "Rejected"
    ↓
Status: "Rejected"
Stage: "Completed"
```

### Return Flow

```
Current Stage
    ↓
Action: "Returned"
    ↓
Previous Stage
```

---

## Frontend Implementation Checklist

### Public User Dashboard
- [ ] User lookup by Aadhaar
- [ ] Display user profile with masked Aadhaar
- [ ] Show eligibility status
- [ ] Display available schemes (filtered by excluded schemes)
- [ ] Show eligibility status for each scheme
- [ ] Application form with dynamic fields
- [ ] Document upload functionality
- [ ] Submit application
- [ ] Display application status tracker
- [ ] View application details

### Admin Dashboard
- [ ] Admin login
- [ ] Display admin profile with role
- [ ] Dashboard statistics cards
- [ ] Scheme-wise beneficiaries table
- [ ] Fraud detection alerts
- [ ] Application list (filtered by role level)
- [ ] Application verification form
- [ ] Verification history display
- [ ] Assign applications to admins
- [ ] Search and filter applications

### Application Form
- [ ] Dynamic form fields based on scheme requirements
- [ ] File upload for documents
- [ ] Form validation
- [ ] Submit to `/applications/apply`
- [ ] Success/error handling

### Verification Interface
- [ ] Display application details
- [ ] Show form data
- [ ] Display submitted documents
- [ ] Show verification history
- [ ] Action buttons (Verify, Reject, Forward, Return)
- [ ] Remarks/notes input
- [ ] Submit verification to `/applications/:id/verify`

---

## Example Frontend Code

### React Example: Apply to Scheme

```jsx
const applyToScheme = async (userId, schemeId, formData, documents) => {
  try {
    const response = await axios.post('/applications/apply', {
      user_id: userId,
      scheme_id: schemeId,
      form_data: formData,
      documents_submitted: documents.map(doc => ({
        document_type: doc.type,
        file_url: doc.url
      }))
    });
    
    return response.data;
  } catch (error) {
    if (error.response?.status === 400) {
      // Not eligible or already applied
      throw new Error(error.response.data.message);
    }
    throw error;
  }
};
```

### React Example: Get Applications for Admin

```jsx
const getApplications = async (adminUsername, adminPassword) => {
  try {
    const response = await axios.get('/applications', {
      headers: {
        'x-admin-username': adminUsername,
        'x-admin-password': adminPassword
      },
      params: {
        assigned_to_me: 'true' // Optional
      }
    });
    
    return response.data.data; // Array of applications
  } catch (error) {
    console.error('Error fetching applications:', error);
    throw error;
  }
};
```

### React Example: Verify Application

```jsx
const verifyApplication = async (applicationId, action, remarks, adminUsername, adminPassword) => {
  try {
    const response = await axios.post(
      `/applications/${applicationId}/verify`,
      {
        action: action, // "Verified" | "Rejected" | "Forwarded" | "Returned"
        remarks: remarks
      },
      {
        headers: {
          'x-admin-username': adminUsername,
          'x-admin-password': adminPassword
        }
      }
    );
    
    return response.data;
  } catch (error) {
    if (error.response?.status === 403) {
      // Permission denied
      alert(error.response.data.message);
    }
    throw error;
  }
};
```

---

## Important Notes

1. **Base URL:** Ensure your axios/fetch base URL is configured correctly to avoid `/api/api/` issues
2. **Authentication:** Store admin credentials securely (consider using tokens in production)
3. **Role-based UI:** Show/hide features based on `roleLevel` from admin profile
4. **Auto-filtering:** Applications are automatically filtered by admin's role level
5. **Verification History:** Always display verification history to show workflow progress
6. **Document Upload:** Upload documents first, then use the returned file URL in application
7. **Excluded Schemes:** When fetching schemes for a user, use `?user_id=XXX` to automatically filter incompatible schemes
8. **Error Handling:** Always handle 401, 403, and 422 errors appropriately
9. **Loading States:** Show loading indicators for async operations
10. **Form Validation:** Validate form data before submission

---

## Testing Checklist

- [ ] User can lookup by Aadhaar
- [ ] User can view their profile
- [ ] User can see available schemes
- [ ] User can apply to a scheme with form and documents
- [ ] Admin can login
- [ ] Admin sees applications filtered by their role level
- [ ] Admin can verify applications at their stage
- [ ] Admin can reject applications
- [ ] Admin can return applications to previous stage
- [ ] Verification history is displayed correctly
- [ ] Dashboard statistics load correctly
- [ ] Scheme beneficiaries data displays correctly
- [ ] Fraud alerts show correctly
- [ ] Error handling works for all scenarios

---

## Support

For questions or issues, refer to:
- `APPLICATION_WORKFLOW_DOCS.md` - Detailed workflow documentation
- `SCHEME_EXCLUSION_DOCS.md` - Scheme exclusion logic
- `ADMIN_ROLES_DOCS.md` - Admin roles and permissions


