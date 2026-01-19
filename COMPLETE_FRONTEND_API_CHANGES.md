# Complete Frontend API Changes Guide

## 🚨 Important: Major Database Schema Changes

**Schemes now store Department and Category as ObjectId references instead of strings.**

---

## 📋 Summary of Changes

### 1. **Scheme Model Changes**
- `department`: Changed from `String` to `ObjectId` reference to `Department`
- `category`: Changed from `String` to `ObjectId` reference to `Category`
- **Subcategory field removed** - Scheme name serves as subcategory

### 2. **Department-Category Relationship**
- Departments now have a `categories` array that stores which categories they handle
- Validation: When creating a scheme, the category must belong to the selected department

### 3. **API Response Changes**
- All scheme responses now include populated `department` and `category` objects
- Department and category are returned as full objects with `_id`, `name`, `displayName`, etc.

---

## 🔄 Updated API Endpoints

### 1. GET /api/schemes

**Changes:**
- Now returns schemes with populated `department` and `category` objects
- **NEW:** Supports `approved_only` query parameter

**Query Parameters:**
- `user_id` (optional): Filter based on excluded schemes
- `approved_only` (optional): `true` or `1` - Only return approved schemes

**Examples:**
```bash
GET /api/schemes                          # All schemes
GET /api/schemes?approved_only=true      # Only approved schemes
GET /api/schemes?user_id=user123         # Filtered by user
GET /api/schemes?approved_only=true&user_id=user123  # Both filters
```

**Response Structure:**
```json
[
  {
    "_id": "...",
    "scheme_name": "Student Scholarship",
    "department": {
      "_id": "department_id",
      "department_name": "education_department",
      "department_display_name": "Education Department",
      "isActive": true
    },
    "category": {
      "_id": "category_id",
      "category_name": "education",
      "category_display_name": "Education",
      "isActive": true
    },
    "authorization_levels": [1, 2, 4, 5],
    "approval_status": "approved",
    ...
  }
]
```

**Before (Old):**
```json
{
  "department": "Education Department",  // String
  "category": "education"                // String
}
```

**After (New):**
```json
{
  "department": {                        // Object
    "_id": "...",
    "department_name": "education_department",
    "department_display_name": "Education Department"
  },
  "category": {                          // Object
    "_id": "...",
    "category_name": "education",
    "category_display_name": "Education"
  }
}
```

---

### 2. POST /api/schemes - Create Scheme

**Request Body Changes:**

**Option 1: Using ObjectIds (Recommended)**
```json
{
  "scheme_name": "Student Scholarship",
  "department": "department_object_id",     // ObjectId string
  "category": "category_object_id",         // ObjectId string
  "authorization_levels": [1, 2, 4, 5],
  ...
}
```

**Option 2: Using Names (Backward Compatible)**
```json
{
  "scheme_name": "Student Scholarship",
  "department": "education_department",     // department_name
  // OR
  "department": "Education Department",     // department_display_name
  "category": "education",                  // category_name
  // OR
  "category": "Education",                  // category_display_name
  "authorization_levels": [1, 2, 4, 5],
  ...
}
```

**Important Notes:**
- The API accepts both ObjectIds and names (for backward compatibility)
- **Validation**: The category must belong to the selected department
- If validation fails, you'll get error: `"Category 'X' is not associated with department 'Y'"`

**Response:**
- Returns scheme with populated `department` and `category` objects

---

### 3. GET /api/schemes/simple

**NEW ENDPOINT:** Get simple list of schemes for dropdowns (e.g., excluded_schemes selection)

**Authentication:** Not required

**Query Parameters:**
- `approved_only` (optional): `true` or `1` - Only return approved schemes

**Response:**
```json
{
  "status": "success",
  "schemes": [
    {
      "_id": "scheme_id",
      "scheme_name": "Student Scholarship",
      "department": {
        "_id": "department_id",
        "department_name": "education_department",
        "department_display_name": "Education Department"
      },
      "category": {
        "_id": "category_id",
        "category_name": "education",
        "category_display_name": "Education"
      },
      "approval_status": "approved"
    }
  ],
  "count": 10
}
```

**Use Case:** Use this endpoint to populate excluded_schemes dropdown when creating/editing a scheme.

---

### 4. GET /api/departments/:department_name/schemes

