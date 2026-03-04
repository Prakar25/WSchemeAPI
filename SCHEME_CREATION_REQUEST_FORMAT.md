# Scheme Creation Request Format - Frontend Guide

## Overview

This document provides the exact request format for creating a scheme via `POST /api/schemes`.

**Endpoint:** `POST /api/schemes`  
**Content-Type:** `application/json`

---

## Request Format

### Basic Structure

```json
{
  "scheme_name": "Student Scholarship Scheme",
  "scheme_date": "2025-12-01T00:00:00.000Z",
  "gender": "All",
  "department": "69652457fc10b345178f75a5",
  "category": "69652454b19f52b831b4ce4d",
  "scheme_description": "Description of the scheme",
  "scheme_objectives": ["Objective 1", "Objective 2"],
  "scheme_benefits": ["Benefit 1", "Benefit 2"],
  "scheme_eligibility": {
    "lower_age_limit": 18,
    "upper_age_limit": 65
  },
  "scheme_required_document_types": ["Aadhaar Card", "Birth Certificate"],
  "scheme_required_documents": [],
  "scheme_image_file_url": null,
  "excluded_schemes": [],
  "authorization_levels": [1, 2, 4, 5],
  "approval_status": "pending_department_head_approval",
  "custom_form_fields": [
    { "field_key": "annual_income", "label": "Annual Income (INR)", "type": "number", "required": true },
    { "field_key": "gender", "label": "Gender", "type": "select", "required": true, "options": "Male, Female" }
  ]
}
```

---

## Field Details

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `scheme_name` | String | Name of the scheme | `"Student Scholarship Scheme"` |
| `gender` | String | Gender eligibility | `"All"`, `"Male"`, `"Female"` |
| `department` | String | Department ID (ObjectId string) | `"69652457fc10b345178f75a5"` |
| `category` | String | Category ID (ObjectId string) | `"69652454b19f52b831b4ce4d"` |
| `scheme_description` | String | Detailed description | `"This scheme provides..."` |
| `scheme_objectives` | Array[String] | Array of objectives (min 1) | `["Objective 1", "Objective 2"]` |
| `scheme_benefits` | Array[String] | Array of benefits (min 1) | `["Benefit 1", "Benefit 2"]` |
| `scheme_eligibility` | Object | Age eligibility limits | See below |
| `scheme_required_document_types` | Array[String] | Required documents (min 1) | `["Aadhaar Card"]` |

### Optional Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `scheme_date` | String (ISO Date) | Scheme start date | `"2025-12-01T00:00:00.000Z"` |
| `scheme_required_documents` | Array[Object] | Uploaded documents | `[]` or array of document objects |
| `scheme_image_file_url` | String \| null | Image URL | `null` or `"public/uploads/..."` |
| `excluded_schemes` | Array[String] | Excluded scheme IDs | `[]` or `["scheme_id_1", "scheme_id_2"]` |
| `authorization_levels` | Array[Number] | Authorization levels (max 4) | `[1, 2, 4, 5]` |
| `approval_status` | String | Initial approval status | `"pending_department_head_approval"` |
| `custom_form_fields` | Array[Object] | Per-scheme form field definitions | See below |

---

## Detailed Field Specifications

### 1. `scheme_eligibility` (Required Object)

```json
{
  "lower_age_limit": 18,
  "upper_age_limit": 65
}
```

- **`lower_age_limit`**: Number (required) - Minimum age
- **`upper_age_limit`**: Number (required) - Maximum age

### 2. `scheme_required_documents` (Optional Array)

```json
[
  {
    "document_type": "Aadhaar Card",
    "file_url": "public/uploads/user-docs/aadhaar_123.pdf",
    "uploaded_at": "2025-01-15T10:30:00.000Z"
  }
]
```

- Empty array `[]` if no documents uploaded yet
- Each document must have: `document_type`, `file_url`, `uploaded_at`

### 3. `excluded_schemes` (Optional Array)

```json
["696538e4a0cadbcf77101b07", "696538e4a0cadbcf77101b08"]
```

- Array of scheme IDs (ObjectId strings)
- Empty array `[]` if no excluded schemes

### 4. `authorization_levels` (Optional Array)

```json
[1, 2, 4, 5]
```

- Array of numbers (max 4 levels)
- Role levels: 1=Super Admin, 2=Admin, 3=Dept Secretary, 4=Dept Head, etc.
- Empty array `[]` if not specified

### 5. `gender` (Required String)

Valid values:
- `"All"`
- `"Male"`
- `"Female"`

### 6. `department` and `category` (Required Strings)

