# Admin Applications Access API - Frontend Guide

## Overview

This document explains how admins can access and view applications through the API, including department-based filtering rules and authentication requirements.

**Endpoint:** `GET /api/applications`  
**Authentication:** Required (Admin credentials)

---

## Authentication

All requests to this endpoint require admin authentication. Credentials can be provided via:

- **Headers:**
  - `x-admin-username`: Admin username
  - `x-admin-password`: Admin password

- **Query Parameters:**
  - `username`: Admin username
  - `password`: Admin password

- **Request Body:**
  - `username`: Admin username
  - `password`: Admin password

---

## Access Rules

### Viewing Applications

**All admins can VIEW applications** regardless of their role level. However, the applications they see are filtered based on their role and department:

| Admin Role | Role Level | Department Access |
|------------|------------|-------------------|
| Super Admin | 1 | ✅ All departments |
| Admin | 2 | ✅ All departments |
| Department Secretary | 3 | ✅ All departments |
| Department Head | 4 | ❌ Only own department |
| Department User | 5 | ❌ Only own department |
| DistrictHQ Head | 6 | ❌ Only own department |
| District Overlookers | 7 | ❌ Only own department |
| Post Operator | 8 | ❌ Only own department |

### Key Points:

1. **Secretary (level 3) and above** (Secretary, Admin, Super Admin): Can view applications from **ALL departments**
2. **Below Secretary (level > 3)**: Can only view applications from their **own department**
3. **Verification/Acceptance**: Only admins with the appropriate role level can verify/accept/forward applications (this is handled separately in the verify endpoint)

---

## API Endpoint

### GET /api/applications

Fetch all applications with optional filters.

**Request:**

