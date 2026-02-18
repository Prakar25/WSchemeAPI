# Bulk Upload Frontend Implementation Guide

This guide provides step-by-step instructions for implementing the bulk upload feature in the frontend, including UI components, API integration, and user flow.

## Overview

The bulk upload feature allows authorized admins to upload Excel/CSV files containing scheme beneficiaries. The process is divided into two phases:

1. **Phase 1: Upload & Preview** - Upload file, validate data, show preview
2. **Phase 2: Confirm & Save** - Review preview, confirm, and save to database

## User Flow

```
1. User selects scheme and department
2. User clicks "Bulk Upload" button
3. User selects Excel/CSV file
4. System uploads file and shows preview
   ├─ Valid rows displayed in table
   ├─ Errors displayed with row numbers
   ├─ Redundancies displayed with alerts
   └─ Statistics shown (total, valid, errors, redundancies)
5. User reviews preview (including redundancy warnings)
6. User clicks "Confirm & Upload"
7. System processes and saves data
8. Success message with statistics (including redundancies skipped)
```

## UI Components Needed

### 1. Bulk Upload Modal/Page

A modal or dedicated page containing:
- **File Input**: For selecting Excel/CSV files
- **Scheme Selector**: Dropdown to select the scheme
- **Department Display**: Show current department (auto-filled from admin profile)
- **Upload Button**: Triggers Phase 1
- **Preview Section**: Shows after Phase 1 completes
- **Confirm Button**: Triggers Phase 2
- **Cancel Button**: Closes/cancels the process

### 2. Preview Table

Display valid rows with columns:
- Row Number
- Full Name
- Aadhaar Number (masked: XXXX-XXXX-1234)
- Date of Birth
- Gender
- Address (Locality, District, State)
- Status (New User / Existing User / Existing Application)

### 3. Error Display

Show errors in a separate section:
- Row Number
- Error Message
- Column/Field that caused the error

### 4. Redundancy Display (NEW)

Show redundancies in a separate section with warning styling:
- Row Number
- Aadhaar Number (masked)
- Full Name
- Error Message (explains why it's redundant)
- Type: "duplicate_in_file", "existing_application", or "excluded_scheme_conflict"
- Warning icon/alert styling
- Conflicting Schemes (for excluded_scheme_conflict type)

### 5. Statistics Cards

Display summary statistics:
- Total Rows
- Valid Rows
- Error Rows
- Redundancy Rows (NEW)
- Success Rate (%)

## API Integration

### Base Configuration

```javascript
// config/api.js or utils/api.js
const API_BASE_URL = 'http://localhost:3000/api';

// Get admin credentials from auth context/store
const getAdminCredentials = () => {
  // Replace with your actual auth implementation
  return {
    username: localStorage.getItem('admin_username'),
    password: localStorage.getItem('admin_password'),
  };
};
```

### Phase 1: Upload & Preview API Call

```javascript
/**
 * Upload file and get preview
 * @param {File} file - Excel/CSV file
 * @param {string} schemeId - Scheme ID
 * @param {string} department - Department ID (optional)
 * @returns {Promise<Object>} Preview data
 */
async function uploadAndPreview(file, schemeId, department = null) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('scheme_id', schemeId);
  if (department) {
    formData.append('department', department);
  }

  const credentials = getAdminCredentials();

  try {
    const response = await fetch(`${API_BASE_URL}/bulk-upload/preview`, {
      method: 'POST',
      headers: {
        'x-admin-username': credentials.username,
        'x-admin-password': credentials.password,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Upload failed');
    }

    return data;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}
```

### Phase 2: Confirm & Save API Call

```javascript
/**
 * Confirm and save bulk upload data
 * @param {string} filePath - File path from preview response
 * @param {string} schemeId - Scheme ID
 * @param {string} department - Department ID (optional)
 * @returns {Promise<Object>} Save results
 */
async function confirmAndSave(filePath, schemeId, department = null) {
  const credentials = getAdminCredentials();

  try {
    const response = await fetch(`${API_BASE_URL}/bulk-upload/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-username': credentials.username,
        'x-admin-password': credentials.password,
      },
      body: JSON.stringify({
        file_path: filePath,
        scheme_id: schemeId,
        department: department,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Save failed');
    }

    return data;
  } catch (error) {
    console.error('Confirm error:', error);
    throw error;
  }
}
```

## React Component Example

### Complete React Component

```jsx
import React, { useState } from 'react';
import axios from 'axios';

