# Frontend API Changes Guide - Categories, Departments, and Schemes

## Overview

New APIs have been added for managing Categories, Departments, and their relationships with Schemes. **Note: Subcategories have been removed - the scheme name itself serves as the subcategory.**

---

## 📁 Categories API

### 1. Get All Categories

**Endpoint:** `GET /api/categories`

**Authentication:** Not required

**Query Parameters:**
- `active_only` (optional): `true` or `1` - Only return active categories

**Response:**
```json
{
  "status": "success",
  "categories": [
    {
      "_id": "...",
      "category_name": "education",
      "category_display_name": "Education",
      "description": "Educational schemes",
      "isActive": true
    }
  ],
  "count": 1
}
```

---

### 2. Get Simple Categories List

**Endpoint:** `GET /api/categories/simple`

**Authentication:** Not required

**Response:**
```json
{
  "status": "success",
  "categories": [
    {
      "name": "education",
      "displayName": "Education"
    }
  ],
  "count": 1
}
```

---

### 3. Get Specific Category

**Endpoint:** `GET /api/categories/:category_name`

**Authentication:** Not required

**Response:**
```json
{
  "status": "success",
  "category": {
    "_id": "...",
    "category_name": "education",
    "category_display_name": "Education",
    "description": "...",
    "isActive": true
  }
}
```

---

### 4. Create Category (Admin Only)

**Endpoint:** `POST /api/categories`

**Authentication:** Required (Admin)

**Headers:**
```
x-admin-username: <admin_username>
x-admin-password: <admin_password>
```

**Request Body:**
```json
{
  "category_name": "education",
  "category_display_name": "Education",
  "description": "Educational schemes"
}
```

**Response (201):**
```json
{
  "status": "success",
  "message": "Category created successfully",
  "category": {...}
}
```

---

## 🏢 Departments API

### 1. Get All Departments

**Endpoint:** `GET /api/departments`

**Authentication:** Not required

**Query Parameters:**
- `active_only` (optional): `true` or `1` - Only return active departments

**Response:**
```json
{
  "status": "success",
  "departments": [
    {
      "_id": "...",
      "department_name": "education_department",
      "department_display_name": "Education Department",
      "description": "Department of Education",
      "contact_info": {
        "email": "education@gov.in",
        "phone": "1234567890",
        "address": "Govt. Building, Sikkim"
      },
      "isActive": true,
      "scheme_count": 15
    }
  ],
  "count": 1
}
```

---

### 2. Get Simple Departments List

**Endpoint:** `GET /api/departments/simple`

**Authentication:** Not required

**Response:**
```json
{
  "status": "success",
  "departments": [
    {
      "name": "education_department",
      "displayName": "Education Department"
    }
  ],
  "count": 1
}
```

---

### 3. Get Specific Department with Schemes

**Endpoint:** `GET /api/departments/:department_name`

**Authentication:** Not required

**Response:**
```json
{
  "status": "success",
  "department": {
    "_id": "...",
    "department_name": "education_department",
    "department_display_name": "Education Department",
    "description": "...",
    "contact_info": {...},
    "schemes": [
      {
        "_id": "...",
        "scheme_name": "Student Scholarship",
        "scheme_description": "...",
        "approval_status": "approved",
        "createdAt": "..."
      }
    ],
    "scheme_count": 15
  }
}
```

---

### 4. Get All Schemes for a Department

**Endpoint:** `GET /api/departments/:department_name/schemes`

**Authentication:** Not required

**Query Parameters:**
- `status` (optional): Filter by approval status (`pending_department_head_approval`, `approved`, `rejected`)
- `approved_only` (optional): `true` or `1` - Only return approved schemes

**Examples:**
```bash
GET /api/departments/education_department/schemes
GET /api/departments/education_department/schemes?approved_only=true
GET /api/departments/education_department/schemes?status=approved
```

**Response:**
```json
{
  "status": "success",
  "department": {
    "name": "Education Department",
    "department_name": "education_department"
  },
  "schemes": [
    {
      "_id": "...",
      "scheme_name": "Student Scholarship",
      "department": "Education Department",
      "category": "Education",
      "approval_status": "approved",
      ...
    }
  ],
  "count": 15
}
```

---

### 5. Create Department (Admin Only)

**Endpoint:** `POST /api/departments`

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "department_name": "education_department",
  "department_display_name": "Education Department",
  "description": "Department responsible for educational schemes",
  "contact_info": {
    "email": "education@gov.in",
    "phone": "1234567890",
    "address": "Govt. Building, Sikkim"
  }
}
```

---

## 🔗 Scheme-Department Relationship

### Understanding the Link

- Schemes have a `department` field (String) that stores the **display name** of the department
- Schemes have a `category` field (String) that stores the **category name** or **display name**
- **Scheme name itself serves as the subcategory** - no separate subcategory field
- When creating/updating a scheme, use the department's `department_display_name`

### Example Scheme

```json
{
  "scheme_name": "Student Scholarship",  // This is the "subcategory"
  "department": "Education Department",  // Must match department_display_name
  "category": "Education",               // Category name or display name
  "authorization_levels": [1, 2, 4, 5],
  ...
}
```

---

## 📋 Complete API Reference

### Categories

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/categories` | No | Get all categories |
| GET | `/api/categories/simple` | No | Get simple categories list |
| GET | `/api/categories/:category_name` | No | Get specific category |
| POST | `/api/categories` | Yes | Create category (Admin) |
| PUT | `/api/categories/:category_name` | Yes | Update category (Admin) |
| DELETE | `/api/categories/:category_name` | Yes | Delete category (Admin) |

