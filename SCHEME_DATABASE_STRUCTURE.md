# Scheme Database Structure

## Current Database Structure

The Scheme collection stores welfare scheme information with the following structure:

```javascript
{
  "_id": ObjectId,                    // MongoDB auto-generated ID
  "scheme_name": String,              // Name of the scheme
  "scheme_date": Date,                // Date of the scheme
  "gender_id": Number,                // Gender ID (1=Male, 2=Female, etc.)
  "gender_name": String,              // Gender name
  "category_id": Number,              // Category ID
  "category_name": String,            // Category name
  "sub_category_id": Number,          // Sub-category ID
  "sub_category_name": String,        // Sub-category name
  "scheme_description": String,       // Full description
  "scheme_objectives": [String],      // Array of objectives (NEW FORMAT)
  "scheme_benefits": [String],        // Array of benefits (NEW FORMAT)
  "scheme_eligibility_lower_age_limit": Number,
  "scheme_eligibility_upper_age_limit": Number,
  "scheme_required_documents": [String], // Array of documents (NEW FORMAT)
  "scheme_image_file_url": String,    // Image file path
  "createdAt": Date,                  // Auto-generated timestamp
  "updatedAt": Date,                  // Auto-generated timestamp
  "__v": Number                       // Version key
}
```

---

## Why Are There HTML Strings in the Database?

### The Problem

You're seeing HTML strings like this in your database:
```json
{
  "scheme_objectives": "<div>\n<div>1. Promote education</div>\n<div>2. Reduce dropout rates</div>\n</div>"
}
```

**This happens because:**
1. **Old data format**: Records created before the schema update still have HTML strings
2. **Frontend was sending HTML**: The frontend was likely sending HTML-formatted strings instead of arrays
3. **No migration run**: The migration script hasn't been executed yet to convert existing data

---

## The Solution

### 1. Schema Update (✅ Already Done)

The schema now expects **arrays** instead of strings:
```javascript
scheme_objectives: [String]      // Array of strings
scheme_benefits: [String]        // Array of strings  
scheme_required_documents: [String] // Array of strings
```

### 2. Automatic Conversion (✅ Already Implemented)

The model now:
- **Accepts arrays** (preferred format)
- **Accepts HTML strings** (backward compatible - auto-converts to arrays)
- **Converts on read** - Existing HTML strings are converted to arrays when retrieved via API
- **Converts on save** - HTML strings are converted to arrays when saving

### 3. Database Migration (⚠️ Needs to be Run)

To permanently convert existing HTML strings in the database to arrays, run:

```bash
node scripts/migrateSchemeData.js
```

This will:
- Find all schemes with HTML strings
- Convert them to clean arrays
- Update the database permanently

---

## Expected Format After Migration

### Before (Current - HTML Strings)
```json
{
  "scheme_objectives": "<div>\n<div>1. Promote education</div>\n<div>2. Reduce dropout rates</div>\n</div>",
  "scheme_benefits": "<div>\n<div>1. Financial assistance</div>\n<div>2. Scholarships</div>\n</div>",
  "scheme_required_documents": "<div>\n<div>1. Aadhaar Card</div>\n<div>2. Birth Certificate</div>\n</div>"
}
```

### After (Target - Arrays)
```json
{
  "scheme_objectives": [
    "1. Promote education",
    "2. Reduce dropout rates"
  ],
  "scheme_benefits": [
    "1. Financial assistance",
    "2. Scholarships"
  ],
  "scheme_required_documents": [
    "1. Aadhaar Card",
    "2. Birth Certificate"
  ]
}
```

---

## How It Works Now

### When Creating/Updating Schemes

**Option 1: Send Arrays (Recommended)**
```javascript
POST /api/schemes
{
  "scheme_objectives": ["Objective 1", "Objective 2"],
  "scheme_benefits": ["Benefit 1", "Benefit 2"],
  "scheme_required_documents": ["Doc 1", "Doc 2"]
}
```

**Option 2: Send HTML (Still Works - Auto-converted)**
```javascript
POST /api/schemes
{
  "scheme_objectives": "<div><div>Objective 1</div><div>Objective 2</div></div>",
  "scheme_benefits": "<div><div>Benefit 1</div><div>Benefit 2</div></div>"
}
// Will be automatically converted to arrays
```

### When Reading Schemes

The API **always returns arrays**, even if the database still has HTML strings:

```javascript
GET /api/schemes
// Response:
{
  "scheme_objectives": ["Objective 1", "Objective 2"],  // Always arrays
  "scheme_benefits": ["Benefit 1", "Benefit 2"],        // Always arrays
  "scheme_required_documents": ["Doc 1", "Doc 2"]        // Always arrays
}
```

---

## Steps to Fix Your Database

### Step 1: Run the Migration Script

```bash
cd /Users/prakarpradhan/CompanyProject/WelfareDeptProject/WSchemeAPI
node scripts/migrateSchemeData.js
```

### Step 2: Verify the Results

After migration, check your database. All HTML strings should be converted to arrays.

### Step 3: Update Frontend (If Needed)

Make sure your frontend is sending arrays, not HTML strings:

```javascript
// ✅ Good
scheme_objectives: ["Item 1", "Item 2"]

// ❌ Bad (but will still work)
scheme_objectives: "<div>Item 1</div><div>Item 2</div>"
```

---

## Summary

| Aspect | Status |
|--------|--------|
| **Schema** | ✅ Updated to use arrays |
| **Auto-conversion** | ✅ Works on read and save |
| **API Response** | ✅ Always returns arrays |
| **Database Migration** | ⚠️ **Run the script to convert existing data** |
| **Frontend** | ⚠️ Should send arrays (HTML still works) |

---

## Questions?

- **Q: Why are there still HTML strings in the database?**  
  A: Because the migration script hasn't been run yet. Run it to convert existing data.

- **Q: Will the API work with old HTML data?**  
  A: Yes! The API automatically converts HTML to arrays when reading.

- **Q: Should I update the frontend?**  
  A: Yes, update the frontend to send arrays instead of HTML strings for consistency.

- **Q: What happens if I don't run the migration?**  
  A: The API will still work (auto-converts on read), but the database will still contain HTML strings. It's better to run the migration for cleaner data.

