# Scheme Creation: Dynamic Form Guide (Frontend)

## Overview

When creating a scheme, the form data should be **added dynamically** where the API expects arrays. This guide defines:

1. **All current form fields** (inclusive of existing behaviour) – single-value and array fields.
2. **Dynamic array fields** – user can click **Add** to add another input for objectives, benefits, and required document types.
3. **Per-scheme custom form fields** – each scheme can define its own application form fields (e.g. income, caste, qualification) via Add button.
4. **Submit payload** – how to build the request body for `POST /api/schemes`.

---

## Per-Scheme Dynamic Form Fields

Each scheme can have its **own form fields** that differ from other schemes. These are stored in `custom_form_fields` and define extra inputs shown when an applicant applies.

- **Admin (scheme create/edit):** Use an Add button to add form field definitions (label, type, required, options).
- **Applicant:** The application form is built from `scheme.custom_form_fields`; submitted values are stored in `application.form_data` keyed by `field_key`.

### `custom_form_fields` structure

| Property   | Type    | Required | Notes |
|-----------|---------|----------|-------|
| `field_key`  | string  | Yes      | Unique key (e.g. `income_amount`), used in `form_data` |
| `label`      | string  | Yes      | Display label |
| `type`       | string  | No       | One of: `text`, `number`, `select`, `date`, `textarea`, `checkbox` (default: `text`) |
| `required`   | boolean | No       | Default: `false` |
| `options`    | string or string[] | No | For `select` only – comma-separated string (e.g. `"Male, Female"`) or array |

### Example

```json
{
  "custom_form_fields": [
    { "field_key": "annual_income", "label": "Annual Income (INR)", "type": "number", "required": true },
    { "field_key": "gender", "label": "Gender", "type": "select", "required": true, "options": "Male, Female" },
    { "field_key": "remarks", "label": "Additional Remarks", "type": "textarea", "required": false }
  ]
}
```

### Frontend: Add form field (scheme create/edit)

Provide an Add button that appends a new definition to `custom_form_fields`. Each row should allow editing `field_key`, `label`, `type`, `required`, and `options` (for select; comma-separated string or array), plus Remove.

---

## Form Data Required (Current Behaviour)

### Single-value / fixed fields

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `scheme_name` | string | Yes | Text input |
| `scheme_date` | date (ISO) | No | Date picker |
| `gender` | string | Yes | One of: `"All"`, `"Male"`, `"Female"` |
| `department` | string | Yes | ObjectId from `GET /api/departments` |
| `category` | string | Yes | ObjectId from `GET /api/categories` |
| `scheme_description` | string | Yes | Textarea |
| `scheme_eligibility.lower_age_limit` | number | Yes | Number input |
| `scheme_eligibility.upper_age_limit` | number | Yes | Number input |
| `scheme_image_file_url` | string \| null | No | From file upload |
| `excluded_schemes` | string[] | No | Array of scheme ObjectIds |
| `authorization_levels` | number[] | No (recommended) | Max 4 numbers, 1–8 |
| `approval_status` | string | No | Default: `"pending_department_head_approval"` |
| `custom_form_fields` | object[] | No | Per-scheme form field definitions – see above |

### Array fields (dynamic – Add button)

These are the fields that should be built with **dynamic inputs** and an **Add** button (and optional **Remove** per row):

| Field | Required | Min items | Description |
|-------|----------|-----------|-------------|
| `scheme_objectives` | Yes | 1 | List of objective strings |
| `scheme_benefits` | Yes | 1 | List of benefit strings |
| `scheme_required_document_types` | Yes | 1 | List of document type names |

Optional:

- `scheme_required_documents`: array of `{ document_type, file_url, uploaded_at }` (often empty on create).
- `excluded_schemes`: array of scheme IDs (can be multi-select or dynamic list).
- `custom_form_fields`: array of `{ field_key, label, field_type, required?, options? }` – defines scheme-specific form inputs.

---

## Dynamic Form Behaviour

- **Initial state:** Each array field starts with **one** input (e.g. one objective, one benefit, one document type).
- **Add:** A button “Add objective” / “Add benefit” / “Add document type” appends a new empty input to that array.
- **Remove:** Each row (except the first, if you want to keep at least one) can have a “Remove” button to drop that item.
- **Validation:** Before submit, ensure each of the three required arrays has at least one non-empty string; filter out empty strings when building the payload.

---

## React Example: Dynamic Form with Add Button

Below is a self-contained pattern you can adapt. It keeps **all current fields** and adds **dynamic** behaviour for `scheme_objectives`, `scheme_benefits`, and `scheme_required_document_types`.

