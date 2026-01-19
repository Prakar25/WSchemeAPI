# Frontend Implementation Guide: Scheme Creation with Authorization Levels and Approval Workflow

## Overview

The scheme creation API has been updated to include:
1. **Authorization Levels**: Define who can authorize applications at each stage
2. **Scheme Approval**: All new schemes require approval from Department Head, Department Secretary, or Super Admin before becoming active
3. **Creator Tracking**: Track who created the scheme and when

---

## API Changes

### 1. Create Scheme Endpoint

**Endpoint:** `POST /api/schemes`

**Authentication:** Required (Admin authentication headers)

**Headers:**
```
x-admin-username: <admin_username>
x-admin-password: <admin_password>
```

**Request Body:**
```json
{
  "scheme_name": "Example Scheme",
  "scheme_date": "2025-01-15T00:00:00.000Z",
  "gender": "All",
  "category": "Education",
  "department": "Education Department",
  "scheme_description": "Description of the scheme",
  "scheme_objectives": ["Objective 1", "Objective 2"],
  "scheme_benefits": ["Benefit 1", "Benefit 2"],
  "scheme_eligibility": {
    "lower_age_limit": 18,
    "upper_age_limit": 65
  },
  "scheme_required_document_types": ["Aadhaar", "Income Certificate"],
  "scheme_required_documents": [],
  "scheme_image_file_url": null,
  "excluded_schemes": [],
  "authorization_levels": [1, 2, 4, 5]
}

**Note:** Subcategory field has been removed. The `scheme_name` itself serves as the subcategory.
```

**New Required Field: `authorization_levels`**
- Type: Array of 4 integers
- Format: `[first, second, third, fourth]`
- Validation Rules:
  - **First level:** Must be `1` (Super Admin) or `2` (Admin)
  - **Second level:** Must be `2` (Admin) or `3` (Department Secretary)
  - **Third level:** Must be `4` (Department Head) - Fixed
  - **Fourth level:** Must be `5` (DistrictHQ Head) - Fixed

**Role Hierarchy (Lower number = Higher authority):**
- Level 1: Super Admin (Highest)
- Level 2: Admin
- Level 3: Department Secretary
- Level 4: Department Head
- Level 5: DistrictHQ Head
- Level 6: Department User (View-only, not part of authorization chain)
- Level 7: District Overlookers
- Level 8: Post Operator (Lowest)

**Success Response (201):**
```json
{
  "status": "success",
  "message": "Scheme created successfully. Pending Department Head approval.",
  "scheme": {
    "_id": "...",
    "scheme_name": "Example Scheme",
    "authorization_levels": [1, 2, 4, 5],
    "approval_status": "pending_department_head_approval",
    "created_by": {
      "admin_id": "...",
      "admin_username": "john.doe",
      "admin_role": "Department User",
      "created_at": "2025-01-15T10:30:00.000Z"
    },
    "department_head_approval": null,
    "...": "other scheme fields"
  }
}
```

**Error Response (400) - Validation Error:**
```json
{
  "error": "Validation error",
  "message": "Authorization levels must contain exactly 4 levels"
}
```

**Other Possible Validation Errors:**
- "First authorization level must be 1 (Super Admin) or 2 (Admin)"
- "Second authorization level must be 2 (Admin) or 3 (Department Secretary)"
- "Third authorization level must be 4 (Department Head)"
- "Fourth authorization level must be 5 (DistrictHQ Head)"

---

### 2. Approve Scheme Endpoint

**Endpoint:** `PUT /api/schemes/:id/approve`

**Authentication:** Required (Department Head, Department Secretary, or Super Admin only)

**Headers:**
```
x-admin-username: <admin_username>
x-admin-password: <admin_password>
```

**URL Parameters:**
- `id`: Scheme ID

**Request Body:** (empty or optional)

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Scheme approved successfully",
  "scheme": {
    "_id": "...",
    "approval_status": "approved",
    "department_head_approval": {
      "approved_by": "...",
      "approved_by_username": "dept.head",
      "approved_at": "2025-01-15T11:00:00.000Z",
      "rejection_reason": null
    },
    "created_by": {
      "admin_id": "...",
      "admin_username": "john.doe",
      "admin_role": "Department User"
    },
    "...": "other scheme fields"
  }
}
```

**Error Responses:**
- `403`: "Only Department Head, Department Secretary, or Super Admin can approve scheme creation"
- `400`: "Scheme is already approved" or "Scheme is already rejected"
- `404`: "Scheme not found"

---

### 3. Reject Scheme Endpoint

**Endpoint:** `PUT /api/schemes/:id/reject`

**Authentication:** Required (Department Head, Department Secretary, or Super Admin only)

**Headers:**
```
x-admin-username: <admin_username>
x-admin-password: <admin_password>
```

**URL Parameters:**
- `id`: Scheme ID

**Request Body:**
```json
{
  "rejection_reason": "Optional reason for rejection"
}
```

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Scheme rejected successfully",
  "scheme": {
    "_id": "...",
    "approval_status": "rejected",
    "department_head_approval": {
      "approved_by": "...",
      "approved_by_username": "dept.head",
      "approved_at": "2025-01-15T11:00:00.000Z",
      "rejection_reason": "Scheme needs more details"
    },
    "...": "other scheme fields"
  }
}
```

