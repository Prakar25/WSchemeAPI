# Complete Profile & Document Upload API

## Overview
After registration/login, users can complete their profile and upload documents through dedicated endpoints. This document covers the profile completion and document upload functionality.

---

## Authentication
All profile endpoints require user identification. Send **userId** and/or **mobileNumber** in **query params** and/or **request body**. No custom headers.

- **GET** `/api/public-profile`: query params `{ userId }`
- **PUT** `/api/public-profile/update`: query and/or body `{ userId }`, body has profile data
- **POST** upload: query params `{ userId }`, `{ mobileNumber }` (body is FormData, not parsed before auth)
- **DELETE** `/api/public-profile/delete-document`: query and/or body `{ userId }`, body `{ documentType }`
- **POST** `/api/public-profile/submit-complete`: query params `{ userId }` — **single submit for profile + all documents**

### Account status message (for frontend display)

Responses that return a `user` object include **`accountStatusMessage`** when the user is not verified. Use it to show a single line in the UI:

- **pending** → `"Please verify your account at the nearest CSD Center"`
- **rejected** → `"Your account verification was rejected. Please contact support."`
- **verified** → `null` (no message)

Example: `{user?.accountStatusMessage && <div className="alert">{user.accountStatusMessage}</div>}`

---

## Profile Endpoints

### 0. Submit Complete (Profile + All Documents in One Request) — recommended
**Endpoint:** `POST /api/public-profile/submit-complete`

Use this when the user fills the whole form and presses **one Submit** button. Saves profile data and all selected documents in a single request. No separate upload button.

**Query params (required):** `?userId=xxx` or `?mobileNumber=xxx`

**FormData (multipart/form-data):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| fullName | string | No | Full name |
| dob | string | No | Date of birth (YYYY-MM-DD) |
| gender | string | No | M, F, or O |
| email | string | No | Email address |
| aadhaarNumber | string | No | 12-digit Aadhaar |
| careOf, house, street | string | No | Address parts |
| locality, district, state | string | No | Address |
| pincode | string | No | 6-digit pincode |
| country | string | No | Default India |
| aadhaarCard | file | No | Aadhaar card image/PDF |
| birthCertificate | file | No | Birth certificate image/PDF |
| certificateOfIdentification | file | No | Certificate of identification image/PDF |

**Example (single form submit):**
```javascript
const form = document.getElementById('complete-profile-form');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(form);
  const userId = formData.get('userId') || localStorage.getItem('userId');

  const response = await fetch(`/api/public-profile/submit-complete?userId=${userId}`, {
    method: 'POST',
    body: formData
  });
  const data = await response.json();
  if (data.status === 'success') {
    console.log('Profile and documents saved', data.user);
  }
});
```

