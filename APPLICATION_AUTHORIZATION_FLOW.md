# Application Authorization Flow Documentation

## Current Application Verification Workflow

When a public user applies to a scheme, the application goes through a multi-stage verification process. Currently, the workflow is **hardcoded** and follows this sequence:

### Current Hardcoded Flow

| Stage | Verification Level | Required Roles | Role Levels | Description |
|-------|-------------------|----------------|-------------|-------------|
| **1. Applied** | 0 | Post Operator, District Overlookers | 7, 8 | Initial application submitted by public user |
| **2. Post Operator Review** | 7 or 8 | Post Operator, District Overlookers | 7, 8 | First verification by lowest level admins |
| **3. Admin Review** | 1 or 2 | Super Admin, Admin | 1, 2 | Review by system administrators |
| **4. District Head Review** | 6 | DistrictHQ Head | 6 | Review by district headquarters |
| **5. Department Review** | 4 or 5 | Department Head, Department User | 4, 5 | Review by department staff |
| **6. Secretary Review** | 3 | Department Secretary | 3 | Final review by department secretary |
| **7. Completed** | 99 | - | - | Application approved/rejected |

### Current Flow Sequence (from code)

```
Applied (0)
  ↓
Post Operator Review (7/8)
  ↓
Admin Review (1/2)
  ↓
District Head Review (6)
  ↓
Department Review (4/5)
  ↓
Secretary Review (3)
  ↓
Completed (99)
```

## Issue: Hardcoded vs Scheme-Specific Authorization

**Current Problem:**
- The verification workflow is **hardcoded** in the Application model
- It doesn't use the scheme's `authorization_levels` field
- All schemes follow the same verification flow regardless of their authorization configuration

**Expected Behavior:**
- Each scheme should have its own authorization flow based on `authorization_levels`
- The application verification should follow the scheme's specific authorization sequence

## Scheme Authorization Levels

Based on the scheme creation, each scheme has `authorization_levels` array:

```javascript
authorization_levels: [first, second, third, fourth]
// Example: [1, 2, 4, 5]
```

Where:
- **First:** 1 (Super Admin) or 2 (Admin) - Dropdown selection
- **Second:** 2 (Admin) or 3 (Department Secretary) - Dropdown selection
- **Third:** 4 (Department Head) - Fixed
- **Fourth:** 5 (DistrictHQ Head) - Fixed

**Note:** Department User (6) is view-only and not part of the authorization chain.

## Proposed Flow Using Scheme Authorization Levels

### Flow Sequence

For a scheme with `authorization_levels: [1, 2, 4, 5]`:

| Stage | Verification Level | Required Roles | Role Levels | Description |
|-------|-------------------|----------------|-------------|-------------|
| **1. Applied** | 0 | - | - | Initial application submitted |
| **2. First Authorization** | 1 or 2 | Super Admin or Admin | 1 or 2 | First level verification (from scheme config) |
| **3. Second Authorization** | 2 or 3 | Admin or Department Secretary | 2 or 3 | Second level verification (from scheme config) |
| **4. Third Authorization** | 4 | Department Head | 4 | Third level verification (from scheme config) |
| **5. Fourth Authorization** | 5 | DistrictHQ Head | 5 | Final verification (from scheme config) |
| **6. Completed** | 99 | - | - | Application approved/rejected |

### Example Flow

For `authorization_levels: [1, 2, 4, 5]`:

```
Applied (0)
  ↓
Super Admin Review (1)  ← First level from scheme
  ↓
Admin Review (2)        ← Second level from scheme
  ↓
Department Head Review (4)  ← Third level from scheme
  ↓
DistrictHQ Head Review (5)  ← Fourth level from scheme
  ↓
Completed (99)
```

For `authorization_levels: [2, 3, 4, 5]`:

```
Applied (0)
  ↓
Admin Review (2)       ← First level from scheme
  ↓
Department Secretary Review (3)  ← Second level from scheme
  ↓
Department Head Review (4)  ← Third level from scheme
  ↓
DistrictHQ Head Review (5)  ← Fourth level from scheme
  ↓
Completed (99)
```

