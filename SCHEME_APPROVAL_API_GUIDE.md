# Scheme Approval API Guide - Frontend Documentation

## Overview

The `GET /api/schemes` endpoint has been updated to support filtering schemes for **admin approval workflows**. This feature is specifically designed for admin users (Department Head, Department Secretary, and Super Admin) who need to view and approve schemes.

---

## Target Audience

**Admin Users Only:**
- Department Head (Level 4)
- Department Secretary (Level 3)
- Super Admin (Level 1)

---

## New Query Parameters

### `filter_type`

**Type:** `string`  
**Values:** `"scheme"` | `"applicant"`  
**Default:** `"applicant"` if `user_id` is provided, otherwise `"scheme"`

Determines which type of filtering to apply:
- `"scheme"`: Scheme-level filters (approval status)
- `"applicant"`: Applicant-level filters (excluded schemes based on user)

### `pending_approval`

**Type:** `boolean` (string: `"true"` or `"1"`)  
**Filter Type:** `"scheme"`  
**Description:** Returns schemes that are **pending approval** AND **already approved**

When `pending_approval=true`, the API returns schemes with:
- `approval_status: "pending_department_head_approval"` (pending)
- `approval_status: "approved"` (already approved)

**Use Case:** Admin dashboard to show all schemes that need approval or have been approved (excludes rejected schemes).

### `approved_only`

**Type:** `boolean` (string: `"true"` or `"1"`)  
**Filter Type:** `"scheme"`  
**Description:** Returns only approved schemes

**Use Case:** Show only active/approved schemes.

---

## API Endpoint

### GET /api/schemes

**Authentication:** Not required for public schemes, Admin auth required for approval workflows

**Query Parameters:**

| Parameter | Type | Filter Type | Description |
|-----------|------|-------------|-------------|
| `filter_type` | `string` | Both | `"scheme"` or `"applicant"` |
| `pending_approval` | `boolean` | `scheme` | Return pending + approved schemes |
| `approved_only` | `boolean` | `scheme` | Return only approved schemes |
| `user_id` | `string` | `applicant` | Filter based on excluded schemes |

---

## Usage Examples

### 1. Fetch Schemes for Approval (Admin Dashboard)

**Use Case:** Show all schemes that need approval OR have been approved (for admin review/approval interface)

```javascript
// Fetch schemes pending approval and already approved
const response = await fetch('/api/schemes?pending_approval=true&filter_type=scheme');
const schemes = await response.json();

// schemes will include:
// - Schemes with approval_status: "pending_department_head_approval"
// - Schemes with approval_status: "approved"
// - Excludes: Schemes with approval_status: "rejected"
```

**Response Structure:**
```json
[
  {
    "_id": "scheme_id_1",
    "scheme_name": "Student Scholarship",
    "approval_status": "pending_department_head_approval",
    "created_by": {
      "admin_id": "...",
      "admin_username": "john.doe",
      "admin_role": "Department User",
      "created_at": "2025-01-15T10:30:00.000Z"
    },
    "department_head_approval": null,
    ...
  },
  {
    "_id": "scheme_id_2",
    "scheme_name": "Women Empowerment Scheme",
    "approval_status": "approved",
    "created_by": {
      "admin_id": "...",
      "admin_username": "jane.smith",
      "admin_role": "Department User",
      "created_at": "2025-01-14T09:00:00.000Z"
    },
    "department_head_approval": {
      "approved_by": "...",
      "approved_by_username": "admin.user",
      "approved_at": "2025-01-14T10:00:00.000Z"
    },
    ...
  }
]
```

### 2. Fetch Only Approved Schemes

```javascript
// Fetch only approved schemes
const response = await fetch('/api/schemes?approved_only=true&filter_type=scheme');
const approvedSchemes = await response.json();
```

### 3. Fetch All Schemes (No Filter)

```javascript
// Fetch all schemes (any approval status)
const response = await fetch('/api/schemes?filter_type=scheme');
const allSchemes = await response.json();
```

### 4. Fetch Schemes for Public Users (Applicant Filter)

```javascript
// Fetch schemes filtered for applicants (existing behavior)
const response = await fetch('/api/schemes?user_id=user123&filter_type=applicant');
const userSchemes = await response.json();
```

---

## Frontend Implementation

### React Example: Admin Scheme Approval Dashboard

