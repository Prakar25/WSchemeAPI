# Frontend Changes: custom_form_fields Updates

## Summary

The backend updated `custom_form_fields` with:
1. **title** instead of label – display label; backend derives `field_key` from title
2. **Multiple fields** – all items in the array are stored
3. **Dependent fields** – a field can show only when another field has a specific value (e.g. "Which scheme?" only when "Applied to other" is checked)

---

## 1. Scheme Creation/Edit Form (Admin)

### What to Change

| Before | After |
|--------|-------|
| `label` required | Use **`title`** (or `label`) for display |
| `field_key` required, entered manually | **Optional** – backend derives from title (spaces→_) |
| No conditional fields | Support **`depends_on`** when adding a field |

### Request Payload (POST /api/schemes, POST /api/schemes/update)

```json
{
  "custom_form_fields": [
    { "title": "Annual Income (INR)", "field_type": "number", "required": true },
    { "title": "Are you applying to another scheme?", "field_type": "checkbox" },
    {
      "title": "Which scheme name?",
      "field_type": "text",
      "required": true,
      "depends_on": {
        "field_key": "are_you_applying_to_another_scheme",
        "value": true
      }
    }
  ]
}
```

### Admin Form UI

- **Add field**: Show inputs for `title`, `field_type`, `required`, `options` (for select)
- **field_key**: Optional. If omitted, backend derives from title.
- **depends_on** (new): Optional section when adding a field:
  - Parent field: dropdown of other `field_key`s in the form
  - Value: for checkbox use `true`, for select use the option string
- Keep **Add** and **Remove** per field; all fields in the array are stored.

---

## 2. Apply to Scheme Form (Applicant)

### What to Change

| Before | After |
|--------|-------|
| `field.label` for display | Use **`field.title`** or `field.label` |
| All fields always visible | **Hide** fields with `depends_on` when parent doesn't match |
| Single flat list | Re-render when parent value changes (e.g. checkbox toggled) |

### Visibility Logic

Only show a field if:

- It has no `depends_on`, OR
- `formData[depends_on.field_key]` equals `depends_on.value`

For **checkbox** parents, treat `true`, `1`, `"true"`, `"yes"` as checked.

```js
function isVisible(field, formData) {
  const dep = field.depends_on;
  if (!dep?.field_key) return true;
  const parentVal = formData[dep.field_key];
  const target = dep.value;
  // Checkbox: compare as boolean
  if (field.field_type === "checkbox" || parentField?.field_type === "checkbox") {
    const checked = [true, 1, "true", "yes"].includes(parentVal);
    return ([true, 1, "true", "yes"].includes(target)) === checked;
  }
  return String(parentVal) === String(target);
}
```

### Apply Form UI

1. Loop over `scheme.custom_form_fields`
2. Filter with `isVisible` before rendering
3. Use `field.title || field.label` for label
4. Use `field_key` as the key in `form_data`
5. When the user toggles a checkbox (or changes a select) that other fields depend on, re-render so dependent fields appear/disappear

### Submit

`form_data` keys must match `field_key`. Only include visible fields (backend validates the same way).

---

## 3. Checklist

### Scheme Create/Edit (Admin)

- [ ] Use `title` instead of (or alongside) `label` when sending `custom_form_fields`
- [ ] Make `field_key` optional – backend derives from title if omitted
- [ ] Add optional `depends_on` config when adding a field (parent field_key + value)
- [ ] Ensure all fields in the array are sent (multiple fields are stored)

### Apply to Scheme (Applicant)

- [ ] Use `field.title || field.label` for field labels
- [ ] Implement `isVisible` and only render fields that pass it
- [ ] Re-render when parent field value changes (so dependent fields appear/disappear)
- [ ] Keep `form_data` keys as `field_key`

---

## 4. Example: Full Flow

**Admin creates scheme** with:
1. Checkbox: "Are you applying to another scheme?"
2. Text: "Which scheme name?" – depends on checkbox = true

**Backend stores** (field_key derived):
- `are_you_applying_to_another_scheme` (checkbox)
- `which_scheme_name` (text, depends_on: { field_key: "are_you_applying_to_another_scheme", value: true })

**Applicant sees**:
- Checkbox first
- Text field appears only when checkbox is checked
- On submit: `form_data: { are_you_applying_to_another_scheme: true, which_scheme_name: "Student Scholarship" }`
