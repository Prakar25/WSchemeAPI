# Excluded Schemes - Quick Reference

## 🎯 Quick Answer

**API to use:** `GET /api/schemes/simple?approved_only=true`

**Purpose:** Fetch list of schemes to populate the excluded_schemes dropdown when creating a scheme.

---

## 📡 API Details

### Endpoint

**Option 1: Get approved schemes only (recommended)**
```
GET /api/schemes/simple?approved_only=true
```

**Option 2: Get all schemes (use if no approved schemes exist)**
```
GET /api/schemes/simple
```

**⚠️ Important:** If `?approved_only=true` returns 0 schemes, your schemes are likely pending approval. Either:
- Remove the filter to see all schemes, OR
- Approve the schemes first

### Response Format
```json
{
  "status": "success",
  "schemes": [
    {
      "_id": "scheme_id_string",
      "scheme_name": "Scheme Name",
      "department": { "department_display_name": "Department Name" },
      "category": { "category_display_name": "Category Name" },
      "approval_status": "approved"
    }
  ],
  "count": 10
}
```

### Usage in Request
When creating a scheme, include `excluded_schemes` as an array of scheme `_id` strings:

```json
{
  "scheme_name": "New Scheme",
  "department": "dept_id",
  "category": "cat_id",
  "excluded_schemes": ["scheme_id_1", "scheme_id_2"],  // ← Array of scheme _id strings
  ...
}
```

---

## 💻 Code Snippet

```javascript
// 1. Fetch schemes
const response = await fetch('/api/schemes/simple?approved_only=true');
const { schemes } = await response.json();

// 2. User selects schemes (multi-select)
// Store selected IDs: ["id1", "id2"]

// 3. Include in scheme creation
const schemeData = {
  scheme_name: "New Scheme",
  excluded_schemes: selectedSchemeIds,  // ["id1", "id2"]
  ...
};
```

---

## ❓ Common Questions

**Q: Is excluded_schemes required?**
A: No, it's optional. Can be `[]` or omitted.

**Q: What format should excluded_schemes be?**
A: Array of scheme `_id` strings: `["id1", "id2"]`

**Q: Should I filter out the current scheme?**
A: Yes, if editing a scheme, don't show it in the excluded schemes list.

**Q: Should I show all schemes or only approved?**
A: Use `?approved_only=true` to show only approved schemes (recommended). However, if you get 0 results, your schemes are likely pending approval. In that case, remove the filter to see all schemes, or approve the schemes first.

**Q: Why am I getting 0 schemes?**
A: Check if your schemes have `approval_status: "approved"`. If they have `"pending_department_head_approval"`, use `/api/schemes/simple` without the filter, or approve the schemes first. See `FRONTEND_EXCLUDED_SCHEMES_TROUBLESHOOTING.md` for details.

---

## 📖 Full Documentation

See `FRONTEND_EXCLUDED_SCHEMES_GUIDE.md` for complete implementation guide with examples.
