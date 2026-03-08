# custom_form_fields – Backend Spec

## Overview

`custom_form_fields` defines per-scheme application form inputs. The backend supports:

1. **Title → field_key**: Send `title` (display label); backend derives `field_key` from it (spaces → `_`).
2. **Multiple fields**: All items in the array are stored.
3. **Dependent fields**: A field can depend on another; it only shows/validates when the parent has a specific value.

---

## Structure

| Property    | Type   | Required | Description |
|------------|--------|----------|-------------|
| `title`    | string | Yes*     | Display label (e.g. "Scheme Name"). *Use `title` or `label` |
| `field_key`| string | No       | Key in `form_data`. If omitted, derived from title: "Scheme Name" → `scheme_name` |
| `field_type`| string| No       | `text`, `number`, `select`, `date`, `textarea`, `checkbox` (default: `text`) |
| `required` | boolean| No      | Default: `false` |
| `options`  | string \| string[] | No | For `select` only |
| `depends_on` | object | No | Conditional visibility – see below |

### field_key derivation

- Spaces → `_`
- Lowercase
- Non-alphanumeric (except `_`) removed

Examples:
- "Annual Income" → `annual_income`
- "Which scheme are you applying to?" → `which_scheme_are_you_applying_to`

---

## Dependent Fields (depends_on)

A field is only shown and validated when its parent field matches a value.

```json
{
  "depends_on": {
    "field_key": "applied_to_other_scheme",
    "value": true
  }
}
```

**Example: "Which scheme?" only when "Applied to other" is checked**

```json
{
  "custom_form_fields": [
    {
      "title": "Are you applying to another scheme?",
      "field_type": "checkbox",
      "required": false
    },
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

- First field: `title` "Are you applying to another scheme?" → `field_key` = `are_you_applying_to_another_scheme`
- Second field: shown only when that checkbox is true; when shown, `required: true` applies.

**For select**: `depends_on.value` can be the selected option string.

---

## Request Format (POST/PUT schemes)

```json
{
  "custom_form_fields": [
    { "title": "Annual Income (INR)", "field_type": "number", "required": true },
    { "title": "Are you applying to another scheme?", "field_type": "checkbox" },
    {
      "title": "Which scheme name?",
      "field_type": "text",
      "required": true,
      "depends_on": { "field_key": "are_you_applying_to_another_scheme", "value": true }
    }
  ]
}
```

---

## Response Format

Backend returns normalized fields with both `title` and `field_key`:

```json
{
  "custom_form_fields": [
    {
      "field_key": "annual_income_inr",
      "title": "Annual Income (INR)",
      "label": "Annual Income (INR)",
      "field_type": "number",
      "required": true,
      "options": [],
      "depends_on": null
    },
    {
      "field_key": "are_you_applying_to_another_scheme",
      "title": "Are you applying to another scheme?",
      "label": "Are you applying to another scheme?",
      "field_type": "checkbox",
      "required": false,
      "options": []
    },
    {
      "field_key": "which_scheme_name",
      "title": "Which scheme name?",
      "label": "Which scheme name?",
      "field_type": "text",
      "required": true,
      "options": [],
      "depends_on": {
        "field_key": "are_you_applying_to_another_scheme",
        "value": true
      }
    }
  ]
}
```

---

## Validation (apply)

When validating `form_data` for `POST /api/applications/apply`:

- Fields with `depends_on`: validated only when parent matches.
- When parent does not match: field is skipped (no required check, not stored).
- Use `field_key` as keys in `form_data`.
