# Frontend Guide: Excluded Schemes Implementation

## 📋 Overview

When creating a scheme, you can specify **excluded schemes** - schemes that, if a user has already applied to them, will prevent the user from seeing/ applying to the current scheme.

---

## 🔌 API Endpoint

### GET /api/schemes/simple

**Purpose:** Fetch available schemes for the excluded_schemes dropdown/selector

**Endpoint:** `GET /api/schemes/simple`

**Authentication:** Not required

**Query Parameters:**
- `approved_only` (optional): `true` or `1` - Only return approved schemes
  - ⚠️ **Note:** If you have no approved schemes, this will return 0 results
  - If schemes are pending approval, omit this parameter to see all schemes

**Example Request:**
```bash
# Get only approved schemes (recommended for production)
GET /api/schemes/simple?approved_only=true

# Get all schemes (use if no approved schemes exist yet)
GET /api/schemes/simple
```

**Response:**
```json
{
  "status": "success",
  "schemes": [
    {
      "_id": "695aa876115881c70e034e10",
      "scheme_name": "Mukhyamantri Kanya Utthan Yojana",
      "department": {
        "_id": "dept_id",
        "department_name": "social_welfare_department",
        "department_display_name": "Social Welfare Department"
      },
      "category": {
        "_id": "cat_id",
        "category_name": "social_welfare",
        "category_display_name": "Social Welfare"
      },
      "approval_status": "approved"
    },
    {
      "_id": "695aa8ce115881c70e034e12",
      "scheme_name": "Sikkim Youth Employment Scheme",
      "department": {
        "_id": "dept_id",
        "department_name": "social_welfare_department",
        "department_display_name": "Social Welfare Department"
      },
      "category": {
        "_id": "cat_id",
        "category_name": "social_welfare",
        "category_display_name": "Social Welfare"
      },
      "approval_status": "approved"
    }
  ],
  "count": 2
}
```

---

## 📝 Implementation Steps

### Step 1: Fetch Schemes on Component Mount

```javascript
import { useState, useEffect } from 'react';

function SchemeCreationForm() {
  const [availableSchemes, setAvailableSchemes] = useState([]);
  const [selectedExcludedSchemes, setSelectedExcludedSchemes] = useState([]);

  useEffect(() => {
    fetchExcludedSchemesOptions();
  }, []);

  const fetchExcludedSchemesOptions = async () => {
    try {
      const response = await fetch('/api/schemes/simple?approved_only=true');
      const data = await response.json();
      
      if (data.status === 'success') {
        setAvailableSchemes(data.schemes);
      }
    } catch (error) {
      console.error('Error fetching schemes:', error);
    }
  };
}
```

### Step 2: Display Schemes in Multi-Select Component

**Option A: Multi-Select Dropdown**
```javascript
<select 
  multiple 
  value={selectedExcludedSchemes}
  onChange={(e) => {
    const selected = Array.from(e.target.selectedOptions, option => option.value);
    setSelectedExcludedSchemes(selected);
  }}
>
  <option value="">Select excluded schemes (optional)</option>
  {availableSchemes.map(scheme => (
    <option key={scheme._id} value={scheme._id}>
      {scheme.scheme_name} - {scheme.department.department_display_name}
    </option>
  ))}
</select>
```

**Option B: Checkbox List (Recommended)**
```javascript
<div className="excluded-schemes-selector">
  <label>Excluded Schemes (Optional)</label>
  <p className="help-text">
    Users who have applied to these schemes will not see this scheme
  </p>
  
  {availableSchemes.map(scheme => (
    <label key={scheme._id} className="checkbox-label">
      <input
        type="checkbox"
        checked={selectedExcludedSchemes.includes(scheme._id)}
        onChange={(e) => {
          if (e.target.checked) {
            setSelectedExcludedSchemes([...selectedExcludedSchemes, scheme._id]);
          } else {
            setSelectedExcludedSchemes(
              selectedExcludedSchemes.filter(id => id !== scheme._id)
            );
          }
        }}
      />
      <div>
        <strong>{scheme.scheme_name}</strong>
        <span className="scheme-meta">
          {scheme.department.department_display_name} • {scheme.category.category_display_name}
        </span>
      </div>
    </label>
  ))}
</div>
```