```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';

interface Scheme {
  _id: string;
  scheme_name: string;
  approval_status: 'pending_department_head_approval' | 'approved' | 'rejected';
  created_by: {
    admin_id: string;
    admin_username: string;
    admin_role: string;
    created_at: string;
  };
  department_head_approval: {
    approved_by: string;
    approved_by_username: string;
    approved_at: string;
    rejection_reason?: string;
  } | null;
  // ... other scheme fields
}

const SchemeApprovalDashboard = () => {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');

  useEffect(() => {
    fetchSchemesForApproval();
  }, [filter]);

  const fetchSchemesForApproval = async () => {
    try {
      setLoading(true);
      
      let url = '/api/schemes?filter_type=scheme';
      
      if (filter === 'pending') {
        // Fetch schemes pending approval AND approved (for review)
        url += '&pending_approval=true';
      } else if (filter === 'approved') {
        // Fetch only approved schemes
        url += '&approved_only=true';
      }
      // else: fetch all schemes (no filter)
      
      const response = await axios.get(url);
      setSchemes(response.data);
    } catch (error) {
      console.error('Error fetching schemes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_department_head_approval':
        return <span className="badge badge-warning">Pending Approval</span>;
      case 'approved':
        return <span className="badge badge-success">Approved</span>;
      case 'rejected':
        return <span className="badge badge-danger">Rejected</span>;
      default:
        return <span className="badge badge-secondary">{status}</span>;
    }
  };

  if (loading) {
    return <div>Loading schemes...</div>;
  }

  return (
    <div>
      <h1>Scheme Approval Dashboard</h1>
      
      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button 
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'active' : ''}
        >
          All Schemes
        </button>
        <button 
          onClick={() => setFilter('pending')}
          className={filter === 'pending' ? 'active' : ''}
        >
          Pending + Approved
        </button>
        <button 
          onClick={() => setFilter('approved')}
          className={filter === 'approved' ? 'active' : ''}
        >
          Approved Only
        </button>
      </div>

      {/* Schemes List */}
      <div className="schemes-list">
        {schemes.map((scheme) => (
          <div key={scheme._id} className="scheme-card">
            <h3>{scheme.scheme_name}</h3>
            {getStatusBadge(scheme.approval_status)}
            
            <div className="scheme-meta">
              <p>
                <strong>Created by:</strong> {scheme.created_by.admin_username} 
                ({scheme.created_by.admin_role})
              </p>
              <p>
                <strong>Created at:</strong> {new Date(scheme.created_by.created_at).toLocaleString()}
              </p>
              
              {scheme.department_head_approval && (
                <p>
                  <strong>Approved by:</strong> {scheme.department_head_approval.approved_by_username}
                  <br />
                  <strong>Approved at:</strong> {new Date(scheme.department_head_approval.approved_at).toLocaleString()}
                </p>
              )}
            </div>

            {/* Approve/Reject buttons (only show for pending schemes) */}
            {scheme.approval_status === 'pending_department_head_approval' && (
              <div className="action-buttons">
                <button onClick={() => handleApprove(scheme._id)}>
                  Approve
                </button>
                <button onClick={() => handleReject(scheme._id)}>
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SchemeApprovalDashboard;
```

### TypeScript Types

```typescript
// Scheme approval status types
type ApprovalStatus = 'pending_department_head_approval' | 'approved' | 'rejected';

// Filter type for schemes API
type FilterType = 'scheme' | 'applicant';

// API query parameters
interface SchemeQueryParams {
  filter_type?: FilterType;
  pending_approval?: boolean | string;
  approved_only?: boolean | string;
  user_id?: string;
}
```

---

## Important Notes

### 1. Filter Type Behavior

- **`filter_type="scheme"`**: Scheme-level filters apply (`pending_approval`, `approved_only`)
- **`filter_type="applicant"`**: Applicant-level filters apply (`user_id` for excluded schemes)
- If `filter_type` is not specified:
  - Defaults to `"applicant"` if `user_id` is provided
  - Defaults to `"scheme"` if `user_id` is not provided

### 2. `pending_approval` Returns Both Statuses

When `pending_approval=true`, the API returns:
- ✅ Schemes with `approval_status: "pending_department_head_approval"`
- ✅ Schemes with `approval_status: "approved"`
- ❌ Excludes schemes with `approval_status: "rejected"`

This is intentional - it shows all schemes that need approval OR have been approved (useful for admin review interface).