### Departments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/departments` | No | Get all departments with scheme counts |
| GET | `/api/departments/simple` | No | Get simple departments list |
| GET | `/api/departments/:name` | No | Get specific department with schemes |
| GET | `/api/departments/:name/schemes` | No | Get all schemes for a department |
| POST | `/api/departments` | Yes | Create department (Admin) |
| PUT | `/api/departments/:name` | Yes | Update department (Admin) |
| DELETE | `/api/departments/:name` | Yes | Delete department (Admin) |

---

## 🎯 Frontend Implementation Recommendations

### 1. Scheme Creation Form

**Category & Department Selection:**
```javascript
// Step 1: Fetch categories and departments
const [categoriesResponse, departmentsResponse] = await Promise.all([
  fetch('/api/categories/simple'),
  fetch('/api/departments/simple')
]);

const { categories } = await categoriesResponse.json();
const { departments } = await departmentsResponse.json();

// Step 2: User selects category and department
// Step 3: User enters scheme name (this serves as the subcategory)
const schemeData = {
  scheme_name: "Student Scholarship",  // This is the subcategory
  category: selectedCategory.name,     // category_name
  department: selectedDepartment.displayName,  // department_display_name
  authorization_levels: [1, 2, 4, 5],
  ...
};
```

---

### 2. Display Schemes by Department

```javascript
// Get all departments with scheme counts
const departmentsResponse = await fetch('/api/departments?active_only=true');
const { departments } = await departmentsResponse.json();

// For each department, show schemes
departments.forEach(async (dept) => {
  const schemesResponse = await fetch(
    `/api/departments/${dept.department_name}/schemes?approved_only=true`
  );
  const { schemes } = await schemesResponse.json();
  // Display schemes - scheme_name serves as subcategory
});
```

---

### 3. TypeScript Types (Recommended)

```typescript
interface Category {
  _id: string;
  category_name: string;
  category_display_name: string;
  description?: string;
  isActive: boolean;
}

interface Department {
  _id: string;
  department_name: string;
  department_display_name: string;
  description?: string;
  contact_info?: {
    email?: string;
    phone?: string;
    address?: string;
  };
  isActive: boolean;
  scheme_count: number;
}

interface Scheme {
  _id: string;
  scheme_name: string;        // This serves as the subcategory
  department: string;         // department_display_name
  category: string;           // category_name or category_display_name
  authorization_levels: number[];
  approval_status: "pending_department_head_approval" | "approved" | "rejected";
  ...
}
```

---

### 4. API Service Functions

```typescript
// Categories
async function getCategories(activeOnly = false) {
  const url = activeOnly 
    ? '/api/categories?active_only=true'
    : '/api/categories';
  const response = await fetch(url);
  return response.json();
}

// Departments
async function getDepartments(activeOnly = false) {
  const url = activeOnly
    ? '/api/departments?active_only=true'
    : '/api/departments';
  const response = await fetch(url);
  return response.json();
}

async function getDepartmentSchemes(
  departmentName: string, 
  approvedOnly = false
) {
  const url = approvedOnly
    ? `/api/departments/${departmentName}/schemes?approved_only=true`
    : `/api/departments/${departmentName}/schemes`;
  const response = await fetch(url);
  return response.json();
}
```

---

## ⚠️ Important Changes

### Removed: Subcategories
- **Subcategories have been removed** from the system
- **Scheme name itself serves as the subcategory**
- Category model no longer has subcategories array
- Scheme model no longer has `sub_category` field

### Deprecated Endpoints
The following endpoints are deprecated:
- `GET /api/schemes/subcategories` - Removed (no longer needed)
- `GET /api/schemes/categories-with-subcategories` - Removed (no longer needed)

---

## 📝 Migration Checklist

- [ ] Remove subcategory dropdown/field from scheme creation form
- [ ] Update scheme creation to only require category (not subcategory)
- [ ] Update scheme list/filter to use department endpoints
- [ ] Remove all subcategory-related UI components
- [ ] Update scheme display to show category only
- [ ] Test all API integrations

---

## 🔍 Example: Complete Scheme Creation Flow

```javascript
// 1. Fetch categories and departments on component mount
const [categories, setCategories] = useState([]);
const [departments, setDepartments] = useState([]);

useEffect(() => {
  async function loadData() {
    const [catRes, deptRes] = await Promise.all([
      fetch('/api/categories/simple'),
      fetch('/api/departments/simple')
    ]);
    
    const catData = await catRes.json();
    const deptData = await deptRes.json();
    
    setCategories(catData.categories);
    setDepartments(deptData.departments);
  }
  loadData();
}, []);

// 2. Create scheme - no subcategory needed
const createScheme = async (formData) => {
  const schemeData = {
    ...formData,
    scheme_name: formData.scheme_name,  // This is the subcategory
    category: selectedCategory.name,     // category_name
    department: selectedDepartment.displayName,  // department_display_name
    authorization_levels: [1, 2, 4, 5],
  };
  
  await fetch('/api/schemes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-username': adminUsername,
      'x-admin-password': adminPassword
    },
    body: JSON.stringify(schemeData)
  });
};
```

---

## 📊 Data Structure

```
Scheme
  ├── scheme_name: "Student Scholarship" (serves as subcategory)
  ├── category: "Education" (from Category database)
  └── department: "Education Department" (from Department database)
```

---

## ❓ Questions or Issues?

Refer to:
- `CATEGORIES_API_DOCUMENTATION.md` - Detailed categories API docs (updated)
- `SCHEME_CREATION_FRONTEND_GUIDE.md` - Scheme creation guide (needs update)