**HTML form example:**  
Include `userId` in query when submitting (e.g. from JS). Form fields: same names as above. File inputs must have `name="aadhaarCard"`, `name="birthCertificate"`, `name="certificateOfIdentification"`.

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "Profile and documents saved successfully",
  "user": {
    "_id": "...",
    "fullName": "John Doe",
    "kycLevel": "FULL",
    "verificationStatus": "pending",
    "documents": {
      "aadhaarCard": { "filePath": "...", "uploadedAt": "...", "verified": false },
      "birthCertificate": { "filePath": "...", "uploadedAt": "...", "verified": false },
      "certificateOfIdentification": null
    }
  }
}
```

---

### 1. Get Current Profile
**Endpoint:** `GET /api/public-profile`

**Query params (user identity):** `?userId=xxx` or `?mobileNumber=xxx`

**Response (Success - 200):**
```json
{
  "status": "success",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439011",
    "fullName": "John Doe",
    "contactEmail": "john@example.com",
    "phoneNumber": "9876543210",
    "address": {
      "careOf": "",
      "house": "",
      "street": "",
      "locality": "Gangtok",
      "district": "East Sikkim",
      "state": "Sikkim",
      "pincode": "737101",
      "country": "India"
    },
    "dob": "1990-03-12T00:00:00.000Z",
    "aadhaarNumber": "123456789012",
    "gender": "M",
    "kycLevel": "FULL",
    "verificationStatus": "pending",
    "documents": {
      "aadhaarCard": {
        "filePath": "/public/uploads/public-user-documents/507f1f77bcf86cd799439011_aadhaarCard_1234567890.jpg",
        "uploadedAt": "2025-02-18T10:30:00.000Z",
        "verified": false
      },
      "birthCertificate": null,
      "certificateOfIdentification": null
    }
  }
}
```

**Response (Error - 401):**
```json
{
  "status": "error",
  "message": "User identification required. Please provide userId or mobileNumber."
}
```

**Response (Error - 404):**
```json
{
  "status": "error",
  "message": "User not found."
}
```

**Response (Error - 403):**
```json
{
  "status": "error",
  "message": "Your account is inactive. Please contact support."
}
```

---

### 2. Update Profile
**Endpoint:** `PUT /api/public-profile/update`

**Query params and/or body:** `userId`, `mobileNumber`

**Request Body:**
```json
{
  "aadhaarNumber": "123456789012",
  "fullName": "John Doe",
  "dob": "1990-03-12",
  "gender": "M",
  "email": "john@example.com",
  "careOf": "",
  "house": "123",
  "street": "Main Street",
  "locality": "Gangtok",
  "district": "East Sikkim",
  "state": "Sikkim",
  "pincode": "737101",
  "country": "India"
}
```

**Note:** All fields are optional. Only include fields you want to update.

**Field Descriptions:**
- `aadhaarNumber`: 12-digit Aadhaar number (optional)
- `fullName`: Full name of the user (optional)
- `dob`: Date of birth in format "YYYY-MM-DD" (optional)
- `gender`: Gender - "M", "F", or "O" (optional)
- `email`: Email address (optional)
- `careOf`: Care of address field (optional)
- `house`: House number/name (optional)
- `street`: Street address (optional)
- `locality`: Locality/area (optional)
- `district`: District name (optional)
- `state`: State name (optional)
- `pincode`: 6-digit pincode (optional)
- `country`: Country name (optional, defaults to "India")

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "Profile updated successfully",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439011",
    "fullName": "John Doe",
    "contactEmail": "john@example.com",
    "phoneNumber": "9876543210",
    "address": {
      "careOf": "",
      "house": "123",
      "street": "Main Street",
      "locality": "Gangtok",
      "district": "East Sikkim",
      "state": "Sikkim",
      "pincode": "737101",
      "country": "India"
    },
    "dob": "1990-03-12T00:00:00.000Z",
    "aadhaarNumber": "123456789012",
    "gender": "M",
    "kycLevel": "FULL",
    "verificationStatus": "pending",
    "documents": {
      "aadhaarCard": null,
      "birthCertificate": null,
      "certificateOfIdentification": null
    }
  }
}
```

**Response (Error - 400):**
```json
{
  "status": "error",
  "message": "Invalid Aadhaar number. It must be a 12-digit number."
}
```

**Response (Error - 400):**
```json
{
  "status": "error",
  "message": "Aadhaar number is already registered with another account."
}
```

**Response (Error - 400):**
```json
{
  "status": "error",
  "message": "Invalid email format."
}
```

**Response (Error - 400):**
```json
{
  "status": "error",
  "message": "Invalid pincode. It must be a 6-digit number."
}
```

---

## Document Upload Endpoints

