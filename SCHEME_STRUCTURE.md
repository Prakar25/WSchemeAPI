# Scheme Database Structure

## New Schema Structure

The Scheme model has been updated to use a cleaner, more structured format:

```javascript
{
  "_id": ObjectId,                    // MongoDB auto-generated ID
  "scheme_name": String,              // Name of the scheme
  "scheme_date": Date,                // Date of the scheme
  "gender": String,                   // Gender (e.g., "Female", "Male", "All")
  "category": String,                 // Category (e.g., "Pension", "Education")
  "sub_category": String,             // Sub-category (e.g., "Aama Yojana")
  "scheme_description": String,       // Full description
  "scheme_objectives": [String],      // Array of objectives
  "scheme_benefits": [String],        // Array of benefits
  "scheme_eligibility": {
    "lower_age_limit": Number,        // Minimum age
    "upper_age_limit": Number         // Maximum age
  },
  "scheme_required_document_types": [String], // Array of document type names
  "scheme_required_documents": [      // Array of uploaded documents
    {
      "document_type": String,         // Type of document
      "file_url": String,              // File path/URL
      "uploaded_at": Date              // Upload timestamp
    }
  ],
  "scheme_image_file_url": String,    // Scheme image file path
  "createdAt": Date,                  // Auto-generated timestamp
  "updatedAt": Date,                  // Auto-generated timestamp
  "__v": Number                       // Version key
}
```

## Example Document

```json
{
  "_id": "69480641d335e04c3eed24fe",
  "scheme_name": "Mukhyamantri Kanya Utthan Yojana",
  "scheme_date": "2025-12-01T00:00:00.000Z",
  "gender": "Female",
  "category": "Pension",
  "sub_category": "Aama Yojana",
  "scheme_description": "Mukhyamantri Kanya Utthan Yojana is a flagship welfare initiative...",
  "scheme_objectives": [
    "Promote education among girl children",
    "Reduce school dropout rates",
    "Encourage higher education for girls",
    "Improve health and nutritional awareness",
    "Provide financial assistance to families",
    "Empower women socially and economically"
  ],
  "scheme_benefits": [
    "Direct financial assistance",
    "Educational scholarships",
    "Skill development opportunities",
    "Health and nutrition support"
  ],
  "scheme_eligibility": {
    "lower_age_limit": 5,
    "upper_age_limit": 18
  },
  "scheme_required_document_types": [
    "Aadhaar Card",
    "Birth Certificate",
    "School/College ID",
    "Bank Account Details"
  ],
  "scheme_required_documents": [
    {
      "document_type": "Aadhaar Card",
      "file_url": "public/uploads/user-docs/aadhaar_98347.pdf",
      "uploaded_at": "2026-01-04T17:40:00.000Z"
    }
  ],
  "scheme_image_file_url": "public/uploads/admin-uploads/childDevelopment-1766327873928-783726536.jpeg",
  "createdAt": "2025-12-21T14:37:53.999Z",
  "updatedAt": "2025-12-21T14:37:53.999Z",
  "__v": 0
}
```

## API Endpoints

### GET `/api/schemes`
Returns all schemes with `_id` (not `scheme_id`).

### POST `/api/schemes`
Create a new scheme. Send data matching the structure above.

**Request Body:**
```json
{
  "scheme_name": "Scheme Name",
  "scheme_date": "2025-12-01",
  "gender": "Female",
  "category": "Pension",
  "sub_category": "Aama Yojana",
  "scheme_description": "Description...",
  "scheme_objectives": ["Objective 1", "Objective 2"],
  "scheme_benefits": ["Benefit 1", "Benefit 2"],
  "scheme_eligibility": {
    "lower_age_limit": 5,
    "upper_age_limit": 18
  },
  "scheme_required_document_types": ["Aadhaar Card", "Birth Certificate"],
  "scheme_required_documents": [],
  "scheme_image_file_url": "path/to/image.jpeg"
}
```

### POST `/api/schemes/update`
Update a scheme. Use `_id` in the request body.

**Request Body:**
```json
{
  "_id": "69480641d335e04c3eed24fe",
  "scheme_name": "Updated Name",
  ...
}
```

### POST `/api/schemes/delete`
Delete a scheme. Use `_id` in the request body.

**Request Body:**
```json
{
  "_id": "69480641d335e04c3eed24fe"
}
```

### POST `/api/schemes/deleteImage`
Delete scheme image. Use `_id` in the request body.

**Request Body:**
```json
{
  "_id": "69480641d335e04c3eed24fe"
}
```

## Key Changes from Previous Structure

1. ✅ **Removed IDs**: No more `gender_id`, `category_id`, `sub_category_id` - just use strings
2. ✅ **Simplified fields**: `gender_name` → `gender`, `category_name` → `category`, etc.
3. ✅ **Nested eligibility**: `scheme_eligibility` is now an object with `lower_age_limit` and `upper_age_limit`
4. ✅ **Document types**: Added `scheme_required_document_types` array
5. ✅ **Document objects**: `scheme_required_documents` is now an array of objects with `document_type`, `file_url`, `uploaded_at`
6. ✅ **Direct arrays**: `scheme_objectives` and `scheme_benefits` are direct arrays (no HTML parsing)
7. ✅ **Uses `_id`**: API now uses `_id` directly instead of `scheme_id`

## Notes

- All array fields (`scheme_objectives`, `scheme_benefits`, `scheme_required_document_types`) must be non-empty arrays
- `scheme_required_documents` can be an empty array initially
- `scheme_image_file_url` is optional
- All timestamps are automatically managed by Mongoose