const BulkUploadModal = ({ isOpen, onClose, schemes, adminDepartment }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedSchemeId, setSelectedSchemeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('upload'); // 'upload', 'preview', 'success'
  const [previewData, setPreviewData] = useState(null);
  const [saveResults, setSaveResults] = useState(null);
  const [error, setError] = useState(null);

  // File selection handler
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
      ];
      const validExtensions = ['.xls', '.xlsx', '.csv'];
      const fileExt = '.' + file.name.split('.').pop().toLowerCase();

      if (!validTypes.includes(file.type) && !validExtensions.includes(fileExt)) {
        setError('Invalid file type. Please select Excel (.xls, .xlsx) or CSV (.csv) file.');
        return;
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size exceeds 10MB limit.');
        return;
      }

      setSelectedFile(file);
      setError(null);
    }
  };

  // Phase 1: Upload and Preview
  const handleUpload = async () => {
    if (!selectedFile || !selectedSchemeId) {
      setError('Please select a file and scheme.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('scheme_id', selectedSchemeId);
      if (adminDepartment) {
        formData.append('department', adminDepartment);
      }

      const credentials = getAdminCredentials();

      const response = await axios.post(
        `${API_BASE_URL}/bulk-upload/preview`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'x-admin-username': credentials.username,
            'x-admin-password': credentials.password,
          },
        }
      );

      if (response.data.status === 'success') {
        setPreviewData(response.data);
        setPhase('preview');
      } else {
        setError(response.data.message || 'Upload failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Upload failed');
      console.error('Upload error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Phase 2: Confirm and Save
  const handleConfirm = async () => {
    if (!previewData) {
      setError('Preview data not found. Please upload again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const credentials = getAdminCredentials();

      const response = await axios.post(
        `${API_BASE_URL}/bulk-upload/confirm`,
        {
          file_path: previewData.file_path,
          scheme_id: selectedSchemeId,
          department: adminDepartment,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-admin-username': credentials.username,
            'x-admin-password': credentials.password,
          },
        }
      );

      if (response.data.status === 'success') {
        setSaveResults(response.data.results);
        setPhase('success');
      } else {
        setError(response.data.message || 'Save failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Save failed');
      console.error('Confirm error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reset modal
  const handleReset = () => {
    setSelectedFile(null);
    setSelectedSchemeId('');
    setPhase('upload');
    setPreviewData(null);
    setSaveResults(null);
    setError(null);
    setLoading(false);
  };

  // Close handler
  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Mask Aadhaar number
  const maskAadhaar = (aadhaar) => {
    if (!aadhaar || aadhaar.length !== 12) return aadhaar;
    return `XXXX-XXXX-${aadhaar.slice(8)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Bulk Upload Beneficiaries</h2>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Phase 1: Upload */}
          {phase === 'upload' && (
            <div className="space-y-6">
              {/* Scheme Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Scheme *
                </label>
                <select
                  value={selectedSchemeId}
                  onChange={(e) => setSelectedSchemeId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Scheme --</option>
                  {schemes.map((scheme) => (
                    <option key={scheme._id} value={scheme._id}>
                      {scheme.scheme_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department Display */}
              {adminDepartment && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <input
                    type="text"
                    value={adminDepartment}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-100"
                  />
                </div>
              )}

              {/* File Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Excel/CSV File *
                </label>
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv"
                  onChange={handleFileChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Supported formats: .xls, .xlsx, .csv (Max size: 10MB)
                </p>
                {selectedFile && (
                  <p className="mt-1 text-sm text-green-600">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              {/* Upload Button */}
              <button
                onClick={handleUpload}
                disabled={loading || !selectedFile || !selectedSchemeId}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Uploading...' : 'Upload & Preview'}
              </button>
            </div>
          )}

          {/* Phase 2: Preview */}
          {phase === 'preview' && previewData && (
            <div className="space-y-6">
              {/* Statistics */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {previewData.total_rows}
                  </div>
                  <div className="text-sm text-gray-600">Total Rows</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {previewData.valid_rows}
                  </div>
                  <div className="text-sm text-gray-600">Valid Rows</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {previewData.error_rows}
                  </div>
                  <div className="text-sm text-gray-600">Error Rows</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {((previewData.valid_rows / previewData.total_rows) * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">Success Rate</div>
                </div>
              </div>

              {/* Preview Table */}
              {previewData.preview_data && previewData.preview_data.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Preview Data (First 10 rows)</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Row
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Full Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Aadhaar
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            DOB
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Gender
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Address
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {previewData.preview_data.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.row}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {item.userData.demographics.fullName}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {maskAadhaar(item.userData.aadhaarNumber)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {new Date(item.userData.demographics.dob.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {item.userData.demographics.gender}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {item.userData.address.locality}, {item.userData.address.district}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {item.hasExistingApplication ? (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                                  Existing Application
                                </span>
                              ) : item.hasExistingUser ? (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                  Existing User
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                                  New User
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Errors */}
              {previewData.errors && previewData.errors.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-red-600">
                    Errors (First 10 rows)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-red-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">
                            Row
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-red-700 uppercase">
                            Error Message
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {previewData.errors.map((error, index) => (
                          <tr key={index}>
                            <td className="px-4 py-3 text-sm text-gray-900">{error.row}</td>
                            <td className="px-4 py-3 text-sm text-red-600">{error.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => setPhase('upload')}
                  className="flex-1 bg-gray-300 text-gray-700 py-3 px-6 rounded-md hover:bg-gray-400"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading || previewData.valid_rows === 0}
                  className="flex-1 bg-green-600 text-white py-3 px-6 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : 'Confirm & Save'}
                </button>
              </div>
            </div>
          )}

          {/* Phase 3: Success */}
          {phase === 'success' && saveResults && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-6xl text-green-500 mb-4">✓</div>
                <h3 className="text-2xl font-bold text-green-600 mb-2">
                  Upload Completed Successfully!
                </h3>
                <p className="text-gray-600">
                  Your bulk upload has been processed and saved to the database.
                </p>
              </div>

              {/* Results Statistics */}
              <div className="grid grid-cols-6 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{saveResults.total}</div>
                  <div className="text-sm text-gray-600">Total</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{saveResults.success}</div>
                  <div className="text-sm text-gray-600">Success</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{saveResults.skipped}</div>
                  <div className="text-sm text-gray-600">Skipped</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {saveResults.redundancies?.length || 0}
                  </div>
                  <div className="text-sm text-gray-600">Redundancies</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {saveResults.created_users}
                  </div>
                  <div className="text-sm text-gray-600">New Users</div>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600">
                    {saveResults.created_applications}
                  </div>
                  <div className="text-sm text-gray-600">Applications</div>
                </div>
              </div>

              {/* Warnings */}
              {response.data.warnings && response.data.warnings.length > 0 && (
                <div className="bg-orange-100 border-l-4 border-orange-500 p-4 mt-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-orange-800">
                        Redundancy Warning
                      </h3>
                      <div className="mt-2 text-sm text-orange-700">
                        <ul className="list-disc list-inside space-y-1">
                          {response.data.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Errors Summary */}
              {saveResults.errors && saveResults.errors.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold mb-2 text-red-600">Errors:</h4>
                  <div className="max-h-40 overflow-y-auto">
                    <ul className="list-disc list-inside space-y-1">
                      {saveResults.errors.slice(0, 10).map((error, index) => (
                        <li key={index} className="text-sm text-red-600">
                          Row {error.row}: {error.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Close Button */}
              <button
                onClick={handleClose}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkUploadModal;
```

## Usage Example

```jsx
// In your main component or page
import BulkUploadModal from './components/BulkUploadModal';

function SchemeManagementPage() {
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [schemes, setSchemes] = useState([]);
  const adminProfile = useAdminProfile(); // Your admin profile hook/context

  return (
    <div>
      <button
        onClick={() => setShowBulkUpload(true)}
        className="bg-green-600 text-white px-6 py-2 rounded"
      >
        Bulk Upload Beneficiaries
      </button>

      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        schemes={schemes}
        adminDepartment={adminProfile?.departmentId}
      />
    </div>
  );
}
```

## Vue.js Component Example

```vue
<template>
  <div v-if="isOpen" class="modal-overlay">
    <div class="modal-content">
      <!-- Upload Phase -->
      <div v-if="phase === 'upload'">
        <h2>Bulk Upload Beneficiaries</h2>
        <!-- Form elements similar to React example -->
      </div>

      <!-- Preview Phase -->
      <div v-if="phase === 'preview'">
        <!-- Preview table and errors -->
      </div>

      <!-- Success Phase -->
      <div v-if="phase === 'success'">
        <!-- Success message and statistics -->
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'BulkUploadModal',
  props: {
    isOpen: Boolean,
    schemes: Array,
    adminDepartment: String,
  },
  data() {
    return {
      phase: 'upload',
      selectedFile: null,
      selectedSchemeId: '',
      previewData: null,
      saveResults: null,
      loading: false,
      error: null,
    };
  },
  methods: {
    async handleUpload() {
      // Similar to React implementation
    },
    async handleConfirm() {
      // Similar to React implementation
    },
  },
};
</script>
```

## Key Implementation Points

### 1. File Validation

```javascript
// Validate file before upload
const validateFile = (file) => {
  const validTypes = ['.xls', '.xlsx', '.csv'];
  const validMimes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  ];
  
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  const isValidType = validTypes.includes(ext) || validMimes.includes(file.type);
  const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB

  return isValidType && isValidSize;
};
```

### 2. Error Handling

```javascript
// Handle API errors gracefully
const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error
    const message = error.response.data?.message || 'An error occurred';
    showError(message);
  } else if (error.request) {
    // Request made but no response
    showError('Network error. Please check your connection.');
  } else {
    // Something else happened
    showError(error.message || 'An unexpected error occurred');
  }
};
```

### 3. Loading States

```javascript
// Show loading indicators during API calls
const [uploading, setUploading] = useState(false);
const [saving, setSaving] = useState(false);
```

### 4. User Feedback

- Show success/error messages clearly
- Display progress indicators
- Provide actionable error messages
- Show statistics after completion

## UI/UX Best Practices

1. **Clear Instructions**: Provide clear instructions about file format requirements
2. **Progress Indicators**: Show loading states during upload and processing
3. **Error Messages**: Display specific, actionable error messages
4. **Preview**: Always show preview before confirmation
5. **Confirmation**: Require explicit confirmation before saving
6. **Success Feedback**: Show clear success message with statistics
7. **Responsive Design**: Ensure modal works on mobile devices
8. **Accessibility**: Use proper ARIA labels and keyboard navigation

## Testing Checklist

- [ ] File type validation works
- [ ] File size validation works
- [ ] Upload API call succeeds
- [ ] Preview displays correctly
- [ ] Error rows are shown
- [ ] Redundancy rows are displayed (NEW)
- [ ] Redundancy warnings are shown (NEW)
- [ ] Duplicate detection works (same Aadhaar in file) (NEW)
- [ ] Existing application detection works (NEW)
- [ ] Confirm API call succeeds
- [ ] Success message displays
- [ ] Statistics are accurate (including redundancies)
- [ ] Redundancies are skipped during import (NEW)
- [ ] Modal can be closed
- [ ] Reset works correctly
- [ ] Loading states display
- [ ] Error handling works

## Security Considerations

1. **Credentials**: Store admin credentials securely (use JWT tokens if available)
2. **File Validation**: Always validate file type and size on client side
3. **Error Messages**: Don't expose sensitive information in error messages
4. **Aadhaar Masking**: Mask Aadhaar numbers in UI (only show last 4 digits)

## Notes

- The preview shows only the first 10 valid rows and 10 errors as a sample
- The actual processing includes ALL rows in the file
- Duplicate applications (same user + same scheme) are automatically skipped
- Files are automatically cleaned up after processing
- The API supports both department validation and auto-fill from admin profile
