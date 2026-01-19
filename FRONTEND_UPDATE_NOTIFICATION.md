# 🚨 IMPORTANT: Department and Category Field Changes

## Update Required for Frontend

**Date:** January 15, 2025  
**Priority:** HIGH  
**Breaking Change:** YES

---

## Summary

The `department` and `category` fields in schemes have been changed to store **ObjectId strings** (24-character hex strings) instead of populated objects.

**This is a breaking change** - Frontend code needs to be updated.

---

## What Changed

### Before
- `department`: Populated object with `_id`, `department_name`, `department_display_name`, etc.
- `category`: Populated object with `_id`, `category_name`, `category_display_name`, etc.

### After  
- `department`: String (ObjectId as string, e.g., `"69652457fc10b345178f75a5"`)
- `category`: String (ObjectId as string, e.g., `"69652454b19f52b831b4ce4d"`)

---

## Quick Migration Guide

### 1. Update TypeScript Types

```typescript
// Before
interface Scheme {
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
}

// After
interface Scheme {
  department: string; // ObjectId string (e.g., "69652457fc10b345178f75a5")
  category: string;   // ObjectId string (e.g., "69652454b19f52b831b4ce4d")
}
```

### 2. Update Display Code

```typescript
// Before
<div>{scheme.department.department_display_name}</div>
<div>{scheme.category.category_display_name}</div>

// After - Need to fetch departments/categories separately and create lookup maps
const departmentName = departmentMap.get(scheme.department) || scheme.department;
const categoryName = categoryMap.get(scheme.category) || scheme.category;
<div>{departmentName}</div>
<div>{categoryName}</div>
```

### 3. Fetch Departments and Categories

You'll need to fetch departments and categories separately to display names:

```typescript
// Fetch departments
const departments = await fetch('/api/departments').then(r => r.json());

// Create lookup map
const departmentMap = new Map(
  departments.map(d => [d._id, d.department_display_name])
);

// Fetch categories
const categories = await fetch('/api/categories').then(r => r.json());

// Create lookup map
const categoryMap = new Map(
  categories.map(c => [c._id, c.category_display_name])
);
```

### 4. Update Forms

Forms that create/update schemes should send ObjectId strings:

```typescript
// Dropdown value is already ObjectId string (_id)
<select value={formData.department} onChange={...}>
  {departments.map(dept => (
    <option key={dept._id} value={dept._id}>
      {dept.department_display_name}
    </option>
  ))}
</select>

// Submit with ObjectId strings
const schemeData = {
  department: formData.department, // Already ObjectId string
  category: formData.category,     // Already ObjectId string
  ...
};
```

---

## Affected API Endpoints

All scheme-related endpoints now return `department` and `category` as strings:

- ✅ `GET /api/schemes` - Returns department/category as strings
- ✅ `GET /api/schemes/simple` - Returns department/category as strings  
- ✅ `POST /api/schemes` - Accepts department/category as ObjectId strings
- ✅ `POST /api/schemes/update` - Accepts department/category as ObjectId strings
- ✅ `GET /api/departments/:name/schemes` - Returns schemes with department/category as strings
- ✅ `GET /api/departments/:name` - Returns schemes with department/category as strings

---

## Detailed Documentation

For complete migration guide, examples, and best practices, see:

- 📖 **Complete Guide:** `DEPARTMENT_CATEGORY_STRING_IDS.md`
- 📖 **Full API Changes:** `COMPLETE_FRONTEND_API_CHANGES.md`

---

## Migration Checklist

- [ ] Update TypeScript types/interfaces
- [ ] Update scheme display components  
- [ ] Fetch departments/categories and create lookup maps
- [ ] Update scheme creation forms
- [ ] Update scheme update/edit forms
- [ ] Update filtering/searching logic (if any)
- [ ] Remove any code accessing `scheme.department._id` or `scheme.category._id`
- [ ] Test all scheme-related pages/components

---

## Need Help?

If you have questions or encounter issues:
1. Check `DEPARTMENT_CATEGORY_STRING_IDS.md` for detailed examples
2. Review `COMPLETE_FRONTEND_API_CHANGES.md` for API reference
3. Contact the backend team

---

**Last Updated:** January 15, 2025
