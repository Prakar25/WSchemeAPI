# Bulk Upload API Guide

This guide explains how to use the bulk upload API to upload Excel/CSV files containing scheme beneficiaries and add them to the database.

## Overview

The bulk upload feature allows authorized admins to upload Excel (.xls, .xlsx) or CSV (.csv) files containing beneficiary data for a specific scheme. The process is divided into two phases:

1. **Upload & Preview**: Upload the file, parse it, validate the data, and return a preview
2. **Confirm & Save**: Confirm the upload and save valid data to the database

## Authorization

Only the following admin roles can perform bulk uploads:
- **Super Admin**
- **Admin**
- **Department Head**
- **Department Secretary**

## API Endpoints

### 1. Upload & Preview

**Endpoint:** `POST /api/bulk-upload/preview`

**Headers:**
```
x-admin-username: <admin_username>
x-admin-password: <admin_password>
```

**Content-Type:** `multipart/form-data`

**Body (Form Data):**
- `file`: Excel/CSV file (required) - Max size: 10MB
- `scheme_id`: Scheme ID (required) - The scheme to add beneficiaries to
- `department`: Department ID (optional) - For validation

**Example Request:**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('scheme_id', '696548bd9860664c364e628a');
formData.append('department', '69652457fc10b345178f75a5');

const response = await fetch('http://localhost:3000/api/bulk-upload/preview', {
  method: 'POST',
  headers: {
    'x-admin-username': 'admin.username',
    'x-admin-password': 'Admin@123',
  },
  body: formData,
});
```

**Success Response (200):**
```json
{
  "status": "success",
  "preview_id": "preview_1234567890_abc123",
  "file_path": "temp/upload-1234567890.xlsx",
  "scheme": {
    "_id": "696548bd9860664c364e628a",
    "scheme_name": "Aama Yojna",
    "department": "69652457fc10b345178f75a5"
  },
  "total_rows": 100,
  "valid_rows": 95,
  "error_rows": 5,
  "preview_data": [
    {
      "row": 2,
      "userData": {
        "aadhaarNumber": "123456789012",
        "demographics": {
          "fullName": "John Doe",
          "dob": { "date": "1990-01-01T00:00:00.000Z", "verified": true },
          "gender": "M"
        },
        "address": {
          "street": "123 Main St",
          "locality": "City Center",
          "district": "Mumbai",
          "state": "Maharashtra",
          "pincode": "400001",
          "country": "India"
        },
        "contact": {
          "mobile": { "value": "9876543210", "verified": false },
          "email": { "value": "john@example.com", "verified": false }
        }
      },
      "hasExistingUser": false,
      "hasExistingApplication": false
    }
  ],
  "errors": [
    {
      "row": 3,
      "error": "Invalid Aadhaar number (must be 12 digits)",
      "data": { /* original row data */ }
    }
  ],
  "message": "Parsed 100 rows. 95 valid, 5 with errors."
}
```

**Error Responses:**

- **400 Bad Request**: Missing file, invalid file type, or missing scheme_id
- **401 Unauthorized**: Invalid admin credentials
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Scheme not found

### 2. Confirm & Save

**Endpoint:** `POST /api/bulk-upload/confirm`

**Headers:**
```
x-admin-username: <admin_username>
x-admin-password: <admin_password>
Content-Type: application/json
```

**Body:**
```json
{
  "file_path": "temp/upload-1234567890.xlsx",
  "scheme_id": "696548bd9860664c364e628a",
  "department": "69652457fc10b345178f75a5"
}
```

**Example Request:**
```javascript
const response = await fetch('http://localhost:3000/api/bulk-upload/confirm', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-admin-username': 'admin.username',
    'x-admin-password': 'Admin@123',
  },
  body: JSON.stringify({
    file_path: previewResponse.file_path,
    scheme_id: '696548bd9860664c364e628a',
    department: '69652457fc10b345178f75a5',
  }),
});
```

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Bulk upload completed",
  "results": {
    "total": 100,
    "success": 90,
    "skipped": 10,
    "errors": [
      {
        "row": 3,
        "error": "Invalid Aadhaar number (must be 12 digits)"
      }
    ],
    "created_users": 85,
    "created_applications": 90,
    "updated_users": 5
  }
}
```

**Error Responses:**

- **400 Bad Request**: Missing required fields
- **401 Unauthorized**: Invalid admin credentials
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: File not found or scheme not found
- **500 Internal Server Error**: Database or processing error

## Excel/CSV File Format

### Required Columns

The file must contain the following columns (column names can vary, see normalization below):

1. **Aadhaar Number** (required)
   - Must be exactly 12 digits
   - Variations: "Aadhaar", "Aadhar", "UID", "Aadhaar Number"

2. **Full Name** (required)
   - Variations: "Full Name", "Name", "Complete Name", "Applicant Name"

3. **Date of Birth** (required)
   - Format: Any valid date format (YYYY-MM-DD, DD/MM/YYYY, etc.)
   - Variations: "DOB", "Date of Birth", "Birth Date", "Date"

4. **Gender** (required)
   - Values: M, F, O (or Male, Female, Other)
   - Variations: "Gender", "Sex"

5. **Locality** (required)
   - Variations: "Locality", "Village", "Town", "City"

6. **District** (required)
   - Variations: "District"

7. **State** (required)
   - Variations: "State"

8. **Pincode** (required)
   - Must be exactly 6 digits
   - Variations: "Pincode", "Pin Code", "Postal Code", "Zip Code"