```jsx
import { useState } from "react";

// Helper: per-scheme custom form field definitions (Add button for form fields)
function CustomFormFieldsEditor({ fields, onChange }) {
  const add = () =>
    onChange([
      ...fields,
      { field_key: "", label: "", type: "text", required: false, options: "" },
    ]);
  const remove = (index) => onChange(fields.filter((_, i) => i !== index));
  const update = (index, key, value) => {
    const next = [...fields];
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  };

  return (
    <div>
      <label>Custom form fields (add per-scheme inputs)</label>
      {fields.map((f, i) => (
        <div key={i} style={{ border: "1px solid #ccc", padding: 8, marginBottom: 8 }}>
          <input
            placeholder="Field key (e.g. income_amount)"
            value={f.field_key}
            onChange={(e) => update(i, "field_key", e.target.value)}
          />
          <input
            placeholder="Label (e.g. Annual Income)"
            value={f.label}
            onChange={(e) => update(i, "label", e.target.value)}
          />
          <select value={f.type || f.field_type || "text"} onChange={(e) => update(i, "type", e.target.value)}>
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="select">Select</option>
            <option value="date">Date</option>
            <option value="textarea">Textarea</option>
            <option value="checkbox">Checkbox</option>
          </select>
          <label>
            <input type="checkbox" checked={f.required} onChange={(e) => update(i, "required", e.target.checked)} />
            Required
          </label>
          {(f.type || f.field_type) === "select" && (
            <input
              placeholder="Options (comma-separated, e.g. Male, Female)"
              defaultValue={Array.isArray(f.options) ? f.options.join(", ") : f.options || ""}
              onBlur={(e) => update(i, "options", e.target.value)}
            />
          )}
          <button type="button" onClick={() => remove(i)}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={add}>Add form field</button>
    </div>
  );
}

// Helper: dynamic list with Add/Remove
function DynamicStringList({ values, onChange, placeholder, addLabel, minItems = 1 }) {
  const add = () => onChange([...values, ""]);
  const remove = (index) => {
    if (values.length <= minItems) return;
    onChange(values.filter((_, i) => i !== index));
  };
  const update = (index, value) => {
    const next = [...values];
    next[index] = value;
    onChange(next);
  };

  return (
    <div>
      {values.map((value, index) => (
        <div key={index} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <input
            type="text"
            value={value}
            onChange={(e) => update(index, e.target.value)}
            placeholder={placeholder}
            style={{ flex: 1 }}
          />
          {values.length > minItems && (
            <button type="button" onClick={() => remove(index)}>
              Remove
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={add}>
        {addLabel}
      </button>
    </div>
  );
}

export default function SchemeCreationForm() {
  const [formData, setFormData] = useState({
    scheme_name: "",
    scheme_date: "",
    gender: "All",
    department: "",
    category: "",
    scheme_description: "",
    scheme_objectives: [""],
    scheme_benefits: [""],
    scheme_eligibility: { lower_age_limit: 18, upper_age_limit: 65 },
    scheme_required_document_types: [""],
    scheme_required_documents: [],
    scheme_image_file_url: null,
    excluded_schemes: [],
    authorization_levels: [],
    approval_status: "pending_department_head_approval",
    custom_form_fields: [],
  });

  const update = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    const scheme_objectives = formData.scheme_objectives.filter((s) => s.trim() !== "");
    const scheme_benefits = formData.scheme_benefits.filter((s) => s.trim() !== "");
    const scheme_required_document_types = formData.scheme_required_document_types.filter(
      (s) => s.trim() !== ""
    );

    if (scheme_objectives.length === 0 || scheme_benefits.length === 0 || scheme_required_document_types.length === 0) {
      alert("Please add at least one objective, one benefit, and one required document type.");
      return;
    }

    const payload = {
      scheme_name: formData.scheme_name.trim(),
      scheme_date: formData.scheme_date || undefined,
      gender: formData.gender,
      department: formData.department,
      category: formData.category,
      scheme_description: formData.scheme_description.trim(),
      scheme_objectives,
      scheme_benefits,
      scheme_eligibility: formData.scheme_eligibility,
      scheme_required_document_types,
      scheme_required_documents: formData.scheme_required_documents,
      scheme_image_file_url: formData.scheme_image_file_url,
    excluded_schemes: formData.excluded_schemes,
    authorization_levels: formData.authorization_levels,
    approval_status: formData.approval_status,
    custom_form_fields: formData.custom_form_fields || [],
  };

    try {
      const res = await fetch("/api/schemes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create scheme");
      }
      const scheme = await res.json();
      console.log("Scheme created:", scheme);
      // Redirect or reset form...
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to create scheme");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        required
        placeholder="Scheme name"
        value={formData.scheme_name}
        onChange={(e) => update("scheme_name", e.target.value)}
      />
      <input
        type="date"
        value={formData.scheme_date}
        onChange={(e) => update("scheme_date", e.target.value)}
      />
      <select
        value={formData.gender}
        onChange={(e) => update("gender", e.target.value)}
      >
        <option value="All">All</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
      </select>
      <input
        required
        placeholder="Department ID"
        value={formData.department}
        onChange={(e) => update("department", e.target.value)}
      />
      <input
        required
        placeholder="Category ID"
        value={formData.category}
        onChange={(e) => update("category", e.target.value)}
      />
      <textarea
        required
        placeholder="Scheme description"
        value={formData.scheme_description}
        onChange={(e) => update("scheme_description", e.target.value)}
      />

      <label>Objectives (add dynamically)</label>
      <DynamicStringList
        values={formData.scheme_objectives}
        onChange={(v) => update("scheme_objectives", v)}
        placeholder="Objective"
        addLabel="Add objective"
      />

      <label>Benefits (add dynamically)</label>
      <DynamicStringList
        values={formData.scheme_benefits}
        onChange={(v) => update("scheme_benefits", v)}
        placeholder="Benefit"
        addLabel="Add benefit"
      />

      <label>Eligibility (age)</label>
      <input
        type="number"
        placeholder="Lower age"
        value={formData.scheme_eligibility.lower_age_limit}
        onChange={(e) =>
          update("scheme_eligibility", {
            ...formData.scheme_eligibility,
            lower_age_limit: Number(e.target.value),
          })
        }
      />
      <input
        type="number"
        placeholder="Upper age"
        value={formData.scheme_eligibility.upper_age_limit}
        onChange={(e) =>
          update("scheme_eligibility", {
            ...formData.scheme_eligibility,
            upper_age_limit: Number(e.target.value),
          })
        }
      />

      <label>Required document types (add dynamically)</label>
      <DynamicStringList
        values={formData.scheme_required_document_types}
        onChange={(v) => update("scheme_required_document_types", v)}
        placeholder="Document type (e.g. Aadhaar Card)"
        addLabel="Add document type"
      />

      {/* Per-scheme custom form fields – Add button for scheme-specific inputs */}
      <CustomFormFieldsEditor
        fields={formData.custom_form_fields}
        onChange={(v) => update("custom_form_fields", v)}
      />

      {/* Optional: authorization_levels, excluded_schemes, scheme_image_file_url, etc. */}

      <button type="submit">Create scheme</button>
    </form>
  );
}
```

