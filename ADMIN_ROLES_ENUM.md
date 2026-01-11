# Admin Roles Enum and Hierarchy

## Role Enum Structure

The admin roles are defined as an enum with associated hierarchy levels (integers):

```javascript
const ADMIN_ROLES = {
  POST_OPERATOR: 'Post Operator',           // Level: 1
  DISTRICT_OVERLOOKERS: 'District Overlookers', // Level: 2
  DISTRICTHQ_HEAD: 'DistrictHQ Head',       // Level: 3
  DEPARTMENT_USER: 'Department User',       // Level: 4
  DEPARTMENT_HEAD: 'Department Head',        // Level: 5
  DEPARTMENT_SECRETARY: 'Department Secretary', // Level: 6
  ADMIN: 'Admin',                           // Level: 7
  SUPER_ADMIN: 'Super Admin'                // Level: 8
};

const ROLE_LEVELS = {
  'Post Operator': 1,
  'District Overlookers': 2,
  'DistrictHQ Head': 3,
  'Department User': 4,
  'Department Head': 5,
  'Department Secretary': 6,
  'Admin': 7,
  'Super Admin': 8
};
```

## Role Hierarchy (Low to High)

| Level | Role Name | Description |
|-------|-----------|-------------|
| 1 | Post Operator | Lowest level admin |
| 2 | District Overlookers | District-level oversight |
| 3 | DistrictHQ Head | District headquarters head |
| 4 | Department User | Department-level user |
| 5 | Department Head | Department head |
| 6 | Department Secretary | Department secretary |
| 7 | Admin | System admin |
| 8 | Super Admin | Highest level admin |

## API Endpoints Returning Role and RoleLevel

### 1. Admin Login
**Endpoint:** `POST /api/admin-login`

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
    "roleLevel": 8
  }
}
```

### 2. Get Admin Profile (Current User)
**Endpoint:** `GET /api/admin/profile`

**Headers:**
```
x-admin-username: admin_username
x-admin-password: admin_password
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
    "roleLevel": 8,
    "isActive": true,
    "createdAt": "2025-12-15T14:17:37.673Z",
    "updatedAt": "2025-12-15T14:17:37.673Z"
  }
}
```

### 3. Get Admin Profile by ID
**Endpoint:** `GET /api/admin/profile/:admin_id`

**Response:** Same format as above

### 4. Get Admin Profile by Query Param
**Endpoint:** `GET /api/admin/profile?admin_id=69401881069f98a284aaacbd`

**Response:** Same format as above

### 5. Get All Roles List
**Endpoint:** `GET /api/admin/profile/roles/list`

**Response:**
```json
{
  "status": "success",
  "roles": [
    {
      "key": "POST_OPERATOR",
      "name": "Post Operator",
      "level": 1
    },
    {
      "key": "DISTRICT_OVERLOOKERS",
      "name": "District Overlookers",
      "level": 2
    },
    {
      "key": "DISTRICTHQ_HEAD",
      "name": "DistrictHQ Head",
      "level": 3
    },
    {
      "key": "DEPARTMENT_USER",
      "name": "Department User",
      "level": 4
    },
    {
      "key": "DEPARTMENT_HEAD",
      "name": "Department Head",
      "level": 5
    },
    {
      "key": "DEPARTMENT_SECRETARY",
      "name": "Department Secretary",
      "level": 6
    },
    {
      "key": "ADMIN",
      "name": "Admin",
      "level": 7
    },
    {
      "key": "SUPER_ADMIN",
      "name": "Super Admin",
      "level": 8
    }
  ]
}
```

## Accessing Roles in Code

### In Node.js/Backend

```javascript
const AdminUser = require('./models/AdminUser');

// Access role constants
console.log(AdminUser.ROLES.SUPER_ADMIN); // "Super Admin"
console.log(AdminUser.ROLES.DEPARTMENT_HEAD); // "Department Head"

// Access role levels
console.log(AdminUser.ROLE_LEVELS['Super Admin']); // 8
console.log(AdminUser.ROLE_LEVELS['Department Head']); // 5

// Get role level for a role
const level = AdminUser.getRoleLevel('Super Admin'); // 8

// Check if user has required role level
const user = await AdminUser.findById(userId);
const hasAccess = user.hasRoleLevel(AdminUser.ROLES.DEPARTMENT_HEAD); // true if user level >= 5
```

## Response Format Consistency

All admin profile APIs return the same format:

```json
{
  "status": "success",
  "user": {
    "_id": "string",
    "fullName": "string",
    "username": "string",
    "contactNumber": "string",
    "role": "string",        // Role name (e.g., "Super Admin")
    "roleLevel": 8,          // Integer level (1-8)
    "isActive": true,        // Boolean
    "createdAt": "ISO Date",
    "updatedAt": "ISO Date"
  }
}
```

## Usage in Frontend

```javascript
// After login
const response = await axios.post('/api/admin-login', { username, password });
const { role, roleLevel } = response.data.user;

// Check if user is Super Admin
if (roleLevel === 8) {
  // Show super admin features
}

// Check if user has minimum Department Head level
if (roleLevel >= 5) {
  // Show department head features
}

// Get all roles
const rolesResponse = await axios.get('/api/admin/profile/roles/list', {
  headers: {
    'x-admin-username': username,
    'x-admin-password': password
  }
});
const roles = rolesResponse.data.roles;
```