**Option C: Searchable Multi-Select (Best UX)**
```javascript
// Using a library like react-select or similar
import Select from 'react-select';

const schemeOptions = availableSchemes.map(scheme => ({
  value: scheme._id,
  label: `${scheme.scheme_name} (${scheme.department.department_display_name})`,
  scheme: scheme
}));

<Select
  isMulti
  options={schemeOptions}
  value={schemeOptions.filter(opt => selectedExcludedSchemes.includes(opt.value))}
  onChange={(selected) => {
    setSelectedExcludedSchemes(selected.map(opt => opt.value));
  }}
  placeholder="Select excluded schemes (optional)"
  isSearchable
  isClearable
/>
```

### Step 3: Include in Scheme Creation Request

```javascript
const createScheme = async (formData) => {
  const schemeData = {
    scheme_name: formData.scheme_name,
    department: selectedDepartment._id,  // or department name
    category: selectedCategory._id,      // or category name
    authorization_levels: [1, 2, 4, 5],
    excluded_schemes: selectedExcludedSchemes,  // Array of scheme _id strings
    // ... other fields
  };

  const response = await fetch('/api/schemes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-username': adminUsername,
      'x-admin-password': adminPassword
    },
    body: JSON.stringify(schemeData)
  });

  const result = await response.json();
  return result;
};
```

---

## 📋 Request Body Format

When creating/updating a scheme:

```json
{
  "scheme_name": "New Welfare Scheme",
  "department": "department_object_id_or_name",
  "category": "category_object_id_or_name",
  "authorization_levels": [1, 2, 4, 5],
  "excluded_schemes": [
    "695aa876115881c70e034e10",
    "695aa8ce115881c70e034e12"
  ],
  // ... other scheme fields
}
```

**Notes:**
- `excluded_schemes` is an **array of scheme ObjectId strings**
- It's **optional** - can be empty array `[]` or omitted
- Array should contain valid scheme `_id` values from `/api/schemes/simple`

---

## 💡 Complete Example

```javascript
import React, { useState, useEffect } from 'react';

function SchemeCreationForm() {
  const [availableSchemes, setAvailableSchemes] = useState([]);
  const [selectedExcludedSchemes, setSelectedExcludedSchemes] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch available schemes for excluded_schemes dropdown
  useEffect(() => {
    const fetchSchemes = async () => {
      try {
        const response = await fetch('/api/schemes/simple?approved_only=true');
        const data = await response.json();
        
        if (data.status === 'success') {
          setAvailableSchemes(data.schemes);
        }
      } catch (error) {
        console.error('Error fetching schemes:', error);
      }
    };

    fetchSchemes();
  }, []);

  const handleSubmit = async (formData) => {
    setLoading(true);
    try {
      const schemeData = {
        scheme_name: formData.scheme_name,
        department: formData.department,
        category: formData.category,
        authorization_levels: formData.authorization_levels,
        excluded_schemes: selectedExcludedSchemes,  // Array of IDs
        // ... other fields
      };

      const response = await fetch('/api/schemes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-username': formData.username,
          'x-admin-password': formData.password
        },
        body: JSON.stringify(schemeData)
      });

      const result = await response.json();
      
      if (response.ok) {
        alert('Scheme created successfully!');
        // Reset form
        setSelectedExcludedSchemes([]);
      } else {
        alert(`Error: ${result.message || result.error}`);
      }
    } catch (error) {
      console.error('Error creating scheme:', error);
      alert('Failed to create scheme');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Other form fields */}
      
      {/* Excluded Schemes Section */}
      <div className="form-section">
        <label>Excluded Schemes (Optional)</label>
        <p className="help-text">
          If a user has applied to any of these schemes, they will not see this scheme.
        </p>
        
        <div className="schemes-list">
          {availableSchemes.map(scheme => (
            <label key={scheme._id} className="checkbox-item">
              <input
                type="checkbox"
                checked={selectedExcludedSchemes.includes(scheme._id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedExcludedSchemes([...selectedExcludedSchemes, scheme._id]);
                  } else {
                    setSelectedExcludedSchemes(
                      selectedExcludedSchemes.filter(id => id !== scheme._id)
                    );
                  }
                }}
              />
              <div className="scheme-info">
                <div className="scheme-name">{scheme.scheme_name}</div>
                <div className="scheme-meta">
                  {scheme.department.department_display_name} • {scheme.category.category_display_name}
                </div>
              </div>
            </label>
          ))}
        </div>
        
        {availableSchemes.length === 0 && (
          <p className="empty-state">No schemes available</p>
        )}
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Scheme'}
      </button>
    </form>
  );
}
```