---

## Applicant Form (built from scheme.custom_form_fields)

When an applicant applies to a scheme, fetch the scheme and render inputs from `scheme.custom_form_fields`:

```jsx
function ApplicationForm({ scheme }) {
  const [formData, setFormData] = useState({});

  return (
    <form onSubmit={...}>
      {scheme.custom_form_fields?.map((field) => (
        <div key={field.field_key}>
          <label>{field.label} {field.required && "*"}</label>
          {field.field_type === "text" && (
            <input value={formData[field.field_key] || ""} onChange={(e) => setFormData({ ...formData, [field.field_key]: e.target.value })} />
          )}
          {field.field_type === "number" && (
            <input type="number" value={formData[field.field_key] ?? ""} onChange={...} />
          )}
          {field.field_type === "select" && (
            <select value={formData[field.field_key] || ""} onChange={...}>
              <option value="">Select</option>
              {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          )}
          {/* Similar for date, textarea, checkbox */}
        </div>
      ))}
    </form>
  );
}
```

Submit `formData` as `form_data` when creating the application via `POST /api/applications`.

---

## Summary

- **Data required in the form** is as in the tables above, **inclusive of current behaviour** (all existing fields).
- **Dynamic array fields:** For `scheme_objectives`, `scheme_benefits`, and `scheme_required_document_types`, use **Add** (and **Remove**) buttons.
- **Per-scheme form fields:** Use **Add form field** to define `custom_form_fields` per scheme; each scheme’s application form is rendered from these definitions; applicant values go into `form_data`.
- **Submit:** Filter empty strings, ensure required arrays have at least one item, include `custom_form_fields` in the payload.

For full request/response details and validation rules, see `SCHEME_CREATION_REQUEST_FORMAT.md` and `SCHEME_CREATION_FRONTEND_GUIDE.md`.
