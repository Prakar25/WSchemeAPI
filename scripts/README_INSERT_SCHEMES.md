# Insert Existing Schemes Script

## Overview

This script inserts your existing schemes into the database with the updated structure:
- ✅ Removes `sub_category` field (no longer used)
- ✅ Converts `category` and `department` to ObjectId references
- ✅ Adds `approval_status` field (set to "approved")
- ✅ Adds `created_by` field with admin user info
- ✅ Adds `department_head_approval` for approved schemes

## Prerequisites

1. **Departments must exist** in the database
   - Run `npm run seed:departments` if needed

2. **Categories must exist** in the database
   - Run `npm run seed:categories` if needed

3. **Admin user must exist** in the database
   - The script will use the first admin user it finds

## How to Run

```bash
npm run insert:schemes
```

Or directly:
```bash
node scripts/insertExistingSchemes.js
```

## What the Script Does

1. **Connects to MongoDB**

2. **Checks/creates required resources:**
   - Checks if "Pension" category exists (creates if not)
   - Checks if "Social Welfare Department" exists (creates if not)
   - Links "Pension" category to "Social Welfare Department"

3. **Converts scheme data:**
   - Removes `sub_category` field
   - Converts `category: "Pension"` → `category: ObjectId`
   - Converts `department: "Social Welfare Department"` → `department: ObjectId`
   - Sets `approval_status: "approved"`
   - Adds `created_by` field with admin user info
   - Adds `department_head_approval` for approved schemes

4. **Inserts schemes** into the database

5. **Displays results** with populated department and category info

## Expected Output

```
Connected to MongoDB

🚀 Starting scheme insertion...

Available Departments: 8
Available Categories: 8

✅ Found category: Pension (69652454b19f52b831b4ce4d)
✅ Found department: Social Welfare Department (69652457fc10b345178f75a5)
✅ 'Pension' category already linked to 'Social Welfare Department'
✅ Using admin user: admin (69652450b19f52b831b4ce4a)

📝 Prepared 5 schemes for insertion

✅ Successfully inserted 5 schemes:

Mukhyamantri Kanya Utthan Yojana
  Department: Social Welfare Department (69652457fc10b345178f75a5)
  Category: Pension (69652454b19f52b831b4ce4d)
  Approval Status: approved
  ID: 69652500b19f52b831b4ce5a

Sikkim Youth Employment Scheme
  Department: Social Welfare Department (69652457fc10b345178f75a5)
  Category: Pension (69652454b19f52b831b4ce4d)
  Approval Status: approved
  ID: 69652501b19f52b831b4ce5b

...

✨ All schemes inserted successfully!

Total Schemes: 5
```

## Data Mapping

**Original Data:**
```json
{
  "category": "Pension",
  "department": "Social Welfare Department",
  "sub_category": "Aama Yojana"
}
```

**New Data:**
```json
{
  "category": ObjectId("69652454b19f52b831b4ce4d"),
  "department": ObjectId("69652457fc10b345178f75a5"),
  "approval_status": "approved",
  "created_by": {
    "admin_id": ObjectId("..."),
    "admin_username": "admin",
    "admin_role": "Admin",
    "created_at": "2026-01-15T..."
  },
  "department_head_approval": {
    "approved_by": ObjectId("..."),
    "approved_by_username": "admin",
    "approved_at": "2026-01-15T..."
  }
}
```

## Notes

- **Subcategory removed:** The `sub_category` field is not included in the new schema
- **ObjectId references:** Department and category are stored as ObjectId references, not strings
- **Approval status:** All schemes are set to `"approved"` status
- **Created by:** Uses the first admin user found in the database
- **Department-Category link:** The script ensures "Pension" category is linked to "Social Welfare Department"

## Troubleshooting

### Error: "No departments found"
**Solution:** Run `npm run seed:departments` first

### Error: "No categories found"
**Solution:** Run `npm run seed:categories` first

### Error: "No admin user found"
**Solution:** Create an admin user first

### Error: "Department not found"
**Solution:** Check if "Social Welfare Department" exists, or create it manually

### Error: "Category not found"
**Solution:** Check if "Pension" category exists, or the script will create it

## Verification

After running the script, verify the data:

```bash
# Check schemes
GET /api/schemes

# Check schemes with populated department/category
GET /api/schemes/simple

# Check approved schemes only
GET /api/schemes/simple?approved_only=true
```

## Clean Up (if needed)

If you need to re-run the script, delete existing schemes first:

```bash
# Using MongoDB shell
db.schemes.deleteMany({})

# Or via API (if you have delete endpoint)
```
