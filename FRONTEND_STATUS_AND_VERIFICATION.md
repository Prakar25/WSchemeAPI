# Frontend: Status & Verification (Quick Guide)

## 1. What to show in the UI

### User object fields (from profile / login / register APIs)

Every `user` object from these APIs now includes:

| Field | Type | Use |
|-------|------|-----|
| `verificationStatus` | `"pending"` \| `"verified"` \| `"rejected"` | Control what the user can do (e.g. apply to schemes). |
| `accountStatusMessage` | `string` \| `null` | **Exact text to show** when account is not verified. When `verified`, this is `null`. |

**Rule:** Only when `verificationStatus === "verified"` can the user **apply** to schemes. Otherwise they can only **view** schemes.

---

## 2. Show the status message (banner / alert)

Use `accountStatusMessage` so you don’t hardcode copy. Backend sends:

- **Pending:** `"Please verify your account at the nearest CSD Center"`
- **Rejected:** `"Your account verification was rejected. Please contact support."`
- **Verified:** `null` → don’t show a banner

**Example (React):**

```jsx
{user?.accountStatusMessage && (
  <div className="alert alert-warning" role="alert">
    {user.accountStatusMessage}
  </div>
)}
```

Show this wherever the logged-in user context is available (e.g. dashboard, layout, after login/register).

---

## 3. Schemes: view vs apply

- **View schemes:** Allowed for any logged-in user (pending, verified, or rejected).
- **Apply to scheme:** Allowed only when `user.verificationStatus === "verified"`.

**Frontend behaviour:**

- If `user.verificationStatus !== "verified"`:
  - Hide or disable the “Apply” button, **or**
  - Show it but show a message (e.g. `user.accountStatusMessage`) and block submit.
- Optionally show a short line under the scheme: *“Verify your account to apply”* when not verified.

**API behaviour:**

- `POST /api/applications/apply` returns **403** when the user is not verified.
- Response body includes `verificationStatus` and a `message` (e.g. “You must complete verification before applying to schemes…”).

**Example: disable Apply when not verified**

```jsx
const canApply = user?.verificationStatus === "verified";

<Button
  disabled={!canApply}
  onClick={handleApply}
>
  Apply to scheme
</Button>
{!canApply && user?.accountStatusMessage && (
  <p className="text-muted small">{user.accountStatusMessage}</p>
)}
```

**Example: handle 403 from apply**

```jsx
const res = await fetch("/api/applications/apply", { method: "POST", ... });
const data = await res.json();

if (res.status === 403 && data.verificationStatus) {
  // Show data.message or user.accountStatusMessage
  toast.error(data.message || user?.accountStatusMessage);
  return;
}
```

---

## 4. Where you get `user`

`user` (with `verificationStatus` and `accountStatusMessage`) is returned from:

- **Login:** `POST /api/public-auth/login/verify-otp` → `response.user`
- **Register:** `POST /api/public-auth/register/verify-otp` → `response.user`
- **Profile:** `GET /api/public-profile?userId=...` → `response.user`
- **Profile update / submit-complete / document upload:** same `user` shape in the response

Store this `user` in your app state (e.g. React context, Redux, or local state) and use it for the banner and for enabling/disabling Apply.

---

## 5. Status reference (for UI copy / tooltips)

| Status | Meaning | Can view schemes? | Can apply? |
|--------|--------|-------------------|------------|
| `pending` | Not yet verified by CSDAdmin | Yes | No |
| `verified` | Verified at CSD Center | Yes | Yes |
| `rejected` | Verification rejected | Yes | No |

---

## 6. Checklist

- [ ] After login/register, store `user` (including `verificationStatus` and `accountStatusMessage`).
- [ ] Show a single banner/alert when `user?.accountStatusMessage` is present.
- [ ] Allow “View” schemes for all logged-in users.
- [ ] Allow “Apply” only when `user?.verificationStatus === "verified"` (disable button or show message otherwise).
- [ ] On `POST /api/applications/apply`, handle 403 and show the returned message or `accountStatusMessage`.