### 3. Upload Document
**Endpoint:** `POST /api/public-profile/upload-document`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file`: The document file (JPEG, PNG, WebP, or PDF)
- `documentType`: One of:
  - `aadhaarCard`
  - `birthCertificate`
  - `certificateOfIdentification`

**User Identification (REQUIRED):**
- `userId` or `mobileNumber` in **query params** (e.g. `?userId=xxx`). FormData body is not parsed before auth.

**Example (using FormData):**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('documentType', 'aadhaarCard');
const response = await fetch(`/api/public-profile/upload-document?userId=${userId}`, {
  method: 'POST',
  body: formData
});
```

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "Document uploaded successfully",
  "document": {
    "type": "aadhaarCard",
    "filePath": "/public/uploads/public-user-documents/507f1f77bcf86cd799439011_aadhaarCard_1234567890.jpg",
    "uploadedAt": "2025-02-18T10:30:00.000Z"
  },
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439011",
    "fullName": "John Doe",
    "kycLevel": "FULL",
    "verificationStatus": "pending",
    "documents": {
      "aadhaarCard": {
        "filePath": "/public/uploads/public-user-documents/507f1f77bcf86cd799439011_aadhaarCard_1234567890.jpg",
        "uploadedAt": "2025-02-18T10:30:00.000Z",
        "verified": false
      },
      "birthCertificate": null,
      "certificateOfIdentification": null
    }
  }
}
```

**Response (Error - 400):**
```json
{
  "status": "error",
  "message": "No file uploaded."
}
```

**Response (Error - 400):**
```json
{
  "status": "error",
  "message": "Invalid document type. Must be one of: aadhaarCard, birthCertificate, certificateOfIdentification"
}
```

**Response (Error - 400):**
```json
{
  "status": "error",
  "message": "Invalid file type. Only JPEG, PNG, WebP images and PDF files are allowed."
}
```

**File Specifications:**
- **Max File Size:** 10MB
- **Allowed File Types:**
  - Images: JPEG, JPG, PNG, WebP
  - Documents: PDF

**Note:** If a document already exists for the user, it will be replaced (old file is deleted automatically).

---

### 4. Upload Multiple Documents (Batch Upload)
**Endpoint:** `POST /api/public-profile/upload-documents-batch`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `aadhaarCard`: File (optional)
- `birthCertificate`: File (optional)
- `certificateOfIdentification`: File (optional)

**User Identification (REQUIRED):**
- `userId` or `mobileNumber` in **query params** (e.g. `?userId=xxx`).

**Example:**
```javascript
const formData = new FormData();
formData.append('aadhaarCard', aadhaarFile);
formData.append('birthCertificate', birthCertFile);
formData.append('certificateOfIdentification', certFile);

const response = await fetch(`/api/public-profile/upload-documents-batch?userId=${userId}`, {
  method: 'POST',
  body: formData
});
```

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "3 document(s) uploaded successfully",
  "uploadedDocuments": [
    {
      "type": "aadhaarCard",
      "filePath": "/public/uploads/public-user-documents/507f1f77bcf86cd799439011_aadhaarCard_1234567890.jpg",
      "uploadedAt": "2025-02-18T10:30:00.000Z"
    },
    {
      "type": "birthCertificate",
      "filePath": "/public/uploads/public-user-documents/507f1f77bcf86cd799439011_birthCertificate_1234567891.pdf",
      "uploadedAt": "2025-02-18T10:30:01.000Z"
    }
  ],
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439011",
    "fullName": "John Doe",
    "kycLevel": "FULL",
    "verificationStatus": "pending",
    "documents": {
      "aadhaarCard": {
        "filePath": "/public/uploads/public-user-documents/507f1f77bcf86cd799439011_aadhaarCard_1234567890.jpg",
        "uploadedAt": "2025-02-18T10:30:00.000Z",
        "verified": false
      },
      "birthCertificate": {
        "filePath": "/public/uploads/public-user-documents/507f1f77bcf86cd799439011_birthCertificate_1234567891.pdf",
        "uploadedAt": "2025-02-18T10:30:01.000Z",
        "verified": false
      },
      "certificateOfIdentification": null
    }
  }
}
```

