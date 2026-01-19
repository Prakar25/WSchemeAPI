# Frontend Team: Scheme Creation Updates - Implementation Prompt

## Summary

The scheme creation API has been enhanced with authorization levels and a Department Head approval workflow. All new schemes require Department Head approval before they become active.

## Key Changes

1. **Authorization Levels**: New required field `authorization_levels` - array of 4 role levels defining who can authorize applications at each stage
2. **Approval Workflow**: All new schemes start with status `pending_department_head_approval` and require Department Head/Admin/Super Admin approval
3. **Creator Tracking**: Tracks who created the scheme and when
4. **New Endpoints**: Added approve/reject endpoints for Department Head

## Quick Implementation Checklist

### 1. Update Scheme Creation Form
- [ ] Add authorization levels selector (4 dropdowns)
  - First: Super Admin (1) or Admin (2) - Dropdown
  - Second: Admin (2) or Department Secretary (3) - Dropdown
  - Third: Department Head (4) - Fixed/Read-only
  - Fourth: DistrictHQ Head (5) - Fixed/Read-only
  - Note: Department User (6) is view-only and not part of authorization chain
- [ ] Add validation for authorization levels
- [ ] Update API call to include `authorization_levels` array
- [ ] Show success message: "Scheme created successfully. Pending Department Head approval."

### 2. Update Scheme Display
- [ ] Show approval status badge (pending/approved/rejected)
- [ ] Show creator information (admin username, creation date) for admin users
- [ ] Display authorization levels in readable format
- [ ] Filter schemes: Public users see only approved schemes; Admin users see all

### 3. Add Approval Interface (Department Head/Department Secretary/Super Admin only)
- [ ] Create "Pending Approvals" page/section
- [ ] List all schemes with `approval_status: "pending_department_head_approval"`
- [ ] Add "Approve" button (PUT `/api/schemes/:id/approve`)
- [ ] Add "Reject" button with reason input (PUT `/api/schemes/:id/reject`)
- [ ] Show approval/rejection details (who, when, reason)

### 4. Role-Based Access Control
- [ ] Show approve/reject buttons only to: Department Head, Department Secretary, Super Admin
- [ ] Hide pending/rejected schemes from public users
- [ ] Show all schemes (including pending/rejected) to admin users

## API Endpoints

**Create Scheme:**
```
POST /api/schemes
Headers: x-admin-username, x-admin-password
Body: { ..., authorization_levels: [1, 2, 4, 5] }
```

**Approve Scheme:**
```
PUT /api/schemes/:id/approve
Headers: x-admin-username, x-admin-password
(Department Head/Admin/Super Admin only)
```

**Reject Scheme:**
```
PUT /api/schemes/:id/reject
Headers: x-admin-username, x-admin-password
Body: { rejection_reason: "..." }
(Department Head/Admin/Super Admin only)
```

## Authorization Levels Format

The `authorization_levels` array must contain exactly 4 integers:
- Position 0: `1` (Super Admin) or `2` (Admin)
- Position 1: `2` (Admin) or `3` (Department Secretary)
- Position 2: `4` (Department Head) - Fixed
- Position 3: `5` (DistrictHQ Head) - Fixed

**Role Hierarchy:** 1=Super Admin, 2=Admin, 3=Dept Secretary, 4=Dept Head, 5=DistrictHQ Head, 6=Dept User (view-only), 7=Overlookers, 8=Post Operator

Example: `[1, 2, 4, 5]` or `[2, 3, 4, 5]`

## New Scheme Fields

```typescript
{
  authorization_levels: number[];  // [1, 2, 4, 5] format
  approval_status: "pending_department_head_approval" | "approved" | "rejected";
  created_by: {
    admin_id: string;
    admin_username: string;
    admin_role: string;
    created_at: Date;
  };
  department_head_approval: {
    approved_by: string | null;
    approved_by_username: string | null;
    approved_at: Date | null;
    rejection_reason: string | null;
  } | null;
}
```

## Full Documentation

See `SCHEME_CREATION_FRONTEND_GUIDE.md` for:
- Detailed API documentation
- Example code snippets
- TypeScript type definitions
- UI/UX recommendations
- Testing checklist
- Migration notes for existing schemes

## Priority

**High Priority:**
1. Update scheme creation form with authorization levels
2. Add approval/rejection interface for Department Head
3. Update scheme display to show approval status

**Medium Priority:**
4. Add filters for approval status
5. Display creator information
6. Enhanced approval status UI (badges, colors)

---

**Questions?** Refer to the full guide: `SCHEME_CREATION_FRONTEND_GUIDE.md`