**Changes:**
- Now returns schemes with populated `department` and `category` objects

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
      "department": {
        "_id": "...",
        "department_name": "education_department",
        "department_display_name": "Education Department"
      },
      "category": {
        "_id": "...",
        "category_name": "education",
        "category_display_name": "Education"
      },
      ...
    }
  ],
  "count": 10
}
```

---

### 4. GET /api/applications (All endpoints)

**Changes:**
- Application responses that include scheme data now have populated `department` and `category`

**Example Response:**
```json
{
  "status": "success",
  "data": [
    {
      "_id": "...",
      "scheme_id": {
        "_id": "...",
        "scheme_name": "Student Scholarship",
        "department": {
          "_id": "...",
          "department_name": "education_department",
          "department_display_name": "Education Department"
        },
        "category": {
          "_id": "...",
          "category_name": "education",
          "category_display_name": "Education"
        }
      },
      ...
    }
  ]
}
```

---

## 🆕 New Department-Category APIs

### 1. GET /api/departments/:department_name/categories

**Get categories for a specific department**

**Response:**
```json
{
  "status": "success",
  "department": {
    "name": "Education Department",
    "department_name": "education_department"
  },
  "categories": [
    {
      "_id": "...",
      "category_name": "education",
      "category_display_name": "Education",
      "description": "...",
      "isActive": true
    }
  ],
  "count": 1
}
```

---

### 2. POST /api/departments/:department_name/categories

**Add categories to a department (Admin only)**

**Request:**
```json
{
  "category_ids": ["category_id_1", "category_id_2"]
}
```

---

### 3. DELETE /api/departments/:department_name/categories/:category_id

**Remove category from department (Admin only)**

---

## 📝 Frontend Implementation Changes

### 1. **Scheme Creation Form**

**Excluded Schemes Selection:**
- Use `GET /api/schemes/simple?approved_only=true` to fetch available schemes
- Display as multi-select dropdown or checkbox list
- Store selected scheme `_id` values in `excluded_schemes` array
- Example: `excluded_schemes: ["scheme_id_1", "scheme_id_2"]`

**Step 1: Fetch Departments and Schemes for Excluded Schemes**
```javascript
// Fetch departments for department dropdown
const departmentsResponse = await fetch('/api/departments/simple');
const { departments } = await departmentsResponse.json();

// Fetch schemes for excluded_schemes dropdown (optional - if needed)
const schemesResponse = await fetch('/api/schemes/simple?approved_only=true');
const { schemes } = await schemesResponse.json();
// schemes = [{ _id: "...", scheme_name: "...", department: {...}, category: {...} }]
```

**Step 2: Fetch Categories for Selected Department**
```javascript
const departmentsResponse = await fetch('/api/departments/simple');
const { departments } = await departmentsResponse.json();
// departments = [{ name: "education_department", displayName: "Education Department" }]
```

**Step 2: Fetch Categories for Selected Department**
```javascript
// When user selects a department
const selectedDepartment = departments.find(d => d.name === 'education_department');

// Fetch categories for that department
const categoriesResponse = await fetch(
  `/api/departments/${selectedDepartment.name}/categories`
);
const { categories } = await categoriesResponse.json();
// categories = [{ _id: "...", category_name: "education", category_display_name: "Education" }]
```

**Step 4: Create Scheme with Excluded Schemes**
```javascript
// Option 1: Using ObjectIds (Recommended)
const schemeData = {
  scheme_name: "Student Scholarship",
  department: selectedDepartment._id,      // If you have _id from full department object
  // OR
  department: selectedCategory.department._id,  // From category object
  category: selectedCategory._id,
  authorization_levels: [1, 2, 4, 5],
  ...
};

// Option 2: Using Names (Also works)
const schemeData = {
  scheme_name: "Student Scholarship",
  department: selectedDepartment.name,     // "education_department"
  // OR
  department: selectedDepartment.displayName,  // "Education Department"
  category: selectedCategory.category_name,    // "education"
  authorization_levels: [1, 2, 4, 5],
  excluded_schemes: selectedExcludedSchemeIds,  // Array of scheme _id strings: ["scheme_id_1", "scheme_id_2"]
  ...
};

await fetch('/api/schemes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-admin-username': username,
    'x-admin-password': password
  },
  body: JSON.stringify(schemeData)
});
```

---

### 2. **Display Schemes**

**Update scheme display code:**
```javascript
// OLD CODE (Won't work anymore)
scheme.department  // String: "Education Department"
scheme.category    // String: "education"

// NEW CODE
scheme.department.department_display_name  // "Education Department"
scheme.department.department_name          // "education_department"
scheme.category.category_display_name      // "Education"
scheme.category.category_name              // "education"

// Example rendering
<div>
  <h3>{scheme.scheme_name}</h3>
  <p>Department: {scheme.department?.department_display_name}</p>
  <p>Category: {scheme.category?.category_display_name}</p>
</div>
```

---

### 3. **Filter Schemes by Department/Category**

```javascript
// Get schemes for a department
const schemesResponse = await fetch(
  `/api/departments/${departmentName}/schemes?approved_only=true`
);
const { schemes } = await schemesResponse.json();