**Error Responses:**
- `403`: "Only Department Head, Department Secretary, or Super Admin can reject scheme creation"
- `400`: "Scheme is already approved" or "Scheme is already rejected"
- `404`: "Scheme not found"

---

## New Scheme Model Fields

The Scheme model now includes these additional fields:

```typescript
interface Scheme {
  // ... existing fields ...
  
  // NEW FIELDS:
  authorization_levels: number[];  // [1, 2, 4, 5] format
  approval_status: "pending_department_head_approval" | "approved" | "rejected";
  created_by: {
    admin_id: string;
    admin_username: string;
    admin_role: string;
    created_at: Date;
  };
  department_head_approval: {
    approved_by: string | null;
    approved_by_username: string | null;
    approved_at: Date | null;
    rejection_reason: string | null;
  } | null;
}
```

---

## Frontend Implementation Requirements

### 1. Scheme Creation Form

**Required UI Components:**

1. **Category Selection**
   - Fetch categories from `/api/categories/simple`
   - Display as a dropdown
   - Use `category_name` value when creating scheme

2. **Department Selection**
   - Fetch departments from `/api/departments/simple`
   - Display as a dropdown
   - Use `department_display_name` value when creating scheme

3. **Scheme Name**
   - Text input field
   - **Note: Scheme name itself serves as the subcategory** (no separate subcategory field)

4. **Authorization Levels Selector**
   - Create a form section for selecting authorization levels
   - Display as 4 dropdowns or select components
   - Label each dropdown clearly:
     - "First Authorization Level" (Options: Super Admin (1), Admin (2))
     - "Second Authorization Level" (Options: Admin (2), Department Secretary (3))
     - "Third Authorization Level" (Fixed: Department Head (4))
     - "Fourth Authorization Level" (Fixed: DistrictHQ Head (5))
   
   **UI Suggestion:**
   ```
   Scheme Details:
   [Category:     ▼ Education                    ]
   [Department:   ▼ Education Department         ]
   [Scheme Name:  [Student Scholarship          ] ] ← This is the subcategory
   
   Authorization Levels:
   [First Level:  ▼ Super Admin (1) or Admin (2)     ]
   [Second Level: ▼ Admin (2) or Dept Secretary (3)  ]
   [Third Level:  Department Head (4) - Fixed/Read-only]
   [Fourth Level: DistrictHQ Head (5) - Fixed/Read-only]
   ```
   
   Note: Third and fourth levels are fixed values. Display them as read-only fields.
   Note: Department User (6) is view-only and not part of the authorization chain.

2. **Form Validation**
   - Validate that authorization_levels array is exactly 4 elements
   - Validate each level matches the allowed values
   - Show validation errors clearly to the user

3. **Success Message**
   - After successful creation, display: "Scheme created successfully. Pending Department Head approval."
   - Show the scheme with `approval_status: "pending_department_head_approval"`

### 2. Scheme List/Display

**Updates Needed:**

1. **Display Approval Status**
   - Show approval status badge/indicator for each scheme
   - Color coding suggestions:
     - `pending_department_head_approval`: Yellow/Orange badge
     - `approved`: Green badge
     - `rejected`: Red badge

2. **Display Creator Information**
   - Show who created the scheme (`created_by.admin_username`)
   - Show creation date
   - Only show this for admin users (not public users)

3. **Display Authorization Levels**
   - Show the authorization levels in a readable format
   - Example: "Authorization Levels: Super Admin/Admin → Admin/Dept Secretary → Department Head → DistrictHQ Head"

4. **Filter Schemes by Approval Status**
   - Add filter options for admin users:
     - All Schemes
     - Pending Approval
     - Approved Schemes
     - Rejected Schemes

### 3. Scheme Approval Interface

**Required UI Components:**

1. **Pending Schemes List**
   - Create a page/section for Department Head, Department Secretary, and Super Admin users
   - Show all schemes with `approval_status: "pending_department_head_approval"`
   - Display scheme details including:
     - Scheme name
     - Creator information
     - Authorization levels
     - Creation date

2. **Approve/Reject Actions**
   - For each pending scheme, show "Approve" and "Reject" buttons
   - Reject button should open a modal/dialog to enter rejection reason
   - Approve button can be a direct action (with confirmation)

3. **Approval Status Display**
   - For approved/rejected schemes, show:
     - Who approved/rejected (username and role)
     - When it was approved/rejected (timestamp)
     - Rejection reason (if rejected)
   - This information is stored in `department_head_approval` object:
     - `approved_by_username`: Username of the approver
     - `approved_at`: Timestamp when approved/rejected
     - `rejection_reason`: Reason if rejected

### 4. Role-Based Access Control

**UI Visibility Rules:**

1. **Scheme Creation**
   - Show "Create Scheme" button to authenticated admin users
   - All admin users can create schemes