---

## 🎨 UI/UX Recommendations

### 1. **Display Format**
- Show scheme name prominently
- Show department and category as secondary info
- Use clear visual hierarchy

### 2. **Helper Text**
- Explain what excluded schemes mean
- Example: "Users who have applied to selected schemes will not see this scheme"

### 3. **Validation**
- No validation needed (optional field)
- Can be empty array `[]`
- Only include valid scheme IDs

### 4. **Loading States**
- Show loading indicator while fetching schemes
- Show empty state if no schemes available
- Disable form submission while loading

### 5. **Error Handling**
- Handle API errors gracefully
- Show user-friendly error messages
- Log errors for debugging

---

## ❓ FAQ

**Q: Is excluded_schemes required?**
A: No, it's optional. You can send an empty array `[]` or omit it.

**Q: What if I send invalid scheme IDs?**
A: The API will accept them, but validation should happen on the frontend. Only include IDs from `/api/schemes/simple` response.

**Q: Should I filter out the current scheme being created?**
A: Yes, if editing an existing scheme, filter out its own ID from the available schemes list to prevent self-exclusion.

**Q: Can I use scheme names instead of IDs?**
A: No, `excluded_schemes` must be an array of scheme ObjectId strings (the `_id` field).

**Q: When should I fetch schemes?**
A: Fetch when the form loads, or when user clicks to select excluded schemes. Consider caching the result.

**Q: Should I show all schemes or only approved ones?**
A: Recommended to use `?approved_only=true` to only show approved schemes, as users typically shouldn't be excluded based on pending schemes.

---

## 🔍 TypeScript Types

```typescript
interface SchemeForExcluded {
  _id: string;
  scheme_name: string;
  department: {
    _id: string;
    department_name: string;
    department_display_name: string;
  };
  category: {
    _id: string;
    category_name: string;
    category_display_name: string;
  };
  approval_status: "pending_department_head_approval" | "approved" | "rejected";
}

interface SchemesListResponse {
  status: "success";
  schemes: SchemeForExcluded[];
  count: number;
}

interface SchemeCreationData {
  scheme_name: string;
  department: string;  // ObjectId or name
  category: string;    // ObjectId or name
  authorization_levels: number[];
  excluded_schemes?: string[];  // Array of scheme ObjectIds
  // ... other fields
}
```

---

## 📚 Related APIs

- **GET /api/schemes/simple** - Fetch schemes for excluded_schemes dropdown
- **POST /api/schemes** - Create scheme with excluded_schemes
- **GET /api/schemes** - Get all schemes (for reference)

---

## ✅ Checklist

- [ ] Add `GET /api/schemes/simple` API call in scheme creation form
- [ ] Create multi-select component for excluded schemes
- [ ] Store selected scheme IDs in state
- [ ] Include `excluded_schemes` array in scheme creation request
- [ ] Handle loading and error states
- [ ] Add helper text explaining excluded schemes
- [ ] Test with multiple scheme selections
- [ ] Test with empty selection (optional field)
- [ ] Filter out current scheme if editing

---

**Need Help?** Refer to `COMPLETE_FRONTEND_API_CHANGES.md` for all API changes.
