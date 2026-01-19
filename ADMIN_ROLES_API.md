# Admin Roles API - Frontend Guide

## Overview

API endpoints for fetching admin roles and their hierarchy levels. Useful for populating authorization level dropdowns in scheme creation forms.

---

## Endpoints

### 1. GET /api/admin-roles

**Get all admin roles with their levels**

**Authentication:** Not required

**Response:**
```json
{
  "status": "success",
  "roles": [
    {
      "role": "Super Admin",
      "level": 1,
      "displayName": "Super Admin"
    },
    {
      "role": "Admin",
      "level": 2,
      "displayName": "Admin"
    },
    {
      "role": "Department Secretary",
      "level": 3,
      "displayName": "Department Secretary"
    },
    {
      "role": "Department Head",
      "level": 4,
      "displayName": "Department Head"
    },
    {
      "role": "DistrictHQ Head",
      "level": 5,
      "displayName": "DistrictHQ Head"
    },
    {
      "role": "Department User",
      "level": 6,
      "displayName": "Department User"
    },
    {
      "role": "District Overlookers",
      "level": 7,
      "displayName": "District Overlookers"
    },
    {
      "role": "Post Operator",
      "level": 8,
      "displayName": "Post Operator"
    }
  ],
  "roleLevels": {
    "Super Admin": 1,
    "Admin": 2,
    "Department Secretary": 3,
    "Department Head": 4,
    "DistrictHQ Head": 5,
    "Department User": 6,
    "District Overlookers": 7,
    "Post Operator": 8
  },
  "adminRoles": {
    "POST_OPERATOR": "Post Operator",
    "DISTRICT_OVERLOOKERS": "District Overlookers",
    "DISTRICTHQ_HEAD": "DistrictHQ Head",
    "DEPARTMENT_USER": "Department User",
    "DEPARTMENT_HEAD": "Department Head",
    "DEPARTMENT_SECRETARY": "Department Secretary",
    "ADMIN": "Admin",
    "SUPER_ADMIN": "Super Admin"
  },
  "count": 8
}
```

**Note:** Roles are sorted by level (ascending). Lower level number = higher authority.

---

### 2. GET /api/admin-roles/hierarchy

**Get role hierarchy with grouped levels**

**Authentication:** Not required

**Response:**
```json
{
  "status": "success",
  "hierarchy": [
    {
      "role": "Super Admin",
      "level": 1,
      "displayName": "Super Admin",
      "isHigherAuthority": true
    },
    {
      "role": "Admin",
      "level": 2,
      "displayName": "Admin",
      "isHigherAuthority": true
    },
    {
      "role": "Department Secretary",
      "level": 3,
      "displayName": "Department Secretary",
      "isHigherAuthority": true
    },
    {
      "role": "Department Head",
      "level": 4,
      "displayName": "Department Head",
      "isHigherAuthority": true
    },
    {
      "role": "DistrictHQ Head",
      "level": 5,
      "displayName": "DistrictHQ Head",
      "isHigherAuthority": false
    },
    {
      "role": "Department User",
      "level": 6,
      "displayName": "Department User",
      "isHigherAuthority": false
    },
    {
      "role": "District Overlookers",
      "level": 7,
      "displayName": "District Overlookers",
      "isHigherAuthority": false
    },
    {
      "role": "Post Operator",
      "level": 8,
      "displayName": "Post Operator",
      "isHigherAuthority": false
    }
  ],
  "grouped": {
    "highest": [
      { "role": "Super Admin", "level": 1 },
      { "role": "Admin", "level": 2 }
    ],
    "high": [
      { "role": "Department Secretary", "level": 3 },
      { "role": "Department Head", "level": 4 }
    ],
    "medium": [
      { "role": "DistrictHQ Head", "level": 5 }
    ],
    "standard": [
      { "role": "Department User", "level": 6 },
      { "role": "District Overlookers", "level": 7 },
      { "role": "Post Operator", "level": 8 }
    ]
  },
  "roleLevels": { /* same as above */ },
  "count": 8
}
```

---

### 3. GET /api/admin-roles/for-authorization

**Get roles suitable for scheme authorization levels**

**Authentication:** Not required

**Response:**
```json
{
  "status": "success",
  "roles": [
    {
      "role": "Super Admin",
      "level": 1,
      "displayName": "Super Admin"
    },
    {
      "role": "Admin",
      "level": 2,
      "displayName": "Admin"
    },
    // ... all 8 roles
  ],
  "note": "These roles can be used in scheme authorization_levels array (max 4 levels)",
  "count": 8
}
```

