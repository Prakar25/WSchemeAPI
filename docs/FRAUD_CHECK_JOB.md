# Scheduled Fraud / Redundancy Check

## Overview

A cron job runs **4 times per day** to detect:

1. **Duplicate applications** – same `user_id` + `scheme_id` more than once
2. **Ineligible claims** – applications that fail eligibility re-check (e.g. scheme rules changed, user data updated)

Results are stored in the `FraudCheckRun` collection for audit and review.

---

## Schedule

Default: **6:00, 12:00, 18:00, 00:00** (4x daily)

Cron expression: `0 6,12,18,0 * * *`

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FRAUD_CHECK_ENABLED` | Enable/disable the scheduled job | `true` |
| `FRAUD_CHECK_CRON` | Cron expression for schedule | `0 6,12,18,0 * * *` |
| `FRAUD_CHECK_RUN_ON_START` | Run once immediately on server start (for testing) | `false` |

**Disable the job:**
```
FRAUD_CHECK_ENABLED=false
```

**Custom schedule (e.g. every 6 hours):**
```
FRAUD_CHECK_CRON=0 */6 * * *
```

---

## Admin Endpoints

### GET /api/admin/dashboard/fraud-check-runs

List recent fraud check runs (audit log).

**Query:** `limit` (default 20, max 100)

**Response:**
```json
{
  "status": "success",
  "data": {
    "runs": [
      {
        "runAt": "2025-03-02T12:00:00.000Z",
        "duplicatesFound": 2,
        "ineligibleFound": 5,
        "status": "success",
        "durationMs": 1234,
        "alerts": [...]
      }
    ]
  }
}
```

### POST /api/admin/dashboard/fraud-check/run

Manually trigger a fraud check. Returns 202 immediately; job runs in background. Results appear in fraud-check-runs.

---

## FraudCheckRun Model

Stored in MongoDB for each run:

- `runAt` – when the run started
- `duplicatesFound` – count of duplicate applications
- `ineligibleFound` – count of ineligible claims
- `alerts` – array of alert objects (type, applicantName, applicationId, schemeName, reason, etc.)
- `status` – `success` or `error`
- `errorMessage` – if status is error
- `durationMs` – run duration
