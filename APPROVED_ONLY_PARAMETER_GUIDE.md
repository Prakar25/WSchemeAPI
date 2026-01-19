# `approved_only` Parameter - Complete Guide

## 📋 Overview

The `approved_only` query parameter is available on endpoints that return schemes. It filters to show only schemes with `approval_status: "approved"`.

---

## ✅ Endpoints with `approved_only` Parameter

### 1. GET /api/schemes/simple

**Purpose:** Get simple list of schemes for dropdowns (e.g., excluded_schemes)

**Usage:**
```bash
GET /api/schemes/simple?approved_only=true
```

**Behavior:**
- `?approved_only=true` → Returns only approved schemes
- No parameter → Returns all schemes (pending, approved, rejected)

**Example:**
```javascript
// Get only approved schemes
const response = await fetch('/api/schemes/simple?approved_only=true');

// Get all schemes
const response = await fetch('/api/schemes/simple');
```

---

### 2. GET /api/departments/:department_name/schemes

**Purpose:** Get all schemes for a specific department

**Usage:**
```bash
GET /api/departments/education_department/schemes?approved_only=true
```

**Behavior:**
- `?approved_only=true` → Returns only approved schemes for the department
- `?status=approved` → Same as `approved_only=true`
- `?status=pending_department_head_approval` → Returns pending schemes
- `?status=rejected` → Returns rejected schemes
- No parameter → Returns all schemes

**Example:**
```javascript
// Get only approved schemes for a department
const response = await fetch(
  '/api/departments/education_department/schemes?approved_only=true'
);

// Get all schemes for a department
const response = await fetch(
  '/api/departments/education_department/schemes'
);
```

---

## ❌ Endpoints WITHOUT `approved_only` Parameter

### GET /api/schemes

**Note:** The main `GET /api/schemes` endpoint does **NOT** support `approved_only` parameter.

**Current behavior:**
- Returns all schemes regardless of approval status
- Supports `user_id` parameter for filtering by excluded schemes

**If you need approved-only from this endpoint:**
- Filter on the frontend after fetching
- Or use `GET /api/schemes/simple?approved_only=true` instead

---

## 📊 Parameter Comparison

| Endpoint | `approved_only` | `status` | `active_only` | Notes |
|----------|----------------|---------|---------------|-------|
| `GET /api/schemes` | ❌ No | ❌ No | ❌ No | Returns all schemes |
| `GET /api/schemes/simple` | ✅ Yes | ❌ No | ❌ No | Simple list for dropdowns |
| `GET /api/departments/:name/schemes` | ✅ Yes | ✅ Yes | ❌ No | Can use either parameter |
| `GET /api/departments` | ❌ No | ❌ No | ✅ Yes | Uses `active_only` for departments |
| `GET /api/categories` | ❌ No | ❌ No | ✅ Yes | Uses `active_only` for categories |

---

## 💡 Usage Examples

### Example 1: Fetch Approved Schemes for Excluded Schemes Dropdown

```javascript
// ✅ Use this endpoint
const response = await fetch('/api/schemes/simple?approved_only=true');
const { schemes } = await response.json();
```

### Example 2: Fetch Approved Schemes for a Department

```javascript
// ✅ Use this endpoint
const response = await fetch(
  '/api/departments/education_department/schemes?approved_only=true'
);
const { schemes } = await response.json();
```

### Example 3: Fetch All Schemes (Including Pending)

```javascript
// Remove the parameter
const response = await fetch('/api/schemes/simple');
const { schemes } = await response.json();
```

---

## 🔍 Parameter Format

**Accepted values:**
- `approved_only=true` ✅
- `approved_only=1` ✅
- `approved_only=false` → Returns all schemes
- `approved_only=0` → Returns all schemes
- No parameter → Returns all schemes

**Note:** The parameter is case-insensitive for the value, but the parameter name is case-sensitive.

---

## ⚠️ Important Notes

1. **Default Behavior:**
   - If `approved_only` is not provided, all schemes are returned (pending, approved, rejected)

2. **Empty Results:**
   - If `?approved_only=true` returns 0 schemes, it means no schemes are approved yet
   - Solution: Remove the parameter or approve schemes first

3. **Status Values:**
   - `"pending_department_head_approval"` - Scheme is pending approval
   - `"approved"` - Scheme is approved and active
   - `"rejected"` - Scheme was rejected

4. **Alternative to `approved_only`:**
   - Use `?status=approved` on department schemes endpoint (same result)

---

## 📝 Quick Reference

```javascript
// ✅ Has approved_only
GET /api/schemes/simple?approved_only=true
GET /api/departments/:name/schemes?approved_only=true

// ❌ Does NOT have approved_only
GET /api/schemes
GET /api/departments
GET /api/categories
```

---

## 🎯 Recommendation

**For excluded_schemes dropdown:**
- Use: `GET /api/schemes/simple?approved_only=true`
- If 0 results, remove the parameter to see all schemes

**For department scheme listings:**
- Use: `GET /api/departments/:name/schemes?approved_only=true`
- Or use: `GET /api/departments/:name/schemes?status=approved`