**Note:** 
- All document fields are optional - only include the files you want to upload
- You can upload 1, 2, or all 3 documents in a single request
- The response includes the updated user object with all documents, so you can update your UI immediately

---

### 5. Delete Document
**Endpoint:** `DELETE /api/public-profile/delete-document`

**Query params and/or body:** `userId`, `mobileNumber`

**Request Body:**
```json
{
  "documentType": "aadhaarCard"
}
```

**Valid documentType values:**
- `aadhaarCard`
- `birthCertificate`
- `certificateOfIdentification`

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "Document deleted successfully"
}
```

**Response (Error - 400):**
```json
{
  "status": "error",
  "message": "Invalid document type. Must be one of: aadhaarCard, birthCertificate, certificateOfIdentification"
}
```

---

## KYC Level Calculation

**KYC (Know Your Customer)** levels indicate how much profile information has been collected. The system automatically calculates KYC level based on filled data:

- **BASIC**: Default level (just mobile number)
  - User has only registered with mobile number
  - Minimal information collected

- **PARTIAL**: Has some profile data
  - Full name + at least one of: Date of birth, Gender, or Address (locality)
  - User has started filling profile but not complete

- **FULL**: Has all required fields
  - Aadhaar number
  - Full name
  - Date of birth
  - Gender
  - Complete address (locality, district, state, pincode)
  - User has completed all profile fields

**Note:** KYC level only indicates data completeness. It does NOT mean the user is verified. Verification is separate and done by CSDAdmin.

The KYC level is updated automatically when you update the profile.

---

## Verification Status

**Important:** After completing the profile, users must be **bio-authenticated by a CSDAdmin** before they can be fully verified.

### Verification Status Values:

- **pending**: User has completed profile but not yet verified by CSDAdmin (default status)
- **verified**: User has been bio-authenticated and verified by CSDAdmin
- **rejected**: User verification was rejected by CSDAdmin (with reason)

### Verification Workflow:

1. **User Registration** → `verificationStatus: "pending"`
2. **User Completes Profile** → `verificationStatus: "pending"` (remains pending)
3. **CSDAdmin Bio-Authenticates User** → `verificationStatus: "verified"` (or "rejected")
4. **User Can Access Services** → Only after verification is "verified"

### Who Can Verify:

- Only **CSDAdmin** role can verify public users
- CSDAdmin performs bio-authentication (fingerprint, iris, face recognition)
- After successful bio-authentication, CSDAdmin marks user as verified

**Note:** CSDAdmin verification endpoints will be added in the future. For now, users remain in "pending" status after profile completion.

---

## Document Access (View / Open document)

The API returns `documents.*.filePath` like `/public/uploads/public-user-documents/xxx.png`. The backend serves these files; the frontend must point "View" links at the **backend** URL, not the Vite dev server.

### Backend

- Static files are served at: **`/public/uploads`**
- So a path `/public/uploads/public-user-documents/xyz.png` is served by the backend (e.g. `http://localhost:3000/public/uploads/public-user-documents/xyz.png`).

### Frontend: building the View URL

1. **Set a backend base URL** (no trailing slash), e.g. via env:
   - `VITE_MEDIA_ENDPOINT_URL=http://localhost:3000` or  
   - `VITE_API_URL=http://localhost:3000`
2. **Build the document URL** so you do **not** get a double slash:
   - **Correct:** `documentUrl = baseUrl + filePath`  
     Example: `http://localhost:3000` + `/public/uploads/public-user-documents/xyz.png` → `http://localhost:3000/public/uploads/public-user-documents/xyz.png`
   - **Wrong:** baseUrl with trailing slash + filePath with leading slash → `http://localhost:3000/` + `/public/...` → `http://localhost:3000//public/...` (Route not found).

