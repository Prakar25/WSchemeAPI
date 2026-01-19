# Department and Category as ObjectId Strings - Frontend Guide

## Overview

The `department` and `category` fields in schemes are now stored as **ObjectId strings** (24-character hex strings) instead of ObjectId references or display names.

**Example:**
- `department`: `"69652457fc10b345178f75a5"` (ObjectId string)
- `category`: `"69652454b19f52b831b4ce4d"` (ObjectId string)

## What Changed

### Scheme Model

**Before:**
- `department`: ObjectId reference (populated object)
- `category`: ObjectId reference (populated object)

**After:**
- `department`: String (ObjectId as string, e.g., `"69652457fc10b345178f75a5"`)
- `category`: String (ObjectId as string, e.g., `"69652454b19f52b831b4ce4d"`)

### API Responses

All scheme endpoints now return `department` and `category` as strings:

```json
{
  "_id": "696538e4a0cadbcf77101b07",
  "scheme_name": "Mukhyamantri Kanya Utthan Yojana",
  "department": "69652457fc10b345178f75a5",
  "category": "69652454b19f52b831b4ce4d",
  "approval_status": "approved",
  ...
}
```

## API Endpoints Affected

### 1. GET /api/schemes

**Response:** All schemes now have `department` and `category` as strings

```json
[
  {
    "_id": "...",
    "scheme_name": "...",
    "department": "69652457fc10b345178f75a5",
    "category": "69652454b19f52b831b4ce4d",
    ...
  }
]
```

### 2. GET /api/schemes/simple

**Response:** Department and category are strings

```json
{
  "status": "success",
  "schemes": [
    {
      "_id": "...",
      "scheme_name": "...",
      "department": "69652457fc10b345178f75a5",
      "category": "69652454b19f52b831b4ce4d",
      "approval_status": "approved"
    }
  ],
  "count": 5
}
```

### 3. POST /api/schemes

**Request:** Accepts department and category as ObjectId strings

```json
{
  "scheme_name": "...",
  "department": "69652457fc10b345178f75a5",
  "category": "69652454b19f52b831b4ce4d",
  ...
}
```

**Response:** Returns department and category as strings

### 4. POST /api/schemes/update

**Request:** Accepts department and category as ObjectId strings

```json
{
  "_id": "...",
  "department": "69652457fc10b345178f75a5",
  "category": "69652454b19f52b831b4ce4d",
  ...
}
```

**Response:** Returns updated scheme with department and category as strings

### 5. GET /api/departments/:department_name/schemes

**Response:** All schemes have department and category as strings

### 6. GET /api/departments/:department_name

**Response:** Schemes in the department object have department and category as strings

## Frontend Migration Guide

### 1. TypeScript Types

Update your TypeScript types:

```typescript
// Before
interface Scheme {
  _id: string;
  scheme_name: string;
  department: {
    _id: string;
    department_name: string;
    department_display_name: string;
  };
  category: {
    _id: string;
    category_name: string;
    category_display_name: string;
  };
  // ...
}

// After
interface Scheme {
  _id: string;
  scheme_name: string;
  department: string; // ObjectId string (e.g., "69652457fc10b345178f75a5")
  category: string; // ObjectId string (e.g., "69652454b19f52b831b4ce4d")
  // ...
}
```

### 2. Displaying Department and Category Names

Since department and category are now ObjectId strings, you need to:

**Option 1: Fetch department/category names separately and map them**

```typescript
// Fetch all departments
const departments = await fetch('/api/departments').then(r => r.json());

// Create a lookup map
const departmentMap = new Map(
  departments.map(dept => [dept._id, dept.department_display_name])
);

// Use in component
const departmentName = departmentMap.get(scheme.department) || scheme.department;
```

**Option 2: Fetch departments/categories on page load and store in context/state**

```typescript
// In your component or context
const [departments, setDepartments] = useState<Map<string, string>>(new Map());
const [categories, setCategories] = useState<Map<string, string>>(new Map());

useEffect(() => {
  // Fetch and create lookup maps
  fetchDepartments().then(depts => {
    const map = new Map(depts.map(d => [d._id, d.department_display_name]));
    setDepartments(map);
  });
  
  fetchCategories().then(cats => {
    const map = new Map(cats.map(c => [c._id, c.category_display_name]));
    setCategories(map);
  });
}, []);

// Use in component
const departmentName = departments.get(scheme.department) || scheme.department;
const categoryName = categories.get(scheme.category) || scheme.category;
```

### 3. Scheme Creation/Update Forms

Update forms to accept and send ObjectId strings:

```typescript
// Form data
interface SchemeFormData {
  scheme_name: string;
  department: string; // ObjectId string from department dropdown
  category: string; // ObjectId string from category dropdown
  // ...
}

// When submitting
const createScheme = async (formData: SchemeFormData) => {
  const response = await fetch('/api/schemes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...formData,
      department: formData.department, // Already an ObjectId string
      category: formData.category, // Already an ObjectId string
    }),
  });
  return response.json();
};
```

### 4. Dropdown/Select Components

When using department/category dropdowns:

