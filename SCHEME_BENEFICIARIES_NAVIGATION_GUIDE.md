# Frontend Guide: View Applicants Button Navigation

## Overview

When clicking the "View Applicants" button in the schemes section of the admin panel, it should navigate to the scheme beneficiaries page showing all applicants for that scheme.

## API Endpoint

**Endpoint:** `GET /api/applications/scheme/:scheme_id`

**No authentication required** (public endpoint)

**Response Format:**
```json
{
  "status": "success",
  "scheme": {
    "_id": "696548bd9860664c364e628a",
    "scheme_name": "Aama Yojna",
    "category": "69652454b19f52b831b4ce4d",
    "department": "69652457fc10b345178f75a5"
  },
  "applicants": [
    {
      "application_id": "6965d178baf8d080e7ed8171",
      "full_name": "Suman Chhetri",
      "status": "Applied",
      "date_applied": "2026-01-13T05:00:40.430Z",
      "verification_stage": "Department_Review"
    }
  ],
  "total_applicants": 1,
  "count_by_status": {
    "Applied": 1,
    "Under Review": 0,
    "Approved": 0,
    "Rejected": 0,
    "Pending": 0
  }
}
```

## Frontend Implementation

### React Router Example

```jsx
// In your Schemes component/page
import { useNavigate } from 'react-router-dom';

const SchemesPage = () => {
  const navigate = useNavigate();

  const handleViewApplicants = (schemeId) => {
    // Navigate to scheme beneficiaries page with scheme ID
    navigate(`/admin/schemes/${schemeId}/beneficiaries`);
    // Or if your route is different:
    // navigate(`/admin/scheme-beneficiaries?scheme_id=${schemeId}`);
  };

  return (
    <div>
      {schemes.map((scheme) => (
        <div key={scheme._id}>
          <h3>{scheme.scheme_name}</h3>
          <button onClick={() => handleViewApplicants(scheme._id)}>
            View Applicants
          </button>
        </div>
      ))}
    </div>
  );
};
```

### React Router Route Setup

```jsx
// In your App.js or router configuration
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SchemeBeneficiariesPage from './pages/SchemeBeneficiariesPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Other routes */}
        <Route 
          path="/admin/schemes/:schemeId/beneficiaries" 
          element={<SchemeBeneficiariesPage />} 
        />
        {/* Or if using query params: */}
        <Route 
          path="/admin/scheme-beneficiaries" 
          element={<SchemeBeneficiariesPage />} 
        />
      </Routes>
    </BrowserRouter>
  );
}
```

### Scheme Beneficiaries Page Component

```jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const SchemeBeneficiariesPage = () => {
  const { schemeId } = useParams(); // If using route params
  // OR
  // const [searchParams] = useSearchParams();
  // const schemeId = searchParams.get('scheme_id'); // If using query params
  
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [schemeData, setSchemeData] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (schemeId) {
      fetchSchemeBeneficiaries();
    }
  }, [schemeId]);

  const fetchSchemeBeneficiaries = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `http://localhost:3000/api/applications/scheme/${schemeId}`
      );

      if (response.data.status === 'success') {
        setSchemeData(response.data.scheme);
        setApplicants(response.data.applicants);
      } else {
        setError(response.data.message || 'Failed to fetch beneficiaries');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch beneficiaries');
      console.error('Error fetching scheme beneficiaries:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <div>
        <p>Error: {error}</p>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 text-blue-600 hover:text-blue-800"
        >
          ← Back to Schemes
        </button>
        <h1 className="text-2xl font-bold">
          Scheme Beneficiaries: {schemeData?.scheme_name}
        </h1>
        <p className="text-gray-600">
          Total Applicants: {applicants.length}
        </p>
      </div>

      {/* Statistics */}
      {response.data.count_by_status && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded">
            <div className="text-xl font-bold">{response.data.count_by_status.Applied || 0}</div>
            <div className="text-sm">Applied</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded">
            <div className="text-xl font-bold">{response.data.count_by_status['Under Review'] || 0}</div>
            <div className="text-sm">Under Review</div>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <div className="text-xl font-bold">{response.data.count_by_status.Approved || 0}</div>
            <div className="text-sm">Approved</div>
          </div>
          <div className="bg-red-50 p-4 rounded">
            <div className="text-xl font-bold">{response.data.count_by_status.Rejected || 0}</div>
            <div className="text-sm">Rejected</div>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-xl font-bold">{response.data.count_by_status.Pending || 0}</div>
            <div className="text-sm">Pending</div>
          </div>
        </div>
      )}

      {/* Applicants Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Application ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Full Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Verification Stage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date Applied
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {applicants.map((applicant) => (
              <tr key={applicant.application_id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {applicant.application_id.substring(0, 8)}...
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {applicant.full_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded ${
                    applicant.status === 'Approved' ? 'bg-green-100 text-green-800' :
                    applicant.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                    applicant.status === 'Under Review' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {applicant.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {applicant.verification_stage}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(applicant.date_applied).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => navigate(`/admin/applications/${applicant.application_id}`)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {applicants.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No applicants found for this scheme.
        </div>
      )}
    </div>
  );
};

export default SchemeBeneficiariesPage;
```

## Alternative: Using Query Parameters

If you prefer query parameters instead of route params:

```jsx
// Navigation
const handleViewApplicants = (schemeId) => {
  navigate(`/admin/scheme-beneficiaries?scheme_id=${schemeId}`);
};

// In SchemeBeneficiariesPage component
import { useSearchParams } from 'react-router-dom';

const SchemeBeneficiariesPage = () => {
  const [searchParams] = useSearchParams();
  const schemeId = searchParams.get('scheme_id');

  useEffect(() => {
    if (schemeId) {
      fetchSchemeBeneficiaries(schemeId);
    }
  }, [schemeId]);

  // ... rest of the component
};
```

## Complete Example with Error Handling

```jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const SchemeBeneficiariesPage = () => {
  const { schemeId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, [schemeId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(
        `http://localhost:3000/api/applications/scheme/${schemeId}`
      );

      if (response.data.status === 'success') {
        setData(response.data);
      } else {
        setError(response.data.message || 'Failed to fetch data');
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Scheme not found');
      } else {
        setError(err.response?.data?.message || err.message || 'An error occurred');
      }
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Your table/display code here */}
    </div>
  );
};

export default SchemeBeneficiariesPage;
```

## Summary

**Steps to implement:**

1. **Add navigation handler** in Schemes component:
   ```jsx
   const handleViewApplicants = (schemeId) => {
     navigate(`/admin/schemes/${schemeId}/beneficiaries`);
   };
   ```

2. **Add route** in your router:
   ```jsx
   <Route path="/admin/schemes/:schemeId/beneficiaries" element={<SchemeBeneficiariesPage />} />
   ```

3. **Create SchemeBeneficiariesPage component** that:
   - Gets `schemeId` from route params
   - Calls `GET /api/applications/scheme/:scheme_id`
   - Displays applicants in a table
   - Shows statistics by status

4. **Add "View Applicants" button** in Schemes list:
   ```jsx
   <button onClick={() => handleViewApplicants(scheme._id)}>
     View Applicants
   </button>
   ```

The API endpoint is already available and ready to use!
