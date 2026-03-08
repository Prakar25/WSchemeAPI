# Frontend Prompt: ApplyToScheme Dynamic Form (Driven by Backend)

## Objective

Make the scheme application form **dynamic** – driven by `scheme.custom_form_fields` from the backend instead of hardcoded static fields.

---

## Current Gap

| What | Current (Static) | Desired (Dynamic) |
|------|------------------|-------------------|
| **Custom form fields** | 5 hardcoded: Annual Income, Number of Family Members, Household Type, Education Level, Employment Status | Rendered from `scheme.custom_form_fields` – each scheme can have different fields |
| **Documents section** | Uses `scheme.scheme_required_document_types` | Same – already dynamic, keep as-is |

---

## Backend Contract

### 1. Scheme response includes `custom_form_fields`

`GET /api/schemes` and `GET /api/schemes/:id` return schemes with:

```json
{
  "_id": "...",
  "scheme_name": "...",
  "custom_form_fields": [
    {
      "field_key": "annual_income",
      "title": "Annual Income (INR)",
      "label": "Annual Income (INR)",
      "field_type": "number",
      "required": true,
      "options": []
    },
    {
      "field_key": "household_type",
      "title": "Household Type",
      "label": "Household Type",
      "field_type": "select",
      "required": true,
      "options": ["Nuclear", "Joint", "Extended"]
    },
    {
      "field_key": "which_scheme_name",
      "title": "Which scheme name?",
      "field_type": "text",
      "required": true,
      "depends_on": { "field_key": "are_you_applying_to_another_scheme", "value": true }
    }
  ],
  "scheme_required_document_types": ["Aadhaar Card", "Income Certificate"],
  ...
}
```

**Note:** Use `title` for display; backend derives `field_key` from title (spaces→_). For dependent fields, use `depends_on: { field_key, value }` – the field shows only when the parent matches. See `docs/CUSTOM_FORM_FIELDS_SPEC.md`.

### 2. Apply endpoint accepts `form_data`

`POST /api/applications/apply` body:

```json
{
  "user_id": "...",
  "scheme_id": "...",
  "form_data": {
    "annual_income": 150000,
    "household_type": "Nuclear"
  },
  "documents_submitted": [
    {
      "document_type": "Aadhaar Card",
      "file_url": "/uploads/..."
    }
  ]
}
```

`form_data` keys must match `field_key` from each `custom_form_fields` entry.

---

## Field types to support

| `field_type` | Render as | Value type |
|--------------|-----------|------------|
| `text` | `<input type="text">` | string |
| `number` | `<input type="number">` | number |
| `textarea` | `<textarea>` | string |
| `select` | `<select>` with `options` | string |
| `date` | `<input type="date">` | string (ISO or YYYY-MM-DD) |
| `checkbox` | `<input type="checkbox">` | boolean |

---

## Implementation Steps

### 1. Remove hardcoded static fields

Delete or replace the 5 static fields in ApplyToScheme.page.jsx:

- Annual Income
- Number of Family Members
- Household Type
- Education Level
- Employment Status

### 2. Render form from `scheme.custom_form_fields`

- If `scheme.custom_form_fields` is empty or missing → show no custom inputs (or a message: "No additional fields required")
- Otherwise, iterate over `scheme.custom_form_fields` and render one input per field
- Use `field_key` as the key in `form_data`, `title` or `label` for the label, `field_type` for input type, `required` for validation
- **Dependent fields:** Only show a field if it has no `depends_on`, or if `formData[depends_on.field_key] === depends_on.value` (for checkbox, treat true/1/"true"/"yes" as checked)

### 3. Keep documents section as-is

Continue using `scheme.scheme_required_document_types` for document uploads. This is already dynamic.

### 4. Submit `form_data` with correct keys

On submit, build:

```js
form_data = {
  [field.field_key]: value  // for each field in custom_form_fields
}
```

Send this as `form_data` in the apply request body.

---

## React Example: Dynamic application form

```jsx
function ApplyFormFields({ scheme, formData, setFormData }) {
  const fields = scheme?.custom_form_fields || [];

  if (fields.length === 0) {
    return null; // or "No additional fields required"
  }

  const update = (fieldKey, value) => {
    setFormData(prev => ({ ...prev, [fieldKey]: value }));
  };

  const isVisible = (field) => {
    const dep = field.depends_on;
    if (!dep?.field_key) return true;
    const parentVal = formData[dep.field_key];
    const target = dep.value;
    if (field.field_type === "checkbox" || fields.find((f) => f.field_key === dep.field_key)?.field_type === "checkbox") {
      const checked = parentVal === true || parentVal === 1 || parentVal === "true" || parentVal === "yes";
      return (target === true || target === 1 || target === "true" || target === "yes") === checked;
    }
    return String(parentVal) === String(target);
  };

  return (
    <div>
      {fields.filter(isVisible).map((field) => {
        const key = field.field_key;
        const type = field.field_type || field.type || "text";
        const value = formData[key];
        const label = field.title || field.label || key;

        return (
          <div key={key} className="form-group">
            <label>
              {label} {field.required && "*"}
            </label>
            {type === "text" && (
              <input
                type="text"
                value={value ?? ""}
                onChange={(e) => update(key, e.target.value)}
                required={field.required}
              />
            )}
            {type === "number" && (
              <input
                type="number"
                value={value ?? ""}
                onChange={(e) => update(key, e.target.value ? Number(e.target.value) : "")}
                required={field.required}
              />
            )}
            {type === "textarea" && (
              <textarea
                value={value ?? ""}
                onChange={(e) => update(key, e.target.value)}
                required={field.required}
              />
            )}
            {type === "select" && (
              <select
                value={value ?? ""}
                onChange={(e) => update(key, e.target.value)}
                required={field.required}
              >
                <option value="">Select...</option>
                {(field.options || []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}
            {type === "date" && (
              <input
                type="date"
                value={value ?? ""}
                onChange={(e) => update(key, e.target.value)}
                required={field.required}
              />
            )}
            {type === "checkbox" && (
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) => update(key, e.target.checked)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// In ApplyToScheme page:
const [formData, setFormData] = useState({});

// In form JSX:
<ApplyFormFields
  scheme={scheme}
  formData={formData}
  setFormData={setFormData}
/>

// On submit:
const payload = {
  user_id,
  scheme_id,
  form_data: formData,  // keys = field_key from custom_form_fields
  documents_submitted: uploadedDocs,
};
await fetch("/api/applications/apply", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
```

---

## Validation

- For `required: true` fields, validate before submit (or use HTML5 `required`)
- Optional: validate `number` type is numeric, `select` value is in options
- Backend does not enforce per-field validation; frontend should ensure required fields are filled

---

## Migration note

Existing schemes may have empty `custom_form_fields`. In that case, the application form will only show the documents section. Admins should add `custom_form_fields` when creating/editing schemes if they want scheme-specific inputs.

---

## Summary

1. **Remove** the 5 static hardcoded fields.
2. **Render** inputs from `scheme.custom_form_fields` by `field_type` (text, number, select, date, textarea, checkbox).
3. **Use** `field_key` as keys in `form_data`.
4. **Keep** documents section using `scheme.scheme_required_document_types`.
5. **Submit** `form_data` and `documents_submitted` to `POST /api/applications/apply`.