9. **Mobile** (required)
   - Variations: "Mobile", "Phone", "Contact", "Mobile Number"

### Optional Columns

- **Street** - Variations: "Street", "Address Line 1"
- **Email** - Variations: "Email", "E-mail", "Email Address"
- **House** - Variations: "House", "House Number"
- **Care Of** - Variations: "Care Of", "C/O"

### Example Excel/CSV Format

| Aadhaar Number | Full Name | Date of Birth | Gender | Street | Locality | District | State | Pincode | Mobile | Email |
|----------------|-----------|---------------|--------|--------|----------|----------|-------|---------|--------|-------|
| 123456789012 | John Doe | 1990-01-15 | M | 123 Main St | City Center | Mumbai | Maharashtra | 400001 | 9876543210 | john@example.com |
| 987654321098 | Jane Smith | 1985-05-20 | F | 456 Oak Ave | Suburb | Pune | Maharashtra | 411001 | 9876543211 | jane@example.com |

## Data Mapping & User Matching

### User Matching Logic

1. **Primary Match**: Aadhaar Number
   - If a user with the same Aadhaar exists, that user is used
   - If user exists but application doesn't, a new application is created

2. **Secondary Match**: Street Address + Full Name
   - If no Aadhaar match, the system tries to find a user by street address and full name
   - If found and Aadhaar is missing in existing user, it's updated

3. **New User Creation**: If no match is found
   - A new PublicUser is created with all provided data
   - A new Application is created for the specified scheme

### Application Status

All bulk-uploaded applications are created with:
- `status`: "Applied"
- `verification_level`: Based on scheme's `authorization_levels` (or default: 7 for Post Operator)
- `form_data.bulk_uploaded`: true
- `form_data.uploaded_by`: Admin username
- `form_data.uploaded_at`: Current timestamp

## Frontend Implementation Example

```javascript
// Phase 1: Upload and Preview
async function uploadAndPreview(file, schemeId, department) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('scheme_id', schemeId);
  formData.append('department', department);

  try {
    const response = await axios.post('/api/bulk-upload/preview', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'x-admin-username': adminUsername,
        'x-admin-password': adminPassword,
      },
    });

    if (response.data.status === 'success') {
      // Show preview data
      console.log('Preview:', response.data.preview_data);
      console.log('Errors:', response.data.errors);
      console.log('Valid rows:', response.data.valid_rows);
      console.log('Error rows:', response.data.error_rows);
      
      // Store file_path for confirmation
      return response.data;
    }
  } catch (error) {
    console.error('Upload error:', error.response?.data || error.message);
    throw error;
  }
}

// Phase 2: Confirm and Save
async function confirmAndSave(previewData, schemeId, department) {
  try {
    const response = await axios.post(
      '/api/bulk-upload/confirm',
      {
        file_path: previewData.file_path,
        scheme_id: schemeId,
        department: department,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-admin-username': adminUsername,
          'x-admin-password': adminPassword,
        },
      }
    );

    if (response.data.status === 'success') {
      console.log('Upload completed:', response.data.results);
      // Show success message with statistics
      return response.data;
    }
  } catch (error) {
    console.error('Confirm error:', error.response?.data || error.message);
    throw error;
  }
}

// Complete workflow
async function handleBulkUpload(file, schemeId, department) {
  try {
    // Step 1: Upload and preview
    const preview = await uploadAndPreview(file, schemeId, department);
    
    // Step 2: Show preview to user and get confirmation
    const userConfirmed = await showPreviewDialog(preview);
    
    if (userConfirmed) {
      // Step 3: Confirm and save
      const result = await confirmAndSave(preview, schemeId, department);
      return result;
    }
  } catch (error) {
    console.error('Bulk upload error:', error);
    throw error;
  }
}
```

## Error Handling

### Common Errors

1. **Invalid file type**: Only .xls, .xlsx, and .csv files are accepted
2. **File too large**: Maximum file size is 10MB
3. **Missing required columns**: Aadhaar, Full Name, DOB, Gender, Address fields, Mobile are required
4. **Invalid data format**: 
   - Aadhaar must be 12 digits
   - Pincode must be 6 digits
   - Email must be valid format
   - DOB must be valid date
5. **Duplicate applications**: If a user already has an application for the scheme, it's skipped
6. **Scheme not found**: The provided scheme_id must exist in the database

## File Cleanup

Temporary files are automatically deleted after:
- Successful confirmation and processing
- Error during preview (if file parsing fails)
- The file should be cleaned up by the server, but ensure proper cleanup in production

## Notes

- The API automatically normalizes column names, so minor variations in column headers are handled
- Users are matched first by Aadhaar, then by street address + full name
- Duplicate applications (same user + same scheme) are skipped
- All bulk-uploaded applications start at the initial verification level defined by the scheme
- The preview shows up to 10 valid rows and 10 errors as a sample

## Production Considerations

1. **File Storage**: Consider using cloud storage (S3, Azure Blob) instead of local temp files
2. **Background Processing**: For large files, consider processing in background jobs
3. **Progress Tracking**: Implement progress tracking for large uploads
4. **Rate Limiting**: Add rate limiting to prevent abuse
5. **Logging**: Add detailed logging for audit trails
6. **Validation**: Add more robust data validation and sanitization
7. **Transaction Handling**: Consider using database transactions for atomic operations
8. **Aadhaar Encryption**: Use proper encryption for Aadhaar numbers in production
