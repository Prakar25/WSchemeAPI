# Scheme Migration Script

## Overview

This script migrates existing schemes from the old structure (string department/category) to the new structure (ObjectId references).

## What It Does

1. **Finds all schemes** with string-based department/category fields
2. **Matches departments** by `department_display_name` or `department_name`
3. **Matches categories** by `category_display_name` or `category_name`
4. **Updates schemes** with ObjectId references
5. **Removes `sub_category` field** (no longer used)
6. **Validates** that categories belong to their departments

## Prerequisites

1. **Departments must exist** in the database
   - Run `npm run seed:departments` if needed

2. **Categories must exist** in the database
   - Run `npm run seed:categories` if needed

3. **Department-Category relationships** should be set up
   - Categories should be linked to departments
   - The migration script will warn if a category doesn't belong to a department

## How to Run

```bash
npm run migrate:schemes
```

Or directly:
```bash
node scripts/migrateSchemesToObjectIds.js
```

## Before Running

**⚠️ IMPORTANT: Backup your database first!**

This script modifies existing schemes. Make sure you have a backup of your MongoDB database before running the migration.

```bash
# Example MongoDB backup command
mongodump --db wscheme --out ./backup_before_migration
```

## What Happens During Migration

1. Script connects to MongoDB
2. Finds all schemes with string department/category
3. For each scheme:
   - Tries to match department by name
   - Tries to match category by name
   - Updates scheme with ObjectId references
   - Removes `sub_category` field if present
   - Validates department-category relationship
4. Logs success/errors for each scheme
5. Provides summary at the end

## Example Output

```
Connected to MongoDB

🚀 Starting scheme migration...

Found 5 schemes to migrate

Available Departments: 8
Available Categories: 8

✓ Scheme "Mukhyamantri Kanya Utthan Yojana": Department "Social Welfare Department" → 507f1f77bcf86cd799439011
  Category "Pension" → 507f191e810c19729de860ea
  ✅ Migrated successfully

✓ Scheme "Sikkim Youth Employment Scheme": Department "Social Welfare Department" → 507f1f77bcf86cd799439011
  Category "Pension" → 507f191e810c19729de860ea
  ✅ Migrated successfully

...

============================================================
📊 Migration Summary
============================================================
✅ Successfully migrated: 5 schemes
❌ Errors: 0 schemes
📝 Total processed: 5 schemes

✨ Migration completed!
```

## Troubleshooting

### Error: "Department not found"

**Problem:** The department name in your scheme doesn't match any department in the database.

**Solution:**
1. Check department names: `GET /api/departments`
2. Create missing departments or fix department names in schemes
3. Run migration again

### Error: "Category not found"

**Problem:** The category name in your scheme doesn't match any category in the database.

**Solution:**
1. Check category names: `GET /api/categories`
2. Create missing categories or fix category names in schemes
3. Run migration again

### Warning: "Category not associated with department"

**Problem:** The category exists but isn't linked to the department.

**Solution:**
1. Check department categories: `GET /api/departments/:name/categories`
2. Add category to department:
   ```bash
   POST /api/departments/:name/categories
   Body: { "category_ids": ["category_id"] }
   ```
3. Or update department manually to include the category

### Schemes with "Pension" Category

Based on your data, all schemes use:
- Category: "Pension"
- Department: "Social Welfare Department"

**Check if this exists:**
```bash
# Check categories
GET /api/categories
# Look for "Pension" category

# Check departments
GET /api/departments
# Look for "Social Welfare Department"

# Check if category is linked to department
GET /api/departments/social_welfare_department/categories
# Should include "Pension" category
```

## Post-Migration Steps

1. **Verify migration:**
   ```bash
   # Check a scheme
   GET /api/schemes
   # department and category should be objects, not strings
   ```

2. **Fix any errors:**
   - Review error messages from migration
   - Create missing departments/categories
   - Link categories to departments
   - Re-run migration

3. **Test API endpoints:**
   - Create a new scheme
   - Fetch schemes (should have populated department/category)
   - Fetch applications (should have populated scheme data)

## Rollback

If you need to rollback:

1. Restore from backup:
   ```bash
   mongorestore --db wscheme ./backup_before_migration
   ```

2. Or manually update schemes back to strings (not recommended)

## Notes

- The script is **idempotent** - you can run it multiple times safely
- Schemes already using ObjectIds will be skipped
- The script preserves all other scheme data
- `sub_category` field will be removed (scheme name serves as subcategory)

## Support

If you encounter issues:
1. Check the error messages in the console
2. Verify departments and categories exist
3. Check department-category relationships
4. Review the troubleshooting section above