```http
GET /api/applications?username=admin.username&password=Admin@123
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | String | Yes | Admin username (for auth) |
| `password` | String | Yes | Admin password (for auth) |
| `user_id` | String | No | Filter by user ID (ObjectId) |
| `scheme_id` | String | No | Filter by scheme ID (ObjectId) |
| `status` | String | No | Filter by status (`Applied`, `Under Review`, `Approved`, `Rejected`, `Pending`) |
| `verification_stage` | String | No | Filter by verification stage |
| `assigned_to_me` | Boolean | No | If `true`, only returns applications assigned to the current admin |

**Response:**

```json
{
  "status": "success",
  "data": [
    {
      "_id": "application_id",
      "user_id": {
        "_id": "user_id",
        "demographics": {
          "fullName": "John Doe",
          "gender": "M",
          "dob": "1990-01-01T00:00:00.000Z"
        },
        "aadhaarNumber": "123456789012",
        "contact": {
          "mobile": {
            "value": "9876543210",
            "verified": true
          },
          "email": {
            "value": "john@example.com",
            "verified": true
          }
        }
      },
      "scheme_id": {
        "_id": "scheme_id",
        "scheme_name": "Student Scholarship Scheme",
        "scheme_type": "Education",
        "category": "69652454b19f52b831b4ce4d",
        "department": "69652457fc10b345178f75a5"
      },
      "status": "Under Review",
      "verification_level": 1,
      "verification_stage": "Admin_Review",
      "current_verifier": {
        "_id": "admin_id",
        "fullName": "Admin User",
        "username": "admin.user",
        "role": "Admin"
      },
      "date_applied": "2025-01-15T10:30:00.000Z",
      "form_data": {},
      "documents_submitted": [],
      "applicantName": "John Doe",
      "applicantId": "user_id",
      "schemeName": "Student Scholarship Scheme",
      "schemeId": "scheme_id",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-16T09:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

## Department Filtering Logic

### How It Works

1. The API fetches all applications (based on query filters)
2. For admins with role level **> 3** (below Secretary):
   - Applications are filtered to only include those where `scheme.department` matches the admin's `department`
   - Both `scheme.department` and `admin.department` are stored as **ObjectId strings** (e.g., `"69652457fc10b345178f75a5"`)
   - Comparison is done via direct string match (case-sensitive)
3. For admins with role level **≤ 3** (Secretary, Admin, Super Admin):
   - All applications are returned (no department filtering)

### Important Notes:

- **Department fields are ObjectId strings**, not department names
- If an admin's `department` field is `null` or empty, they will see no applications (if role level > 3)
- Department filtering happens **after** fetching applications, so it's applied in-memory

---

## Frontend Implementation Examples

### React/TypeScript Example

```typescript
interface Application {
  _id: string;
  user_id: {
    _id: string;
    demographics: {
      fullName: string;
      gender: string;
      dob: string;
    };
    aadhaarNumber: string;
    contact: {
      mobile: { value: string; verified: boolean };
      email: { value: string; verified: boolean };
    };
  };
  scheme_id: {
    _id: string;
    scheme_name: string;
    scheme_type?: string;
    category: string;
    department: string;
  };
  status: string;
  verification_level: number;
  verification_stage: string;
  current_verifier?: {
    _id: string;
    fullName: string;
    username: string;
    role: string;
  };
  date_applied: string;
  form_data: Record<string, any>;
  documents_submitted: any[];
  applicantName: string;
  applicantId: string;
  schemeName: string;
  schemeId: string;
  createdAt: string;
  updatedAt: string;
}

interface ApplicationsResponse {
  status: string;
  data: Application[];
  count: number;
}

// Fetch applications
async function fetchApplications(
  username: string,
  password: string,
  filters?: {
    user_id?: string;
    scheme_id?: string;
    status?: string;
    verification_stage?: string;
    assigned_to_me?: boolean;
  }
): Promise<ApplicationsResponse> {
  const params = new URLSearchParams({
    username,
    password,
  });

  if (filters?.user_id) params.append('user_id', filters.user_id);
  if (filters?.scheme_id) params.append('scheme_id', filters.scheme_id);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.verification_stage) params.append('verification_stage', filters.verification_stage);
  if (filters?.assigned_to_me) params.append('assigned_to_me', 'true');

  const response = await fetch(`/api/applications?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch applications: ${response.statusText}`);
  }

  return response.json();
}

// Usage in component
const ApplicationsList: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const adminUsername = 'admin.username';
  const adminPassword = 'Admin@123';

  useEffect(() => {
    fetchApplications(adminUsername, adminPassword, {
      status: 'Under Review',
      // assigned_to_me: true, // Optional: only show applications assigned to current admin
    })
      .then((response) => {
        setApplications(response.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching applications:', error);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Applications ({applications.length})</h2>
      {applications.map((app) => (
        <div key={app._id}>
          <h3>{app.schemeName}</h3>
          <p>Applicant: {app.applicantName}</p>
          <p>Status: {app.status}</p>
          <p>Verification Stage: {app.verification_stage}</p>
          <p>Date Applied: {new Date(app.date_applied).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
};
```

### Axios Example

```javascript
import axios from 'axios';

// Fetch applications with filters
async function fetchApplications(credentials, filters = {}) {
  try {
    const response = await axios.get('/api/applications', {
      params: {
        username: credentials.username,
        password: credentials.password,
        ...filters,
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching applications:', error);
    throw error;
  }
}

// Usage
const applications = await fetchApplications(
  { username: 'admin.username', password: 'Admin@123' },
  {
    status: 'Under Review',
    assigned_to_me: true,
  }
);

console.log(`Found ${applications.count} applications`);
applications.data.forEach(app => {
  console.log(`${app.applicantName} - ${app.schemeName} - ${app.status}`);
});
```

---

## Understanding Department Filtering

### For Frontend Developers

**Important:** The backend automatically filters applications based on the admin's role and department. The frontend doesn't need to implement this filtering logic.

**What happens:**

1. **Secretary+ (Level ≤ 3):**
   - Receives ALL applications in the response
   - Can see applications from any department

2. **Below Secretary (Level > 3):**
   - Receives only applications from their own department
   - The backend compares `scheme.department` (ObjectId string) with `admin.department` (ObjectId string)
   - If department doesn't match, the application is filtered out

**Example:**

```javascript
// Admin with role "Department Head" (level 4)
// admin.department = "69652457fc10b345178f75a5"

// Response will only include applications where:
// application.scheme_id.department === "69652457fc10b345178f75a5"

// Applications from other departments are automatically filtered out
```

---

## Error Handling

### Common Error Responses

**401 Unauthorized:**
```json
{
  "status": "error",
  "message": "Admin authentication required"
}
```

**403 Forbidden:**
```json
{
  "status": "error",
  "message": "Admin account is inactive"
}
```

**500 Internal Server Error:**
```json
{
  "status": "error",
  "message": "Failed to fetch applications",
  "error": "Error details (only in development mode)"
}
```

---

## Query Parameters Reference

### Filtering Options

| Parameter | Example | Description |
|-----------|---------|-------------|
| `user_id` | `69652457fc10b345178f75a5` | Filter by specific user |
| `scheme_id` | `69652454b19f52b831b4ce4d` | Filter by specific scheme |
| `status` | `Under Review` | Filter by application status |
| `verification_stage` | `Admin_Review` | Filter by verification stage |
| `assigned_to_me` | `true` | Only applications assigned to current admin |

### Status Values

- `Applied`
- `Under Review`
- `Approved`
- `Rejected`
- `Pending`

### Verification Stages

- `Applied`
- `Post_Operator_Review`
- `Admin_Review`
- `District_Head_Review`
- `Department_Review`
- `Secretary_Review`
- `Completed`

---

## Best Practices

1. **Authentication:** Store admin credentials securely (consider using tokens/sessions in production)

2. **Error Handling:** Always handle authentication errors (401) and inactive account errors (403)

3. **Loading States:** Show loading indicators while fetching applications

4. **Pagination:** Consider implementing pagination if the number of applications is large (backend may need pagination support)

5. **Caching:** Consider caching application data if appropriate for your use case

6. **Department Awareness:** Understand that admins below Secretary level will only see applications from their department (this is automatic)

---

## Summary

- ✅ **All admins can VIEW applications** (regardless of role)
- ✅ **Department filtering is automatic** (Secretary+ see all, others see only their department)
- ✅ **Authentication is required** for all requests
- ✅ **Multiple filter options** available via query parameters
- ✅ **Department comparison** uses ObjectId strings (direct string match)

The backend handles all access control and filtering logic. The frontend just needs to make the API call and display the returned applications.