### 3. Cannot Combine `approved_only` and `pending_approval`

If both `approved_only=true` and `pending_approval=true` are provided:
- Both filters apply (same result as `pending_approval=true` alone)
- Returns: pending + approved schemes

### 4. Authentication

- **Public schemes:** No authentication required
- **Admin approval workflows:** Admin authentication headers required (for approve/reject actions)

---

## Migration Checklist

If you're updating existing frontend code:

- [ ] Update scheme fetching logic to use `filter_type` parameter
- [ ] Add `pending_approval` filter for admin approval dashboard
- [ ] Update TypeScript types to include new query parameters
- [ ] Test filter combinations (`pending_approval`, `approved_only`)
- [ ] Update admin dashboard UI to show approval status badges
- [ ] Handle approval/rejection UI for pending schemes
- [ ] Display creator and approval information in scheme cards

---

---

## Approve/Reject Endpoints

### PUT /api/schemes/:id/approve

**Authentication:** Required (Admin auth headers)  
**Authorization:** Department Head, Department Secretary, or Super Admin only

**Headers:**
```
x-admin-username: <admin_username>
x-admin-password: <admin_password>
```

**URL Parameters:**
- `id`: Scheme ID

**Request Body:** (empty)

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Scheme approved successfully",
  "scheme": {
    "_id": "...",
    "scheme_name": "Student Scholarship",
    "approval_status": "approved",
    "department_head_approval": {
      "approved_by": "admin_id",
      "approved_by_username": "admin.user",
      "approved_at": "2025-01-15T10:30:00.000Z",
      "rejection_reason": null
    },
    ...
  }
}
```

**Error Responses:**
- `404`: Scheme not found
- `400`: Scheme already approved/rejected
- `403`: Access denied (not authorized)
- `401`: Authentication required

### PUT /api/schemes/:id/reject

**Authentication:** Required (Admin auth headers)  
**Authorization:** Department Head, Department Secretary, or Super Admin only

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
  "rejection_reason": "Optional rejection reason"
}
```

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Scheme rejected successfully",
  "scheme": {
    "_id": "...",
    "scheme_name": "Student Scholarship",
    "approval_status": "rejected",
    "department_head_approval": {
      "approved_by": "admin_id",
      "approved_by_username": "admin.user",
      "approved_at": "2025-01-15T10:30:00.000Z",
      "rejection_reason": "Optional rejection reason"
    },
    ...
  }
}
```

**Error Responses:**
- `404`: Scheme not found
- `400`: Scheme already rejected/approved
- `403`: Access denied (not authorized)
- `401`: Authentication required

### Frontend Implementation Example

```typescript
// Approve scheme
const approveScheme = async (schemeId: string) => {
  try {
    const response = await axios.put(
      `/api/schemes/${schemeId}/approve`,
      {},
      {
        headers: {
          'x-admin-username': adminUsername,
          'x-admin-password': adminPassword,
        },
      }
    );
    
    console.log('Scheme approved:', response.data);
    // Refresh schemes list
    fetchSchemesForApproval();
  } catch (error) {
    console.error('Error approving scheme:', error);
    // Handle error (show notification, etc.)
  }
};

// Reject scheme
const rejectScheme = async (schemeId: string, rejectionReason?: string) => {
  try {
    const response = await axios.put(
      `/api/schemes/${schemeId}/reject`,
      {
        rejection_reason: rejectionReason || 'Rejected by admin',
      },
      {
        headers: {
          'x-admin-username': adminUsername,
          'x-admin-password': adminPassword,
        },
      }
    );
    
    console.log('Scheme rejected:', response.data);
    // Refresh schemes list
    fetchSchemesForApproval();
  } catch (error) {
    console.error('Error rejecting scheme:', error);
    // Handle error (show notification, etc.)
  }
};
```

---

## Related Documentation

- `SCHEME_CREATION_FRONTEND_GUIDE.md` - Scheme creation with authorization levels
- `COMPLETE_FRONTEND_API_CHANGES.md` - Complete API changes reference
- `FRONTEND_QUICK_REFERENCE.md` - Quick API reference
- `ADMIN_ROLES_API.md` - Admin roles and authorization levels

---

## Questions?

If you have questions or need clarification:
1. Check the related documentation files listed above
2. Review the API endpoint code in `routes/schemes.js`
3. Test the API endpoints directly (e.g., using Postman or curl)