**Important:** These must be ObjectId strings (24-character hex strings), not display names!

```javascript
// ✅ CORRECT - Use _id from department/category API response
department: "69652457fc10b345178f75a5"
category: "69652454b19f52b831b4ce4d"

// ❌ WRONG - Don't use display names
department: "Education Department"
category: "Education"
```

### 7. `custom_form_fields` (Optional Array)

Per-scheme dynamic form field definitions. Each scheme can define its own form inputs for applicants.

```json
[
  { "field_key": "annual_income", "label": "Annual Income (INR)", "field_type": "number", "required": true },
  { "field_key": "caste_category", "label": "Caste Category", "field_type": "select", "required": true, "options": ["SC", "ST", "OBC", "General"] }
]
```

- **`field_key`** (required): Unique key, used in application `form_data`
- **`label`** (required): Display label
- **`type`** or **`field_type`**: `text`, `number`, `select`, `date`, `textarea`, `checkbox` (default: `text`)
- **`required`**: boolean (default: false)
- **`options`**: For `select` type only – comma-separated string (e.g. `"Male, Female"`) or array (e.g. `["Male", "Female"]`)

Empty array `[]` if no custom fields. Both `POST /api/schemes` and `POST /api/schemes/update` accept this. See `SCHEME_CREATION_DYNAMIC_FORM_GUIDE.md` for full details.

---

## Complete Example Request

```javascript
// Frontend code example
const schemeData = {
  scheme_name: "Student Scholarship Scheme",
  scheme_date: "2025-12-01T00:00:00.000Z",
  gender: "All",
  department: "69652457fc10b345178f75a5", // ObjectId string from GET /api/departments
  category: "69652454b19f52b831b4ce4d",   // ObjectId string from GET /api/categories
  scheme_description: "This scheme provides financial assistance to students pursuing higher education.",
  scheme_objectives: [
    "Promote higher education",
    "Reduce financial burden on families",
    "Increase enrollment rates"
  ],
  scheme_benefits: [
    "Tuition fee reimbursement",
    "Book allowance",
    "Stipend for living expenses"
  ],
  scheme_eligibility: {
    lower_age_limit: 18,
    upper_age_limit: 25
  },
  scheme_required_document_types: [
    "Aadhaar Card",
    "Educational Certificates",
    "Income Certificate",
    "Bank Account Details"
  ],
  scheme_required_documents: [], // Empty if no documents uploaded yet
  scheme_image_file_url: null,
  excluded_schemes: [], // Empty if no excluded schemes
  authorization_levels: [1, 2, 4, 5],
  approval_status: "pending_department_head_approval"
};

// Send request
const response = await fetch('/api/schemes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // Add authentication headers if required
  },
  body: JSON.stringify(schemeData)
});
```

---

## React/Form Example

```jsx
import { useState } from 'react';
import axios from 'axios';

function AddSchemeForm() {
  const [formData, setFormData] = useState({
    scheme_name: '',
    scheme_date: '',
    gender: 'All',
    department: '',
    category: '',
    scheme_description: '',
    scheme_objectives: [''],
    scheme_benefits: [''],
    scheme_eligibility: {
      lower_age_limit: 18,
      upper_age_limit: 65
    },
    scheme_required_document_types: [''],
    excluded_schemes: [],
    authorization_levels: []
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prepare request data
    const requestData = {
      ...formData,
      // Ensure arrays are not empty
      scheme_objectives: formData.scheme_objectives.filter(obj => obj.trim() !== ''),
      scheme_benefits: formData.scheme_benefits.filter(ben => ben.trim() !== ''),
      scheme_required_document_types: formData.scheme_required_document_types.filter(doc => doc.trim() !== ''),
      scheme_required_documents: [],
      scheme_image_file_url: null,
      approval_status: 'pending_department_head_approval'
    };

    try {
      const response = await axios.post('/api/schemes', requestData);
      console.log('Scheme created:', response.data);
    } catch (error) {
      if (error.response?.status === 422) {
        // Validation error
        console.error('Validation errors:', error.response.data);
        // error.response.data.message contains validation messages
      } else {
        console.error('Error creating scheme:', error);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

---

## Common Validation Errors (422)

### 1. Missing Required Fields

```json
{
  "error": "Validation error",
  "message": "Scheme name is required, Category is required"
}
```

**Fix:** Ensure all required fields are provided.

### 2. Empty Arrays

```json
{
  "error": "Validation error",
  "message": "Scheme objectives must be a non-empty array"
}
```

**Fix:** Ensure arrays like `scheme_objectives`, `scheme_benefits`, `scheme_required_document_types` have at least one item.

### 3. Invalid Department/Category ID

```json
{
  "error": "Validation error",
  "message": "Category is required"
}
```

**Fix:** Ensure `department` and `category` are valid ObjectId strings from the API responses.

### 4. Invalid Authorization Levels

```json
{
  "error": "Validation error",
  "message": "Authorization levels must be an array with at most 4 numbers"
}
```

**Fix:** Ensure `authorization_levels` has max 4 items, or use empty array `[]`.

---

## Getting Department and Category IDs

### Step 1: Fetch Departments

```javascript
const departmentsResponse = await fetch('/api/departments');
const { departments } = await departmentsResponse.json();