2. **Approval Actions**
   - Show "Approve" and "Reject" buttons only to:
     - Department Head (role: "Department Head")
     - Department Secretary (role: "Department Secretary")
     - Super Admin (role: "Super Admin")
   - Hide these buttons for other roles

3. **Scheme Visibility**
   - Public users: Only show schemes with `approval_status: "approved"`
   - Admin users: Show all schemes (pending, approved, rejected)
   - Filter pending/rejected schemes from public view

---

## Example Frontend Code Structure

### TypeScript/Type Definitions

```typescript
// Scheme type
interface Scheme {
  _id: string;
  scheme_name: string;
  // ... existing fields ...
  authorization_levels: number[];
  approval_status: "pending_department_head_approval" | "approved" | "rejected";
  created_by: {
    admin_id: string;
    admin_username: string;
    admin_role: string;
    created_at: string;
  };
  department_head_approval: {
    approved_by: string | null;
    approved_by_username: string | null;
    approved_at: string | null;
    rejection_reason: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

// Category and Department types
interface Category {
  name: string;
  displayName: string;
}

interface Department {
  name: string;
  displayName: string;
}

// Authorization level options
const AUTHORIZATION_LEVEL_OPTIONS = {
  first: [
    { value: 1, label: "Super Admin (1)" },
    { value: 2, label: "Admin (2)" }
  ],
  second: [
    { value: 2, label: "Admin (2)" },
    { value: 3, label: "Department Secretary (3)" }
  ],
  third: { value: 4, label: "Department Head (4)" }, // Fixed
  fourth: { value: 5, label: "DistrictHQ Head (5)" } // Fixed
};

// Role level mapping for display (Lower number = Higher authority)
const ROLE_LEVEL_NAMES: Record<number, string> = {
  1: "Super Admin",
  2: "Admin",
  3: "Department Secretary",
  4: "Department Head",
  5: "DistrictHQ Head",
  6: "Department User", // View-only, not part of authorization chain
  7: "District Overlookers",
  8: "Post Operator"
};
```

### API Service Functions

```typescript
// Create scheme
async function createScheme(schemeData: Partial<Scheme>, authHeaders: AuthHeaders): Promise<Scheme> {
  const response = await fetch('/api/schemes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-username': authHeaders.username,
      'x-admin-password': authHeaders.password
    },
    body: JSON.stringify({
      ...schemeData,
      scheme_name: schemeData.scheme_name, // This serves as the subcategory
      category: schemeData.category, // category_name
      department: schemeData.department, // department_display_name
      authorization_levels: [1, 2, 4, 5] // Or get from form (first, second, third, fourth)
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create scheme');
  }
  
  const data = await response.json();
  return data.scheme;
}

// Approve scheme
async function approveScheme(schemeId: string, authHeaders: AuthHeaders): Promise<Scheme> {
  const response = await fetch(`/api/schemes/${schemeId}/approve`, {
    method: 'PUT',
    headers: {
      'x-admin-username': authHeaders.username,
      'x-admin-password': authHeaders.password
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to approve scheme');
  }
  
  const data = await response.json();
  return data.scheme;
}

// Reject scheme
async function rejectScheme(
  schemeId: string, 
  rejectionReason: string, 
  authHeaders: AuthHeaders
): Promise<Scheme> {
  const response = await fetch(`/api/schemes/${schemeId}/reject`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-username': authHeaders.username,
      'x-admin-password': authHeaders.password
    },
    body: JSON.stringify({ rejection_reason: rejectionReason })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to reject scheme');
  }
  
  const data = await response.json();
  return data.scheme;
}
```

---

## Testing Checklist

- [ ] Create scheme with valid authorization levels
- [ ] Create scheme with invalid authorization levels (should show validation errors)
- [ ] Display approval status in scheme list
- [ ] Filter schemes by approval status (for admin users)
- [ ] Hide pending/rejected schemes from public users
- [ ] Show approve/reject buttons only to Department Head, Department Secretary, and Super Admin
- [ ] Approve a pending scheme (Department Head/Department Secretary/Super Admin only)
- [ ] Reject a pending scheme with reason (Department Head/Department Secretary/Super Admin only)
- [ ] Prevent approving/rejecting already approved/rejected schemes
- [ ] Display creator information for admin users
- [ ] Display approval/rejection details (who, when, reason)

---

## Migration Notes

**Existing Schemes:**
- Existing schemes in the database may not have the new fields (`authorization_levels`, `approval_status`, `created_by`, `department_head_approval`)
- Frontend should handle missing fields gracefully:
  - Show `approval_status` as "approved" if missing (assume legacy schemes are approved)
  - Show empty or default values for missing `authorization_levels`
  - Handle null `created_by` and `department_head_approval` fields

**Backward Compatibility:**
- The GET `/api/schemes` endpoint still works as before
- Old schemes without new fields will still be returned
- Frontend should validate fields exist before displaying them

---

## Questions or Issues?

If you encounter any issues or need clarification on the implementation, please refer to:
- `SCHEME_STRUCTURE.md` - Scheme model structure
- `ADMIN_ROLES_ENUM.md` - Admin roles and levels
- API documentation in the codebase
