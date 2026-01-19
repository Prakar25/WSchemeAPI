# Frontend Quick Reference - API Endpoints

## 🔥 Most Used Endpoints

### Categories
```javascript
// Get all categories (for dropdowns)
GET /api/categories/simple
Response: { status: "success", categories: [{ name, displayName }] }

// Note: Subcategories removed - scheme name serves as subcategory
```

### Departments
```javascript
// Get all departments (for dropdowns)
GET /api/departments/simple
Response: { status: "success", departments: [{ name, displayName }] }

// Get schemes for a department
GET /api/departments/:department_name/schemes?approved_only=true
Response: { status: "success", schemes: [...], count: 10 }
```

### Schemes
```javascript
// Create scheme
POST /api/schemes
Body: {
  scheme_name,  // This serves as the subcategory
  department,   // department_display_name
  category,     // category_name
  authorization_levels: [1, 2, 4, 5], ...
}
```

// Get all schemes
GET /api/schemes

// Approve scheme (Dept Head/Secretary/Super Admin only)
PUT /api/schemes/:id/approve
```

---

## 📋 Complete Endpoint List

### Categories API
- `GET /api/categories` - All categories
- `GET /api/categories/simple` - Simple list (name, displayName)
- `GET /api/categories/:name` - Specific category
- `POST /api/categories` - Create category (Admin)
- `PUT /api/categories/:name` - Update category (Admin)
- `DELETE /api/categories/:name` - Delete category (Admin)

### Departments API
- `GET /api/departments` - All departments with scheme counts
- `GET /api/departments/simple` - Simple list (name, displayName)
- `GET /api/departments/:name` - Specific department with schemes
- `GET /api/departments/:name/schemes` - Schemes for department

### Schemes API
- `GET /api/schemes` - All schemes
- `POST /api/schemes` - Create scheme (requires auth)
- `PUT /api/schemes/:id/approve` - Approve scheme (Dept Head/Secretary/Super Admin)
- `PUT /api/schemes/:id/reject` - Reject scheme (Dept Head/Secretary/Super Admin)

---

## 🔗 Linking Schemes to Departments and Categories

When creating a scheme:
```javascript
// 1. Fetch departments and categories
const [deptRes, catRes] = await Promise.all([
  fetch('/api/departments/simple'),
  fetch('/api/categories/simple')
]);
const { departments } = await deptRes.json();
const { categories } = await catRes.json();

// 2. User selects department and category from dropdowns
const selectedDept = departments.find(d => d.name === 'education_department');
const selectedCat = categories.find(c => c.name === 'education');

// 3. User enters scheme name (this serves as subcategory)
const schemeData = {
  scheme_name: "Student Scholarship",  // This is the subcategory
  department: selectedDept.displayName, // "Education Department"
  category: selectedCat.name,          // "education"
  authorization_levels: [1, 2, 4, 5],
  ...
};
```

---

## 📊 Data Relationships

```
Department (database)
  └── department_display_name: "Education Department"
      └── Scheme.department (matches this value)
          └── Scheme.category: "Education" (from Category database)
          └── Scheme.scheme_name: "Student Scholarship" (serves as subcategory)
```

**Important:** Schemes link to departments via `department_display_name`, not `department_name`.

---

## 💡 Quick Implementation Tips

1. **Load categories/departments on mount**
2. **No subcategory field needed - scheme name is the subcategory**
3. **Use display names for UI, store names for API**
4. **Check scheme count before showing department**
5. **Use `approved_only=true` for public-facing scheme lists**