**Use Case:** Use this endpoint to populate authorization level dropdowns in scheme creation forms.

---

## Frontend Usage Examples

### React Example - Fetching Roles for Dropdown

```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

function SchemeForm() {
  const [roles, setRoles] = useState([]);
  const [selectedLevels, setSelectedLevels] = useState([]);

  useEffect(() => {
    // Fetch roles for authorization levels
    axios.get('/api/admin-roles/for-authorization')
      .then(response => {
        setRoles(response.data.roles);
      })
      .catch(error => {
        console.error('Error fetching roles:', error);
      });
  }, []);

  const handleLevelChange = (index, level) => {
    const newLevels = [...selectedLevels];
    newLevels[index] = level;
    setSelectedLevels(newLevels);
  };

  return (
    <form>
      {/* Authorization Level 1 */}
      <select 
        value={selectedLevels[0] || ''} 
        onChange={(e) => handleLevelChange(0, Number(e.target.value))}
      >
        <option value="">Select Level 1</option>
        {roles.map(role => (
          <option key={role.level} value={role.level}>
            {role.displayName} (Level {role.level})
          </option>
        ))}
      </select>

      {/* Authorization Level 2 */}
      <select 
        value={selectedLevels[1] || ''} 
        onChange={(e) => handleLevelChange(1, Number(e.target.value))}
      >
        <option value="">Select Level 2</option>
        {roles.map(role => (
          <option key={role.level} value={role.level}>
            {role.displayName} (Level {role.level})
          </option>
        ))}
      </select>

      {/* ... up to 4 levels */}
    </form>
  );
}
```

### Using with Scheme Creation

```javascript
// Fetch roles
const rolesResponse = await fetch('/api/admin-roles/for-authorization');
const { roles } = await rolesResponse.json();

// User selects authorization levels (e.g., [1, 2, 4, 5])
const authorizationLevels = [1, 2, 4, 5]; // Selected level numbers

// Create scheme with authorization levels
const schemeData = {
  scheme_name: "My Scheme",
  // ... other fields
  authorization_levels: authorizationLevels, // Array of level numbers (max 4)
};
```

---

## Role Hierarchy

**Level 1 (Highest Authority):**
- Super Admin

**Level 2:**
- Admin

**Level 3:**
- Department Secretary

**Level 4:**
- Department Head

**Level 5:**
- Department User

**Level 6:**
- DistrictHQ Head

**Level 7:**
- District Overlookers

**Level 8 (Lowest Authority):**
- Post Operator

**Note:** Lower level number = Higher authority level

---

## Integration with Scheme Creation

When creating a scheme, the `authorization_levels` field accepts an array of level numbers:

```javascript
{
  // ... other scheme fields
  "authorization_levels": [1, 2, 4, 5]  // Max 4 levels
}
```

**Examples:**
- `[1, 2, 4, 5]` - Super Admin, Admin, Department Head, DistrictHQ Head
- `[3, 4]` - Department Secretary, Department Head
- `[7, 8]` - District Overlookers, Post Operator

---

## TypeScript Types

```typescript
interface AdminRole {
  role: string;
  level: number;
  displayName: string;
}

interface AdminRolesResponse {
  status: "success";
  roles: AdminRole[];
  roleLevels: Record<string, number>;
  adminRoles: Record<string, string>;
  count: number;
}

interface HierarchyResponse {
  status: "success";
  hierarchy: Array<AdminRole & { isHigherAuthority: boolean }>;
  grouped: {
    highest: AdminRole[];
    high: AdminRole[];
    medium: AdminRole[];
    standard: AdminRole[];
  };
  roleLevels: Record<string, number>;
  count: number;
}
```

---

## Error Responses

### 500 - Server Error

```json
{
  "status": "error",
  "error": "Failed to fetch admin roles",
  "message": "Error details"
}
```

---

## Quick Reference

| Endpoint | Description | Use Case |
|----------|-------------|----------|
| `GET /api/admin-roles` | Get all roles with levels | Display full role list |
| `GET /api/admin-roles/hierarchy` | Get grouped hierarchy | Display role hierarchy UI |
| `GET /api/admin-roles/for-authorization` | Get roles for auth levels | Populate authorization dropdowns |

---

## Notes

- All endpoints are public (no authentication required)
- Roles are always sorted by level (ascending)
- Maximum 4 authorization levels can be selected per scheme
- Level numbers are used in `authorization_levels` array (not role names)
