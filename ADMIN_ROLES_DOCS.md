# Admin Roles Documentation

## Role Hierarchy

Admin users have a hierarchical role system with 8 levels (from low to high):

1. **Post Operator** (Level 1)
2. **District Overlookers** (Level 2)
3. **DistrictHQ Head** (Level 3)
4. **Department User** (Level 4)
5. **Department Head** (Level 5)
6. **Department Secretary** (Level 6)
7. **Admin** (Level 7)
8. **Super Admin** (Level 8)

## AdminUser Model

### Fields

- `fullName` (String, required) - Full name of admin
- `username` (String, required, unique) - Username for login
- `contactNumber` (String, required) - Contact number
- `password` (String, required) - Password (should be hashed in production)
- `role` (String, required) - One of the 8 roles listed above (default: "Post Operator")
- `isActive` (Boolean) - Whether the admin account is active (default: true)
- `createdAt` (Date) - Auto-generated timestamp
- `updatedAt` (Date) - Auto-generated timestamp

### Methods

#### Instance Methods

- `hasRoleLevel(requiredRole)` - Returns true if user's role level is >= required role level

#### Static Methods

- `getRoleLevel(role)` - Returns the level number for a given role

### Constants

- `AdminUser.ROLES` - Object containing all role names
- `AdminUser.ROLE_LEVELS` - Object mapping roles to their level numbers

## Authentication

### Admin Login Response

When an admin logs in via `/api/admin-login`, the response includes:

```json
{
  "status": "success",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "fullName": "John Doe",
    "username": "johndoe",
    "contactNumber": "9876543210",
    "role": "Department Head",
    "roleLevel": 5
  }
}
```

## Authorization Middleware

### Basic Authentication

Use `adminAuth` middleware to require admin authentication:

```javascript
const adminAuth = require("../middleware/adminAuth");

router.get("/protected-route", adminAuth, (req, res) => {
  // req.admin contains:
  // {
  //   _id: "...",
  //   username: "...",
  //   fullName: "...",
  //   role: "Department Head",
  //   roleLevel: 5
  // }
});
```

### Role-Based Authorization

Use `requireRole` middleware to restrict access to specific roles:

```javascript
const requireRole = require("../middleware/requireRole");
const AdminUser = require("../models/AdminUser");

// Require specific role(s)
router.get("/admin-only", 
  adminAuth, 
  requireRole(AdminUser.ROLES.ADMIN), 
  (req, res) => {
    // Only Admin or Super Admin can access
  }
);

// Require one of multiple roles
router.get("/department-access", 
  adminAuth, 
  requireRole([
    AdminUser.ROLES.DEPARTMENT_USER,
    AdminUser.ROLES.DEPARTMENT_HEAD,
    AdminUser.ROLES.DEPARTMENT_SECRETARY
  ]), 
  (req, res) => {
    // Department users, heads, or secretaries can access
  }
);
```

### Minimum Role Level

Use `requireMinimumRole` to allow any role at or above a certain level:

```javascript
const { requireMinimumRole } = require("../middleware/requireRole");

// Require Department Head or higher
router.get("/high-level", 
  adminAuth, 
  requireMinimumRole(AdminUser.ROLES.DEPARTMENT_HEAD), 
  (req, res) => {
    // Department Head, Department Secretary, Admin, or Super Admin can access
  }
);
```

## Usage Examples

### Example 1: Dashboard Statistics (All Admins)

```javascript
router.get("/dashboard/statistics", adminAuth, async (req, res) => {
  // Any authenticated admin can access
});
```

### Example 2: Manage Users (Department Head or Higher)

```javascript
router.post("/users/create", 
  adminAuth, 
  requireMinimumRole(AdminUser.ROLES.DEPARTMENT_HEAD),
  async (req, res) => {
    // Only Department Head, Department Secretary, Admin, or Super Admin
  }
);
```

### Example 3: System Settings (Super Admin Only)

```javascript
router.put("/system/settings", 
  adminAuth, 
  requireRole(AdminUser.ROLES.SUPER_ADMIN),
  async (req, res) => {
    // Only Super Admin can access
  }
);
```

### Example 4: District Operations (District Roles Only)

```javascript
router.get("/district/reports", 
  adminAuth, 
  requireRole([
    AdminUser.ROLES.DISTRICT_OVERLOOKERS,
    AdminUser.ROLES.DISTRICTHQ_HEAD
  ]),
  async (req, res) => {
    // Only District Overlookers or DistrictHQ Head can access
  }
);
```

## Role Level Comparison

Higher level roles automatically have access to lower level permissions:

- **Super Admin (8)** - Has access to everything
- **Admin (7)** - Has access to Admin and below
- **Department Secretary (6)** - Has access to Department Secretary and below
- **Department Head (5)** - Has access to Department Head and below
- **Department User (4)** - Has access to Department User and below
- **DistrictHQ Head (3)** - Has access to DistrictHQ Head and below
- **District Overlookers (2)** - Has access to District Overlookers and below
- **Post Operator (1)** - Lowest level, only has access to Post Operator level

## Error Responses

### 401 Unauthorized
```json
{
  "status": "error",
  "message": "Admin authentication required"
}
```

### 403 Forbidden (Insufficient Role)
```json
{
  "status": "error",
  "message": "Access denied. Required role: Admin",
  "userRole": "Department User",
  "requiredRoles": ["Admin"]
}
```

### 403 Forbidden (Inactive Account)
```json
{
  "status": "error",
  "message": "Admin account is inactive"
}
```

## Best Practices

1. **Always use `adminAuth` first** - This ensures the user is authenticated
2. **Use `requireMinimumRole` for hierarchical access** - Allows higher roles automatically
3. **Use `requireRole` for specific role requirements** - When you need exact roles
4. **Check `isActive` status** - The middleware automatically checks this
5. **Hash passwords in production** - Current implementation stores plain text (for development only)

## Migration Notes

If you have existing admin users without roles:

1. They will default to "Post Operator" role
2. Update existing users to assign appropriate roles:
   ```javascript
   await AdminUser.updateMany(
     { role: { $exists: false } },
     { $set: { role: AdminUser.ROLES.POST_OPERATOR } }
   );
   ```