```typescript
// Fetch departments for dropdown
const departments = await fetch('/api/departments').then(r => r.json());

// In your select component
<select
  value={formData.department}
  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
>
  {departments.map(dept => (
    <option key={dept._id} value={dept._id}>
      {dept.department_display_name}
    </option>
  ))}
</select>

// The value (dept._id) is already an ObjectId string, so it will match scheme.department
```

### 5. Filtering/Searching

If you filter schemes by department or category:

```typescript
// Before (if you were comparing with objects)
schemes.filter(s => s.department._id === selectedDepartmentId)

// After (direct string comparison)
schemes.filter(s => s.department === selectedDepartmentId)
```

### 6. Scheme Display Components

Update components that display scheme information:

```typescript
// Before
<SchemeCard scheme={scheme}>
  <div>Department: {scheme.department.department_display_name}</div>
  <div>Category: {scheme.category.category_display_name}</div>
</SchemeCard>

// After (with lookup map)
<SchemeCard scheme={scheme}>
  <div>Department: {departmentMap.get(scheme.department) || scheme.department}</div>
  <div>Category: {categoryMap.get(scheme.category) || scheme.category}</div>
</SchemeCard>
```

## Migration Checklist

- [ ] Update TypeScript types/interfaces for Scheme
- [ ] Update scheme display components to handle string IDs
- [ ] Create department/category lookup maps (fetch from `/api/departments` and `/api/categories`)
- [ ] Update scheme creation forms to use ObjectId strings
- [ ] Update scheme update/edit forms
- [ ] Update filtering/searching logic (if any)
- [ ] Update any code that accesses `scheme.department._id` or `scheme.category._id`
- [ ] Update dropdown/select components (values should be `_id` strings)
- [ ] Test all scheme-related pages/components

## Benefits

1. **Simpler data structure**: No need to handle populated objects
2. **Consistent format**: Always strings, no need to check if populated
3. **Better performance**: No populate queries needed
4. **Easier comparisons**: Direct string comparison for filtering

## Important Notes

1. **ObjectId strings are 24 characters**: Always validate format if needed
2. **Use lookup maps**: Fetch departments/categories once and create maps for O(1) lookups
3. **Dropdown values**: Use `department._id` or `category._id` directly (they're already strings)
4. **No breaking changes for dropdowns**: The `_id` values are already strings, so existing dropdown code should work

## API Reference

### Get All Departments

```http
GET /api/departments
```

**Response:**
```json
{
  "status": "success",
  "departments": [
    {
      "_id": "69652457fc10b345178f75a5",
      "department_name": "social_welfare_department",
      "department_display_name": "Social Welfare Department",
      ...
    }
  ],
  "count": 8
}
```

**Use `_id` field as the value for scheme.department**

### Get All Categories

```http
GET /api/categories
```

**Response:**
```json
{
  "status": "success",
  "categories": [
    {
      "_id": "69652454b19f52b831b4ce4d",
      "category_name": "pension",
      "category_display_name": "Pension",
      ...
    }
  ],
  "count": 8
}
```

**Use `_id` field as the value for scheme.category**

## Example: Complete Implementation

```typescript
// types.ts
export interface Scheme {
  _id: string;
  scheme_name: string;
  department: string; // ObjectId string
  category: string; // ObjectId string
  approval_status: string;
  // ... other fields
}

export interface Department {
  _id: string;
  department_name: string;
  department_display_name: string;
}

export interface Category {
  _id: string;
  category_name: string;
  category_display_name: string;
}

// hooks/useSchemes.ts
export const useSchemes = () => {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [departments, setDepartments] = useState<Map<string, string>>(new Map());
  const [categories, setCategories] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    // Fetch schemes
    fetch('/api/schemes')
      .then(r => r.json())
      .then(setSchemes);

    // Fetch departments and create lookup map
    fetch('/api/departments')
      .then(r => r.json())
      .then(data => {
        const map = new Map(
          data.departments.map((d: Department) => [d._id, d.department_display_name])
        );
        setDepartments(map);
      });

    // Fetch categories and create lookup map
    fetch('/api/categories')
      .then(r => r.json())
      .then(data => {
        const map = new Map(
          data.categories.map((c: Category) => [c._id, c.category_display_name])
        );
        setCategories(map);
      });
  }, []);

  return { schemes, departments, categories };
};

// components/SchemeCard.tsx
export const SchemeCard = ({ scheme, departments, categories }: Props) => {
  const departmentName = departments.get(scheme.department) || scheme.department;
  const categoryName = categories.get(scheme.category) || scheme.category;

  return (
    <div>
      <h3>{scheme.scheme_name}</h3>
      <p>Department: {departmentName}</p>
      <p>Category: {categoryName}</p>
    </div>
  );
};
```

## Questions?

If you have any questions or encounter issues, please refer to:
- API documentation: `/api/schemes`, `/api/departments`, `/api/categories`
- This guide: `DEPARTMENT_CATEGORY_STRING_IDS.md`
- Complete API changes: `COMPLETE_FRONTEND_API_CHANGES.md`
