# Frontend Prompt: Ads Admin – Auth & Reorder

## Admin Auth

All Ads admin endpoints require the same auth as other admin APIs:

**Headers:**
```
x-admin-username: <admin_username>
x-admin-password: <admin_password>
```

Send these on every request to: `GET /api/ads`, `POST /api/ads`, `PUT /api/ads/:id`, `DELETE /api/ads/:id`, `POST /api/ads/reorder`.

**Example (axios):**
```javascript
const config = {
  headers: {
    "Content-Type": "application/json",
    "x-admin-username": adminUsername,  // from logged-in admin state
    "x-admin-password": adminPassword,  // from logged-in admin state
  },
};
await axios.get("/api/ads", config);
await axios.post("/api/ads", body, config);
```

**Or use an interceptor** so all `/api/ads` admin calls (except `/api/ads/public`) get these headers from stored admin credentials.

Without these headers, the backend returns **401 Unauthorized**.

---

## Reorder Endpoint

**POST /api/ads/reorder**

**Request body:**
```json
{
  "orders": [
    { "id": "ObjectId string", "order": 0 },
    { "id": "ObjectId string", "order": 1 }
  ]
}
```

**Use case:** Allow Super Admin to drag-and-drop or move ads to change display order. After reordering in the UI, call this endpoint with the new `{ id, order }` pairs.

**Response (200):**
```json
{
  "status": "success",
  "message": "Ads reordered",
  "ads": [ /* full ad list in new order */ ]
}
```

The Advertisement page can add a reorder UI (e.g. drag handles, up/down buttons) and call this endpoint on save.
