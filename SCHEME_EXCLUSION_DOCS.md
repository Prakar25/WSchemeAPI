# Scheme Department and Exclusion Features

## New Fields Added to Scheme Model

### 1. Department Field
- **Field Name:** `department`
- **Type:** String
- **Required:** Yes
- **Description:** The department that manages this scheme
- **Example:** "Health Department", "Education Department", "Social Welfare Department"

### 2. Excluded Schemes Field
- **Field Name:** `excluded_schemes`
- **Type:** Array of ObjectIds (references to Scheme)
- **Required:** No (defaults to empty array)
- **Description:** List of scheme IDs. If a user has applied to any of these schemes, they become ineligible to view/apply to this scheme.

## How Excluded Schemes Work

### Logic
1. When a scheme has `excluded_schemes` defined, it means users who have applied to any of those excluded schemes cannot apply to this scheme.
2. The system checks if the user has any active applications (status: "Applied", "Under Review", "Approved", or "Pending") to any of the excluded schemes.
3. If found, the user is marked as ineligible for the current scheme.

### Example Scenario

```javascript
// Scheme A
{
  "scheme_name": "Maternity Benefit Scheme",
  "excluded_schemes": ["scheme_b_id", "scheme_c_id"]
}

// If user has applied to Scheme B or Scheme C, they cannot apply to Scheme A
```

## Updated Scheme Model Structure

```javascript
{
  "_id": "scheme_id",
  "scheme_name": "Scheme Name",
  "scheme_date": "2025-12-01",
  "gender": "Female",
  "category": "Pension",
  "sub_category": "Aama Yojana",
  "department": "Health Department",  // ← NEW
  "scheme_description": "...",
  "scheme_objectives": [...],
  "scheme_benefits": [...],
  "scheme_eligibility": {
    "lower_age_limit": 18,
    "upper_age_limit": 35
  },
  "scheme_required_document_types": [...],
  "scheme_required_documents": [...],
  "scheme_image_file_url": "...",
  "excluded_schemes": [  // ← NEW
    "other_scheme_id_1",
    "other_scheme_id_2"
  ],
  "createdAt": "...",
  "updatedAt": "..."
}
```

## API Endpoints

### GET `/api/schemes`
Get all schemes. Optionally filter by user to exclude schemes where user has applied to excluded schemes.

**Query Parameters:**
- `user_id` (optional) - If provided, filters out schemes where user has applied to excluded schemes

**Example:**
```bash
# Get all schemes
GET /api/schemes

# Get schemes filtered for a specific user (excludes incompatible schemes)
GET /api/schemes?user_id=507f1f77bcf86cd799439011
```

### Eligibility Check
The eligibility check now includes excluded schemes validation:

```javascript
// Returns eligibility result with reason
{
  eligible: false,
  reason: "User has applied to incompatible scheme(s). Cannot apply to this scheme."
}
```

## Creating/Updating Schemes

### Creating a Scheme with Department and Excluded Schemes

```json
POST /api/schemes
{
  "scheme_name": "Child Care Support",
  "department": "Social Welfare Department",
  "category": "Child Care",
  "sub_category": "Support",
  "gender": "All",
  "scheme_description": "...",
  "scheme_objectives": ["Objective 1", "Objective 2"],
  "scheme_benefits": ["Benefit 1", "Benefit 2"],
  "scheme_eligibility": {
    "lower_age_limit": 0,
    "upper_age_limit": 6
  },
  "scheme_required_document_types": ["Aadhaar Card", "Birth Certificate"],
  "excluded_schemes": [
    "507f1f77bcf86cd799439011",  // Scheme ID 1
    "507f1f77bcf86cd799439012"   // Scheme ID 2
  ]
}
```

### Updating Excluded Schemes

```json
POST /api/schemes/update
{
  "_id": "scheme_id",
  "excluded_schemes": [
    "new_excluded_scheme_id_1",
    "new_excluded_scheme_id_2"
  ]
}
```

## Validation Rules

1. **Self-Exclusion Prevention:** A scheme cannot exclude itself (handled automatically by pre-save hook)
2. **Department Required:** Department field is required when creating/updating schemes
3. **Excluded Schemes:** Must be valid Scheme ObjectIds

## Eligibility Checking

The eligibility check now includes:

1. ✅ Age requirements
2. ✅ Gender requirements
3. ✅ Income limits
4. ✅ Economic category
5. ✅ **Excluded schemes check** (NEW)

If a user has applied to any scheme in the `excluded_schemes` array, they are automatically marked as ineligible.

## Utility Functions

Located in `utils/eligibilityUtils.js`:

- `checkEligibility(user, scheme, userId)` - Comprehensive eligibility check including excluded schemes
- `hasAppliedToExcludedSchemes(userId, excludedSchemeIds)` - Check if user has applied to excluded schemes
- `calculateAge(dob)` - Calculate age from date of birth

## Database Indexes

New indexes added for performance:
- `department` - For filtering by department
- `scheme_type` - For filtering by STATE/CENTRAL

## Usage Examples

### Frontend: Filtering Schemes for User

```javascript
// Get schemes for a specific user (automatically filters excluded schemes)
const response = await axios.get(`/api/schemes?user_id=${userId}`);
const availableSchemes = response.data; // Excludes incompatible schemes
```

### Backend: Checking Eligibility

```javascript
const { checkEligibility } = require('./utils/eligibilityUtils');

const result = await checkEligibility(user, scheme, userId);
if (!result.eligible) {
  console.log(`Not eligible: ${result.reason}`);
}
```

## Notes

- Excluded schemes check only applies if `user_id` is provided
- The check looks for applications with status: "Applied", "Under Review", "Approved", or "Pending"
- Rejected applications don't count as exclusions
- The system prevents circular exclusions (scheme A excludes B, B cannot exclude A if A already excludes B)

