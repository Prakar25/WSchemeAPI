# Categories Seed Data

This directory contains demo/seed data for populating the Categories database.

## Files

- **`seedCategories.js`** - Script to seed categories into the database
- **`seedCategoriesData.js`** - Demo data file (can be imported separately)

## Usage

### Option 1: Using npm script (Recommended)

```bash
npm run seed:categories
```

### Option 2: Direct execution

```bash
node scripts/seedCategories.js
```

## What Gets Seeded

The script will create **8 categories** with **34 total subcategories**:

1. **Education** (5 subcategories)
   - Scholarship
   - Tuition Fee Assistance
   - School Supplies
   - Book Bank
   - Uniform Assistance

2. **Health** (5 subcategories)
   - Medical Insurance
   - Vaccination Programs
   - Maternal Health
   - Child Health
   - Elderly Care

3. **Social Welfare** (4 subcategories)
   - Pension Schemes
   - Disability Support
   - Orphan Support
   - Widow Support

4. **Housing** (3 subcategories)
   - Pradhan Mantri Awas Yojana
   - Housing Loan Subsidy
   - Slum Redevelopment

5. **Employment** (4 subcategories)
   - Skill Development
   - Entrepreneurship Support
   - Job Placement
   - Unemployment Benefit

6. **Women Empowerment** (4 subcategories)
   - Financial Literacy
   - Self Help Groups
   - Microfinance
   - Vocational Training

7. **Agriculture** (4 subcategories)
   - Crop Insurance
   - Farm Subsidies
   - Irrigation Support
   - Loan Waiver

8. **Food Security** (4 subcategories)
   - Ration Card
   - Mid-Day Meal
   - Maternity Benefit
   - Child Nutrition

## Important Notes

⚠️ **The script will DELETE all existing categories before inserting new ones.**

If you want to keep existing data, comment out the delete line in `seedCategories.js`:

```javascript
// Comment out this line to keep existing categories
// const deleteResult = await Category.deleteMany({});
```

## Using the Data Directly

You can also import just the data:

```javascript
const { demoCategories } = require('./scripts/seedCategoriesData');

// Use demoCategories array as needed
```

## Environment Requirements

Make sure your `.env` file has the correct MongoDB connection string:

```
MONGODB_URI=mongodb://localhost:27017/wscheme
```

## Verification

After seeding, verify the data:

```bash
# Using curl
curl http://localhost:3000/api/categories

# Or using the API directly
GET /api/categories
```

## Example API Calls After Seeding

```bash
# Get all categories
GET /api/categories

# Get simple categories list
GET /api/categories/simple

# Get all subcategories
GET /api/categories/subcategories

# Get subcategories for Education category
GET /api/categories/subcategories?category=education

# Get specific category
GET /api/categories/education
```