// Each department has: _id, department_name, department_display_name
// Use _id for scheme creation
const selectedDepartmentId = departments[0]._id; // ObjectId string
```

### Step 2: Fetch Categories

```javascript
const categoriesResponse = await fetch('/api/categories');
const { categories } = await categoriesResponse.json();

// Each category has: _id, category_name, category_display_name
// Use _id for scheme creation
const selectedCategoryId = categories[0]._id; // ObjectId string
```

### Step 3: Use IDs in Request

```javascript
const schemeData = {
  // ...
  department: selectedDepartmentId, // ✅ Use _id
  category: selectedCategoryId,     // ✅ Use _id
  // ...
};
```

---

## Response Format

### Success (200)

```json
{
  "_id": "696538e4a0cadbcf77101b07",
  "scheme_name": "Student Scholarship Scheme",
  "department": "69652457fc10b345178f75a5",
  "category": "69652454b19f52b831b4ce4d",
  "approval_status": "pending_department_head_approval",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z",
  // ... all other fields
}
```

### Validation Error (422)

```json
{
  "error": "Validation error",
  "message": "Scheme name is required, Category is required"
}
```

### Server Error (500)

```json
{
  "error": "Failed to create scheme",
  "message": "Error details"
}
```

---

## Quick Checklist

Before sending the request, ensure:

- [ ] `scheme_name` is provided (string, not empty)
- [ ] `gender` is one of: `"All"`, `"Male"`, `"Female"`
- [ ] `department` is a valid ObjectId string (24 characters)
- [ ] `category` is a valid ObjectId string (24 characters)
- [ ] `scheme_description` is provided (string, not empty)
- [ ] `scheme_objectives` is a non-empty array (at least 1 item)
- [ ] `scheme_benefits` is a non-empty array (at least 1 item)
- [ ] `scheme_eligibility.lower_age_limit` is a number
- [ ] `scheme_eligibility.upper_age_limit` is a number
- [ ] `scheme_required_document_types` is a non-empty array (at least 1 item)
- [ ] `scheme_required_documents` is an array (can be empty)
- [ ] `excluded_schemes` is an array (can be empty)
- [ ] `authorization_levels` is an array with max 4 numbers (can be empty)
- [ ] All dates are in ISO format (if provided)

---

## TypeScript Types

```typescript
interface SchemeCreationRequest {
  scheme_name: string;
  scheme_date?: string; // ISO date string
  gender: "All" | "Male" | "Female";
  department: string; // ObjectId string
  category: string; // ObjectId string
  scheme_description: string;
  scheme_objectives: string[]; // Min 1 item
  scheme_benefits: string[]; // Min 1 item
  scheme_eligibility: {
    lower_age_limit: number;
    upper_age_limit: number;
  };
  scheme_required_document_types: string[]; // Min 1 item
  scheme_required_documents?: Array<{
    document_type: string;
    file_url: string;
    uploaded_at: string; // ISO date string
  }>;
  scheme_image_file_url?: string | null;
  excluded_schemes?: string[]; // Array of ObjectId strings
  authorization_levels?: number[]; // Max 4 items
  approval_status?: "pending_department_head_approval" | "approved" | "rejected";
  custom_form_fields?: Array<{
    field_key: string;
    label: string;
    type?: "text" | "number" | "select" | "date" | "textarea" | "checkbox";
    required?: boolean;
    options?: string | string[]; // comma-separated string or array
  }>;
}
```

---

## Need Help?

If you're still getting 422 errors:

1. **Check the error message** - It will tell you which fields are missing/invalid
2. **Verify ObjectId format** - Department and category must be 24-character hex strings
3. **Ensure arrays are not empty** - Objectives, benefits, document types must have at least 1 item
4. **Check data types** - Numbers for age limits, strings for text fields, arrays for list fields

For detailed API documentation, see `COMPLETE_FRONTEND_API_CHANGES.md`.