**Example (Vite):**
```env
# .env or .env.local
VITE_MEDIA_ENDPOINT_URL=http://localhost:3000
```
```javascript
const baseUrl = import.meta.env.VITE_MEDIA_ENDPOINT_URL || '';
const filePath = user.documents.aadhaarCard?.filePath; // e.g. "/public/uploads/..."
const documentUrl = filePath ? `${baseUrl.replace(/\/$/, '')}${filePath}` : null;
// documentUrl = "http://localhost:3000/public/uploads/public-user-documents/..."
```

Use `documentUrl` for "View" links or `<a href={documentUrl}>` / `window.open(documentUrl)`.

### Stored path format

Uploaded files are stored under:
```
/public/uploads/public-user-documents/{userId}_{documentType}_{timestamp}.{ext}
```

Example full URL:
```
http://localhost:3000/public/uploads/public-user-documents/507f1f77bcf86cd799439011_aadhaarCard_1234567890.jpg
```

---

## Error Handling

### Common Error Messages:

**Authentication Errors:**
- `"User identification required. Please provide userId or mobileNumber."` - Missing user identification
- `"User not found."` - User doesn't exist
- `"Your account is inactive. Please contact support."` - Account deactivated

**Validation Errors:**
- `"Invalid Aadhaar number. It must be a 12-digit number."` - Invalid Aadhaar format
- `"Aadhaar number is already registered with another account."` - Duplicate Aadhaar
- `"Invalid email format."` - Invalid email
- `"Invalid pincode. It must be a 6-digit number."` - Invalid pincode

**File Upload Errors:**
- `"No file uploaded."` - Missing file
- `"Invalid document type."` - Wrong document type
- `"Invalid file type. Only JPEG, PNG, WebP images and PDF files are allowed."` - Unsupported file format

**Server Errors:**
- `"Internal server error"` - Server-side error (check console logs)

---

## Frontend Implementation Guide

### 0. Single Submit (recommended)
Use **one form** and **one Submit button**. Send everything to `POST /api/public-profile/submit-complete?userId=xxx` as **FormData**:

- All profile fields as form fields (fullName, dob, gender, email, aadhaarNumber, locality, district, state, pincode, etc.).
- Three file inputs with `name="aadhaarCard"`, `name="birthCertificate"`, `name="certificateOfIdentification"`.

User selects documents and fills data, then presses **Submit** once — profile and all selected documents are saved.

```javascript
async function submitCompleteProfile(userId, formElement) {
  const formData = new FormData(formElement);
  const res = await fetch(`/api/public-profile/submit-complete?userId=${userId}`, {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  return data; // data.user has updated profile + documents
}
```

### 1. Complete Profile Form (field list)
Create a form with the following fields:

**Personal Information:**
- Full Name (text input)
- Date of Birth (date picker)
- Gender (dropdown/radio: Male/Female/Other)
- Email (email input)
- Aadhaar Number (text input, 12 digits)

**Address Information:**
- Care Of (text input, optional)
- House Number/Name (text input, optional)
- Street (text input, optional)
- Locality (text input)
- District (text input)
- State (text input/dropdown)
- Pincode (text input, 6 digits)
- Country (text input, default: "India")

### 2. Document Upload Component
For each document type, create:
- File input (accept images and PDFs)
- Upload button
- Progress indicator
- Preview of uploaded document (if exists)
- Delete/re-upload option

**Document Types:**
1. Aadhaar Card
2. Birth Certificate
3. Certificate of Identification

### 3. User Identification
Store `userId` from login response and include it in all profile requests:
- In request body
- Or in body (e.g. `userId` in JSON body)
- Or in query params

**Example:**
```javascript
// After login, store userId
localStorage.setItem('userId', userData.user._id);

// Use in requests
const userId = localStorage.getItem('userId');
```

### 4. Profile Completion Flow
1. User logs in → Get `userId` from response
2. Check profile completeness → `GET /api/public-profile`
3. Show profile form → User fills data
4. Submit profile → `PUT /api/public-profile/update`
5. Upload documents → `POST /api/public-profile/upload-document` (for each document)
6. Show completion status → Display KYC level