// Each scheme now has populated department and category
schemes.forEach(scheme => {
  console.log(scheme.department.department_display_name);
  console.log(scheme.category.category_display_name);
});
```

---

### 4. **TypeScript Types (Recommended)**

```typescript
interface Department {
  _id: string;
  department_name: string;
  department_display_name: string;
  isActive: boolean;
}

interface Category {
  _id: string;
  category_name: string;
  category_display_name: string;
  isActive: boolean;
}

interface Scheme {
  _id: string;
  scheme_name: string;
  department: Department;      // Object, not string!
  category: Category;          // Object, not string!
  authorization_levels: number[];
  approval_status: "pending_department_head_approval" | "approved" | "rejected";
  ...
}

interface Application {
  _id: string;
  scheme_id: Scheme;
  ...
}
```

---

## ⚠️ Breaking Changes

### 1. **Scheme Response Structure**
- ❌ **OLD**: `scheme.department` was a string
- ✅ **NEW**: `scheme.department` is an object

**Migration:**
```javascript
// Before
const deptName = scheme.department;  // String

// After
const deptName = scheme.department?.department_display_name;  // Object
```

### 2. **Application Response Structure**
- ❌ **OLD**: `application.scheme_id.category` was a string
- ✅ **NEW**: `application.scheme_id.category` is an object

**Migration:**
```javascript
// Before
const category = application.scheme_id.category;  // String

// After
const category = application.scheme_id.category?.category_display_name;  // Object
```

---

## 🔄 Migration Checklist

- [ ] Update scheme creation form to fetch categories based on selected department
- [ ] Update all scheme display components to use `department.department_display_name` instead of `department`
- [ ] Update all scheme display components to use `category.category_display_name` instead of `category`
- [ ] Update application display components to use nested object structure
- [ ] Update TypeScript types/interfaces
- [ ] Update filtering/search logic
- [ ] Test scheme creation with department-category validation
- [ ] Update any caching logic that stores scheme data

---

## 📚 Complete API Reference

### Categories
- `GET /api/categories` - All categories
- `GET /api/categories/simple` - Simple list for dropdowns
- `GET /api/categories/:name` - Specific category

### Departments
- `GET /api/departments` - All departments with scheme counts
  - Query params: `active_only`
- `GET /api/departments/simple` - Simple list for dropdowns
- `GET /api/departments/:name` - Department with categories and schemes
- `GET /api/departments/:name/schemes` - Schemes for a department
  - Query params: `approved_only`, `status`
- `GET /api/departments/:name/categories` - Categories for a department
- `POST /api/departments/:name/categories` - Add categories (Admin)
- `DELETE /api/departments/:name/categories/:category_id` - Remove category (Admin)

### Schemes
- `GET /api/schemes` - All schemes (with populated department/category)
- `GET /api/schemes/simple` - Simple list of schemes for dropdowns (excluded_schemes)
- `POST /api/schemes` - Create scheme (department/category as ObjectId or name)
- `PUT /api/schemes/:id/approve` - Approve scheme
- `PUT /api/schemes/:id/reject` - Reject scheme

### Applications
- All application endpoints return schemes with populated department/category

---

## 💡 Best Practices

1. **Use ObjectIds for Scheme Creation**
   - Store department and category IDs from API responses
   - Use those IDs when creating schemes for better performance

2. **Handle Null/Undefined Safely**
   - Always use optional chaining: `scheme.department?.department_display_name`
   - Provide fallbacks: `scheme.department?.department_display_name || 'Unknown'`

3. **Fetch Categories Dynamically**
   - Don't fetch all categories upfront
   - Fetch categories when user selects a department
   - This ensures only valid department-category combinations are shown

4. **Cache Department-Category Relationships**
   - Consider caching department categories on the frontend
   - Refresh cache when departments are updated

---

## ❓ FAQ

**Q: Can I still use department/category names instead of IDs?**
A: Yes, the API accepts both ObjectIds and names for backward compatibility. However, using ObjectIds is recommended.

**Q: What if I send a category that doesn't belong to the department?**
A: The API will return a 400 error: `"Category 'X' is not associated with department 'Y'"`

**Q: How do I get categories for a department?**
A: Use `GET /api/departments/:department_name/categories`

**Q: Do I need to update existing schemes in the database?**
A: No, the API handles both old and new formats. However, when you fetch schemes, they will always return with populated objects.

**Q: What about applications?**
A: Applications automatically return schemes with populated department and category objects.

---

**Last Updated:** [Current Date]
**API Version:** 2.0 (Department/Category ObjectId References)