## Current Implementation Details

### Application Model Fields

```javascript
{
  verification_level: Number,  // Current verification level (0, 7, 8, 1, 2, 6, 4, 5, 3, 99)
  verification_stage: String,   // Legacy field (backward compatibility)
  verification_history: [{
    stage: String,
    verified_by: ObjectId,
    verified_by_name: String,
    verified_by_role: String,
    verified_by_role_level: Number,
    action: String,  // "Verified", "Rejected", "Forwarded", "Returned"
    remarks: String,
    verified_at: Date
  }],
  current_verifier: {
    verified_by: ObjectId,
    verified_by_name: String,
    verified_by_role: String,
    verified_by_role_level: Number,
    remarks: String,
    verified_at: Date
  }
}
```

### Helper Functions (Current)

**`getStageNameFromLevel(level)`** - Maps verification level to stage name:
- 0 → "Applied"
- 7, 8 → "Post_Operator_Review"
- 1, 2 → "Admin_Review"
- 6 → "District_Head_Review"
- 4, 5 → "Department_Review"
- 3 → "Secretary_Review"
- 99 → "Completed"

**`getRequiredRoleLevels(level)`** - Returns required role levels for a verification level:
- 0 → [7, 8]
- 7, 8 → [7, 8]
- 1, 2 → [1, 2]
- 6 → [6]
- 4, 5 → [4, 5]
- 3 → [3]
- 99 → []

### Next Level Logic (Current)

```javascript
if (currentLevel === 7 || currentLevel === 8) nextLevel = 1;
else if (currentLevel === 1 || currentLevel === 2) nextLevel = 6;
else if (currentLevel === 6) nextLevel = 4;
else if (currentLevel === 4 || currentLevel === 5) nextLevel = 3;
else if (currentLevel === 3) nextLevel = 99;
```

## Required Changes

To make the application flow use scheme-specific authorization levels:

### 1. Update Application Model

- Add reference to scheme's `authorization_levels` when creating application
- Store the scheme's authorization flow in the application
- Update `getRequiredRoleLevels()` to use scheme's authorization_levels instead of hardcoded values

### 2. Update Verification Flow Logic

- When application is created, initialize with first level from scheme's `authorization_levels[0]`
- When verified, move to next level from scheme's `authorization_levels` array
- Remove hardcoded next level logic

### 3. Update API Endpoints

- `POST /api/applications` - Store scheme's authorization_levels with application
- `PUT /api/applications/:id/verify` - Use scheme's authorization flow
- `GET /api/applications/:id/next-stage-admins` - Return admins based on scheme's next authorization level

## Questions to Clarify

1. **Initial Stage:** Should applications still start with Post Operator (7/8) review, or go directly to the first level in `authorization_levels`?

2. **Post Operator Role:** Should Post Operator (7/8) and District Overlookers (7) be part of the authorization flow, or only handle initial application submission?

3. **Flow Direction:** Should the flow always follow the exact sequence in `authorization_levels`, or can higher-level admins skip stages?

4. **Department User:** Since Department User (6) is view-only, should they be able to view applications but not verify them?

## Recommendation

**Option 1: Scheme-Specific Flow (Recommended)**
- Applications follow the exact sequence defined in scheme's `authorization_levels`
- No Post Operator review (or make it optional)
- Flow: Applied → First Level → Second Level → Third Level → Fourth Level → Completed

**Option 2: Hybrid Approach**
- Keep Post Operator (7/8) as initial review
- Then follow scheme's `authorization_levels` for subsequent stages
- Flow: Applied → Post Operator (7/8) → First Level → Second Level → Third Level → Fourth Level → Completed

**Option 3: Current Flow with Override**
- Keep current hardcoded flow as default
- Allow schemes to override specific stages using `authorization_levels`
- More complex but backward compatible

---

**Next Steps:**
1. Confirm which approach to use
2. Update Application model to store scheme's authorization_levels
3. Update verification flow logic to use scheme-specific levels
4. Update API endpoints accordingly
5. Test with different scheme configurations