---

## Example Frontend Code

### Get Profile
```javascript
const getProfile = async (userId) => {
  try {
    const response = await fetch(`/api/public-profile?userId=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }
};
```

### Update Profile
```javascript
const updateProfile = async (userId, profileData) => {
  try {
  const response = await fetch(`/api/public-profile/update?userId=${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ...profileData, userId })
  });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

// Usage
const profileData = {
  fullName: "John Doe",
  dob: "1990-03-12",
  gender: "M",
  email: "john@example.com",
  locality: "Gangtok",
  district: "East Sikkim",
  state: "Sikkim",
  pincode: "737101"
};

const result = await updateProfile(userId, profileData);
```

### Upload Single Document
```javascript
const uploadDocument = async (userId, file, documentType) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    // userId in query params (FormData body not parsed before auth)
    
    const response = await fetch(`/api/public-profile/upload-document?userId=${userId}`, {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error uploading document:', error);
    throw error;
  }
};
```

### Upload Multiple Documents (Recommended)
```javascript
const uploadDocumentsBatch = async (userId, documents) => {
  try {
    const formData = new FormData();
    
    // Only append files that are provided
    if (documents.aadhaarCard) {
      formData.append('aadhaarCard', documents.aadhaarCard);
    }
    if (documents.birthCertificate) {
      formData.append('birthCertificate', documents.birthCertificate);
    }
    if (documents.certificateOfIdentification) {
      formData.append('certificateOfIdentification', documents.certificateOfIdentification);
    }
    
    const response = await fetch(`/api/public-profile/upload-documents-batch?userId=${userId}`, {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error uploading documents:', error);
    throw error;
  }
};

// Usage - Upload all documents at once
const documents = {
  aadhaarCard: aadhaarFileInput.files[0],
  birthCertificate: birthCertFileInput.files[0],
  certificateOfIdentification: certFileInput.files[0]
};

const result = await uploadDocumentsBatch(userId, documents);
// result.user contains updated user data with all documents
// Update your UI with result.user.documents
```

**Important:** For file uploads, send `userId` (and optionally `mobileNumber`) in **query params** only; FormData body is not parsed before auth.

### Delete Document
```javascript
const deleteDocument = async (userId, documentType) => {
  try {
    const response = await fetch(`/api/public-profile/delete-document?userId=${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ documentType, userId })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};

// Usage
const result = await deleteDocument(userId, 'aadhaarCard');
```

### React Example Component
```jsx
import React, { useState, useEffect, useRef } from 'react';

const ProfileCompletion = () => {
  const [userId, setUserId] = useState(localStorage.getItem('userId'));
  const [profile, setProfile] = useState(null);
  const aadhaarFileInput = useRef(null);
  const birthCertFileInput = useRef(null);
  const certFileInput = useRef(null);
  const [formData, setFormData] = useState({
    fullName: '',
    dob: '',
    gender: '',
    email: '',
    aadhaarNumber: '',
    locality: '',
    district: '',
    state: '',
    pincode: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const data = await getProfile(userId);
    if (data.status === 'success') {
      setProfile(data.user);
      // Pre-fill form with existing data
      setFormData({
        fullName: data.user.fullName || '',
        dob: data.user.dob ? new Date(data.user.dob).toISOString().split('T')[0] : '',
        gender: data.user.gender || '',
        email: data.user.contactEmail || '',
        aadhaarNumber: data.user.aadhaarNumber || '',
        locality: data.user.address?.locality || '',
        district: data.user.address?.district || '',
        state: data.user.address?.state || '',
        pincode: data.user.address?.pincode || ''
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await updateProfile(userId, formData);
    if (result.status === 'success') {
      alert('Profile updated successfully!');
      loadProfile(); // Reload to get updated KYC level
    } else {
      alert(result.message);
    }
  };

  const handleFileUpload = async (file, documentType) => {
    const result = await uploadDocument(userId, file, documentType);
    if (result.status === 'success') {
      alert('Document uploaded successfully!');
      // Update state with returned user data
      if (result.user) {
        setProfile(result.user);
      } else {
        loadProfile(); // Fallback: reload to see uploaded document
      }
    } else {
      alert(result.message);
    }
  };

  const handleBatchUpload = async (documents) => {
    const result = await uploadDocumentsBatch(userId, documents);
    if (result.status === 'success') {
      alert(`${result.uploadedDocuments.length} document(s) uploaded successfully!`);
      // Update state with returned user data
      if (result.user) {
        setProfile(result.user);
      }
    } else {
      alert(result.message);
    }
  };

  const handleSubmitAll = async (e) => {
    e.preventDefault();
    
    // First update profile
    const profileResult = await updateProfile(userId, formData);
    if (profileResult.status === 'success') {
      setProfile(profileResult.user);
    }
    
    // Then upload all documents at once
    const documents = {
      aadhaarCard: aadhaarFileInput.current?.files[0],
      birthCertificate: birthCertFileInput.current?.files[0],
      certificateOfIdentification: certFileInput.current?.files[0]
    };
    
    // Only upload if at least one file is selected
    const hasFiles = Object.values(documents).some(file => file);
    if (hasFiles) {
      await handleBatchUpload(documents);
    }
  };

  return (
    <div>
      <h2>Complete Your Profile</h2>
      <form onSubmit={handleSubmitAll}>
        {/* Form fields */}
        <input
          type="text"
          placeholder="Full Name"
          value={formData.fullName}
          onChange={(e) => setFormData({...formData, fullName: e.target.value})}
        />
        {/* ... other fields ... */}
        <button type="submit">Submit Profile & Documents</button>
      </form>

      <div>
        <h3>Upload Documents</h3>
        <input
          ref={aadhaarFileInput}
          type="file"
          accept="image/*,.pdf"
          id="aadhaarCard"
        />
        <input
          ref={birthCertFileInput}
          type="file"
          accept="image/*,.pdf"
          id="birthCertificate"
        />
        <input
          ref={certFileInput}
          type="file"
          accept="image/*,.pdf"
          id="certificateOfIdentification"
        />
        {/* Documents will be uploaded together when form is submitted */}
      </div>

      {profile && (
        <div>
          <p>KYC Level: {profile.kycLevel}</p>
          <p>Verification Status: {profile.verificationStatus}</p>
          {profile.verificationStatus === "pending" && (
            <p className="warning">
              Your profile is pending verification. Please visit a CSDAdmin for bio-authentication.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileCompletion;
```

---

## Testing Checklist

- [ ] Get profile with userId
- [ ] Get profile with mobileNumber
- [ ] Update profile with partial data
- [ ] Update profile with all data
- [ ] Validate Aadhaar number format
- [ ] Validate email format
- [ ] Validate pincode format
- [ ] Upload Aadhaar Card document
- [ ] Upload Birth Certificate document
- [ ] Upload Certificate of Identification document
- [ ] Replace existing document
- [ ] Delete document
- [ ] Verify KYC level updates automatically
- [ ] Handle error cases (invalid file type, file too large, etc.)
- [ ] Handle inactive account error
- [ ] Handle duplicate Aadhaar error

---

## Notes

1. **Partial Updates:** You can update only specific fields. You don't need to send all fields every time.

2. **Document Replacement:** Uploading a new document of the same type will automatically delete the old one.

3. **KYC Level:** The system automatically calculates and updates the KYC level based on the data you provide. No need to manually set it.

4. **File Paths:** Document file paths are relative paths starting with `/public/uploads/`. Use these paths to display documents in your frontend.

5. **User Identification:** You can use either `userId` or `mobileNumber` for authentication. Use `userId` if you have it stored from login.

6. **Date Format:** For date of birth, use ISO format "YYYY-MM-DD" (e.g., "1990-03-12").
