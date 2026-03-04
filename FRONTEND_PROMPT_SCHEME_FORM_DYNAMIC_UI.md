# Frontend Prompt: Admin Scheme Creation Form – Dynamic Fields & Beautiful UI

## Objective

Implement an **admin scheme creation form** that:
1. Uses a **clean, professional UI** suited for admin users
2. Supports **dynamic form fields** – user adds/removes array items and custom fields via Add/Remove buttons
3. Covers all existing scheme fields and the new per-scheme custom form field definitions

---

## Scope

### 1. Core Form Fields (static)

- Scheme name (text)
- Scheme date (date picker)
- Gender (select: All / Male / Female)
- Department (dropdown from `GET /api/departments`)
- Category (dropdown from `GET /api/categories`)
- Scheme description (textarea)

### 2. Dynamic Array Fields (Add button)

Each of these starts with one input; user can **Add** or **Remove** rows:

- **Objectives** – add/remove objective text inputs
- **Benefits** – add/remove benefit text inputs  
- **Required document types** – add/remove document type inputs (e.g. "Aadhaar Card")

### 3. Per-Scheme Custom Form Fields (Add form field)

Admin can define scheme-specific form inputs (shown to applicants when they apply):

- **Add form field** button appends a new definition row
- Each row has: **Field key** (e.g. `annual_income`), **Label**, **Field type** (text / number / select / date / textarea / checkbox), **Required** toggle, **Options** (for select only)
- **Remove** button per row

### 4. Eligibility

- Lower age limit (number)
- Upper age limit (number)

### 5. Optional

- Excluded schemes (multi-select or dynamic list from `GET /api/schemes/simple`)
- Authorization levels (4 dropdowns as per existing docs)
- Scheme image upload

---

## API Reference

- **Create scheme:** `POST /api/schemes`  
  - Body: JSON with all fields above; see `SCHEME_CREATION_REQUEST_FORMAT.md` and `SCHEME_CREATION_DYNAMIC_FORM_GUIDE.md`
- **Fetch departments:** `GET /api/departments`
- **Fetch categories:** `GET /api/categories`
- **Fetch schemes (for excluded):** `GET /api/schemes/simple?approved_only=true`

---

## UI/UX Requirements

### Overall design

- **Admin-appropriate:** Clear hierarchy, readable typography, sufficient spacing
- **Sections:** Group related fields (e.g. Basic Info, Objectives & Benefits, Eligibility, Custom Form Fields, Optional)
- **Validation:** Inline errors, required field indicators (*), disable submit until valid
- **Feedback:** Success/error toasts or banners after submit
- **Mobile-friendly:** Use responsive layout so it works on tablets

### Dynamic fields

- **Add button:** Prominent but secondary; e.g. outlined button with "+ Add objective"
- **Remove button:** Subtle (e.g. icon-only or small text), per row except when only one row
- **Rows:** Card-like containers or bordered rows for each dynamic item
- **Transitions:** Light animations (e.g. fade/slide) when adding/removing rows

### Custom form fields section

- **Section label:** e.g. "Custom application form fields (optional)"
- **Subtitle:** "Define extra fields applicants must fill when applying to this scheme"
- Each definition in a card or bordered block with:
  - Field key (placeholder: e.g. `income_amount`)
  - Label (placeholder: e.g. "Annual Income (INR)")
  - Type dropdown (Text, Number, Select, Date, Textarea, Checkbox)
  - Required toggle/checkbox
  - Options input (only for Select; placeholder: "Option1, Option2")
  - Remove button
- **Add form field** button at bottom of section

---

## Tech Stack (suggestions only)

- React / Vue / Angular – your existing stack
- Form library (Formik, React Hook Form, etc.) for validation and state
- UI library (Material UI, Ant Design, Chakra, Tailwind components, etc.) for layout, inputs, buttons, cards
- Icons for Add/Remove (e.g. plus, trash) from your icon set

---

## Deliverables

1. Admin scheme creation page with the form as described
2. Integration with `POST /api/schemes` and the required GET endpoints
3. Handling of validation errors (422) and display of user-friendly messages
4. Success flow: redirect or confirmation after successful creation

---

## Reference Docs

- `SCHEME_CREATION_DYNAMIC_FORM_GUIDE.md` – dynamic fields, `custom_form_fields` structure, React examples
- `SCHEME_CREATION_REQUEST_FORMAT.md` – full request body format and TypeScript types
