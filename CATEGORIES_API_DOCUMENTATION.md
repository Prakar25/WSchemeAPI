# Categories API Documentation

## Overview

A dedicated database collection for managing categories. **Note: Subcategories have been removed - the scheme name itself serves as the subcategory.** This allows centralized management of categories independent of schemes.

## Database Model

### Category Schema

```javascript
{
  category_name: String (unique, lowercase),
  category_display_name: String,
  description: String (optional),
  isActive: Boolean (default: true),
  created_by: {
    admin_id: ObjectId,
    admin_username: String,
    created_at: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

---

## API Endpoints

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
      "isActive": true,
      "created_by": {
        "admin_id": "...",
        "admin_username": "admin.user",
        "created_at": "2025-01-15T10:00:00.000Z"
      },
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
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
    },
    {
      "name": "health",
      "displayName": "Health"
    }
  ],
  "count": 2
}
```

---

### 3. Get Specific Category

**Endpoint:** `GET /api/categories/:category_name`

**Authentication:** Not required

**URL Parameters:**
- `category_name`: The category name (case-insensitive)

**Response:**
```json
{
  "status": "success",
  "category": {
    "_id": "...",
    "category_name": "education",
    "category_display_name": "Education",
    "description": "Educational schemes",
    "isActive": true,
    "created_by": {
      "admin_id": "...",
      "admin_username": "admin.user",
      "created_at": "2025-01-15T10:00:00.000Z"
    },
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
}
```

**Error Response (404):**
```json
{
  "status": "error",
  "message": "Category not found"
}
```

---

### 4. Create Category (Admin Only)

**Endpoint:** `POST /api/categories`

**Authentication:** Required (Admin authentication)

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
  "description": "Educational schemes and programs"
}
```

**Response (201):**
```json
{
  "status": "success",
  "message": "Category created successfully",
  "category": {
    "_id": "...",
    "category_name": "education",
    "category_display_name": "Education",
    "description": "Educational schemes and programs",
    "isActive": true,
    "created_by": {
      "admin_id": "...",
      "admin_username": "admin.user",
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  }
}
```

**Error Responses:**
- `400`: Category already exists
- `400`: Missing required fields
- `422`: Validation error

---

### 5. Update Category (Admin Only)

**Endpoint:** `PUT /api/categories/:category_name`

**Authentication:** Required (Admin authentication)

**Request Body:**
```json
{
  "category_display_name": "Education & Learning",
  "description": "Updated description",
  "isActive": true
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Category updated successfully",
  "category": {
    "_id": "...",
    "category_name": "education",
    "category_display_name": "Education & Learning",
    "description": "Updated description",
    "isActive": true,
    ...
  }
}
```

**Error Responses:**
- `404`: Category not found

---

### 6. Delete Category (Admin Only)

**Endpoint:** `DELETE /api/categories/:category_name`

**Authentication:** Required (Admin authentication)

**Response:**
```json
{
  "status": "success",
  "message": "Category deleted successfully"
}
```

**Error Responses:**
- `404`: Category not found

---

## Complete API Reference Table

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/categories` | No | Get all categories |
| GET | `/api/categories/simple` | No | Get simple categories list for dropdowns |
| GET | `/api/categories/:category_name` | No | Get specific category |
| POST | `/api/categories` | Yes | Create category (Admin) |
| PUT | `/api/categories/:category_name` | Yes | Update category (Admin) |
| DELETE | `/api/categories/:category_name` | Yes | Delete category (Admin) |

---

## Example Usage

### Creating a Category

```bash
POST /api/categories
Headers: 
  x-admin-username: admin.user
  x-admin-password: password123
Body: {
  "category_name": "health",
  "category_display_name": "Health",
  "description": "Health and medical schemes"
}
```

### Fetching Categories for Dropdown

```javascript
// Frontend example
const response = await fetch('/api/categories/simple');
const { categories } = await response.json();

// categories = [
//   { name: "education", displayName: "Education" },
//   { name: "health", displayName: "Health" }
// ]
```

### Using Category in Scheme Creation

```javascript
// When creating a scheme
const schemeData = {
  scheme_name: "Student Scholarship",  // This serves as the subcategory
  category: selectedCategory.name,     // e.g., "education"
  department: selectedDepartment.displayName,
  ...
};
```

---

## Important Notes

1. **Subcategories Removed**: The subcategory concept has been removed. The scheme name itself serves as the subcategory.

2. **Naming Convention**:
   - `category_name`: Stored in lowercase (e.g., "education")
   - `category_display_name`: User-friendly display name (e.g., "Education")

3. **Scheme Integration**:
   - When creating a scheme, use `category_name` for the `category` field
   - The `scheme_name` serves as the subcategory

4. **Activation/Deactivation**:
   - Categories can be activated/deactivated without deletion
   - Set `isActive: false` to hide from active lists
   - Use `?active_only=true` query param to filter active categories

5. **Admin Tracking**:
   - The `created_by` field tracks which admin created the category
   - Automatically populated when creating via API

---

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created successfully |
| 400 | Bad request (missing fields, duplicate category) |
| 404 | Category not found |
| 422 | Validation error |
| 500 | Internal server error |

---

## Migration from Old System

If you were previously using subcategories:

1. **Remove subcategory fields** from scheme creation forms
2. **Use scheme name as subcategory** - no separate field needed
3. **Update API calls** - remove `sub_category` from requests
4. **Update displays** - show only category and scheme name

For more details, see `FRONTEND_PROMPT_SUMMARY.md`.
