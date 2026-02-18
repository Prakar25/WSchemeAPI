# Frontend API Changes - Mobile Number + OTP Authentication

## Overview
The authentication system for public users has been changed from Aadhaar-based to **Mobile Number + OTP** based authentication. This applies **only to public users**, not admin users.

---

## New API Endpoints

### 1. Registration - Send OTP
**Endpoint:** `POST /api/public-auth/register/send-otp`

**Request Body:**
```json
{
  "mobileNumber": "9876543210"
}
```

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "OTP sent successfully to your mobile number.",
  "otp": "123456"  // Only in development mode, remove in production
}
```

**Response (Error - 400):**
```json
{
  "status": "error",
  "message": "User with this mobile number already exists. Please login instead."
}
```

**Response (Error - 400):**
```json
{
  "status": "error",
  "message": "Invalid mobile number. Please enter a valid 10-digit Indian mobile number."
}
```

---

### 2. Registration - Verify OTP
**Endpoint:** `POST /api/public-auth/register/verify-otp`

**Request Body:**
```json
{
  "mobileNumber": "9876543210",
  "otp": "123456",
  "fullName": "John Doe",  // Optional
  "email": "john@example.com"  // Optional
}
```

**Response (Success - 201):**
```json
{
  "status": "success",
  "message": "Registration successful",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439011",
    "fullName": "John Doe",
    "contactEmail": "john@example.com",
    "phoneNumber": "9876543210",
    "address": null,
    "dob": null,
    "aadhaarNumber": null,
    "gender": null
  }
}
```

**Response (Error - 400):**
```json
{
  "status": "error",
  "message": "OTP not found or expired. Please request a new OTP."
}
```

**Response (Error - 400):**
```json
{
  "status": "error",
  "message": "Invalid OTP. Please try again."
}
```

---

### 3. Login - Send OTP
**Endpoint:** `POST /api/public-auth/login/send-otp`

**Request Body:**
```json
{
  "mobileNumber": "9876543210"
}
```

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "OTP sent successfully to your mobile number.",
  "otp": "123456"  // Only in development mode, remove in production
}
```

**Response (Error - 404):**
```json
{
  "status": "error",
  "message": "User not found. Please register first."
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

### 4. Login - Verify OTP
**Endpoint:** `POST /api/public-auth/login/verify-otp`

**Request Body:**
```json
{
  "mobileNumber": "9876543210",
  "otp": "123456"
}
```

**Response (Success - 200):**
```json
{
  "status": "success",
  "message": "Login successful",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439011",
    "fullName": "John Doe",
    "contactEmail": "john@example.com",
    "phoneNumber": "9876543210",
    "address": null,
    "dob": null,
    "aadhaarNumber": null,
    "gender": null
  }
}
```

**Response (Error - 400):**
```json
{
  "status": "error",
  "message": "OTP not found or expired. Please request a new OTP."
}
```

**Response (Error - 400):**
```json
{
  "status": "error",
  "message": "Invalid OTP. Please try again."
}
```

---

## Mobile Number Validation
- Mobile number must be a **10-digit Indian mobile number**
- Must start with 6, 7, 8, or 9
- Format: `/^[6-9]\d{9}$/`
- Example: `9876543210` ✅
- Example: `1234567890` ❌ (doesn't start with 6-9)

---

## OTP Details
- **OTP Length:** 6 digits
- **OTP Expiry:** 10 minutes
- **Max Verification Attempts:** 5 attempts per OTP
- **OTP Format:** Numeric only (e.g., `123456`)

---

## User Registration Flow

### Step 1: Request OTP
```
POST /api/public-auth/register/send-otp
Body: { "mobileNumber": "9876543210" }
```

### Step 2: Verify OTP and Register
```
POST /api/public-auth/register/verify-otp
Body: {
  "mobileNumber": "9876543210",
  "otp": "123456",
  "fullName": "John Doe",  // Optional
  "email": "john@example.com"  // Optional
}
```

---

## User Login Flow

### Step 1: Request OTP
```
POST /api/public-auth/login/send-otp
Body: { "mobileNumber": "9876543210" }
```

### Step 2: Verify OTP and Login
```
POST /api/public-auth/login/verify-otp
Body: {
  "mobileNumber": "9876543210",
  "otp": "123456"
}
```

---

## Important Notes

1. **Mobile Number Uniqueness:** Mobile numbers are now unique. Each mobile number can only be registered once.

2. **Aadhaar is Optional:** Aadhaar number is no longer required for registration. Users can register with just mobile number + OTP.

3. **Optional Fields:** The following fields are optional during registration:
   - `fullName`
   - `email`
   - `dob` (date of birth)
   - `gender`
   - `address` fields

4. **Development Mode:** In development mode, the OTP is returned in the response for testing purposes. In production, OTPs will be sent via SMS only.

5. **SMS Integration:** Currently, OTPs are logged to console. For production, integrate with an SMS service provider (Twilio, AWS SNS, etc.) in `utils/otpService.js`.

6. **Existing Endpoints:** The existing `/api/public-users` lookup endpoint still works but is now based on Aadhaar lookup. For mobile-based lookup, use the login endpoint.

---

## Error Handling

### Common Error Messages:
- `"Mobile number is required"` - Missing mobile number in request
- `"OTP is required"` - Missing OTP in request
- `"Invalid mobile number. Please enter a valid 10-digit Indian mobile number."` - Invalid mobile format
- `"User with this mobile number already exists. Please login instead."` - User already registered
- `"User not found. Please register first."` - User doesn't exist (login)
- `"OTP not found or expired. Please request a new OTP."` - OTP expired or invalid
- `"Invalid OTP. Please try again."` - Wrong OTP entered
- `"Maximum OTP verification attempts exceeded. Please request a new OTP."` - Too many failed attempts
- `"Your account is inactive. Please contact support."` - Account deactivated

---

## Migration Notes

- **Existing Users:** Existing users with Aadhaar numbers can still be looked up via `/api/public-users?aadhaarNumber=...`
- **New Users:** New users must register via mobile number + OTP
- **Database:** The `PublicUser` model has been updated:
  - Mobile number is now unique
  - Aadhaar number is optional
  - Many fields are now optional to allow minimal registration

---

## Testing

In development mode, you can test the flow by:
1. Calling the send-otp endpoint
2. Using the OTP returned in the response (only in dev mode)
3. Verifying the OTP to complete registration/login

---

## Next Steps for Frontend

1. Update registration UI to use mobile number instead of Aadhaar
2. Implement OTP input screen
3. Add OTP resend functionality (call send-otp again)
4. Handle OTP expiry (10 minutes)
5. Show appropriate error messages
6. Store user data from login response in frontend state/session

---

# Complete Profile & Document Upload API

## Overview
After registration/login, users can complete their profile and upload documents through dedicated endpoints.

---

## Authentication
All profile endpoints require user identification. Send either:
- `userId` in request body, query params, or header (`x-user-id`)
- `mobileNumber` in request body, query params, or header (`x-mobile-number`)

---

## Profile Endpoints

### 1. Get Current Profile
**Endpoint:** `GET /api/public-profile`

**Headers/Body/Query:**
```
userId: "507f1f77bcf86cd799439011"
OR
mobileNumber: "9876543210"
```

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

---

### 2. Update Profile
**Endpoint:** `PUT /api/public-profile/update`

**Headers/Body/Query:**
```
userId: "507f1f77bcf86cd799439011"
OR
mobileNumber: "9876543210"
```

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
    "address": { ... },
    "dob": "1990-03-12T00:00:00.000Z",
    "aadhaarNumber": "123456789012",
    "gender": "M",
    "kycLevel": "FULL",
    "documents": { ... }
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
- `userId` or `mobileNumber`: User identification

**Example (using FormData):**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('documentType', 'aadhaarCard');
formData.append('userId', '507f1f77bcf86cd799439011');
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

**File Size Limit:** 10MB

**Allowed File Types:**
- Images: JPEG, JPG, PNG, WebP
- Documents: PDF

---

### 4. Delete Document
**Endpoint:** `DELETE /api/public-profile/delete-document`

**Headers/Body/Query:**
```
userId: "507f1f77bcf86cd799439011"
OR
mobileNumber: "9876543210"
```

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

The system automatically calculates KYC level based on filled data:

- **BASIC**: Default level (just mobile number)
- **PARTIAL**: Has some profile data (name, DOB, gender, or address)
- **FULL**: Has all required fields:
  - Aadhaar number
  - Full name
  - Date of birth
  - Gender
  - Complete address (locality, district, state, pincode)

---

## Document Access

Uploaded documents are stored at:
```
/public/uploads/public-user-documents/{userId}_{documentType}_{timestamp}.{ext}
```

To access documents, use:
```
http://your-domain/public/uploads/public-user-documents/{filename}
```

---

## Error Handling

### Common Error Messages:
- `"User identification required. Please provide userId or mobileNumber."` - Missing user identification
- `"User not found."` - User doesn't exist
- `"Your account is inactive. Please contact support."` - Account deactivated
- `"Invalid Aadhaar number. It must be a 12-digit number."` - Invalid Aadhaar format
- `"Aadhaar number is already registered with another account."` - Duplicate Aadhaar
- `"Invalid email format."` - Invalid email
- `"Invalid pincode. It must be a 6-digit number."` - Invalid pincode
- `"No file uploaded."` - Missing file
- `"Invalid document type."` - Wrong document type
- `"Invalid file type. Only JPEG, PNG, WebP images and PDF files are allowed."` - Unsupported file format

---

## Frontend Implementation Guide

### 1. Complete Profile Form
Create a form with fields:
- Full Name
- Date of Birth (date picker)
- Gender (dropdown: M/F/O)
- Email
- Address fields (careOf, house, street, locality, district, state, pincode, country)
- Aadhaar Number (optional)

### 2. Document Upload Component
- File input for each document type
- Show upload progress
- Display uploaded document preview
- Allow delete/re-upload

### 3. User Identification
Store `userId` from login response and include it in all profile requests:
- In request body
- Or in headers (`x-user-id`)
- Or in query params

### 4. Profile Completion Flow
1. User logs in → Get `userId`
2. Check profile completeness → `GET /api/public-profile`
3. Show profile form → User fills data
4. Submit profile → `PUT /api/public-profile/update`
5. Upload documents → `POST /api/public-profile/upload-document` (for each document)
6. Show completion status → Display KYC level

---

## Example Frontend Code

### Update Profile
```javascript
const updateProfile = async (userId, profileData) => {
  const response = await fetch('/api/public-profile/update', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId
    },
    body: JSON.stringify(profileData)
  });
  return await response.json();
};
```

### Upload Document
```javascript
const uploadDocument = async (userId, file, documentType) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);
  formData.append('userId', userId);
  
  const response = await fetch('/api/public-profile/upload-document', {
    method: 'POST',
    body: formData
  });
  return await response.json();
};
```

### Get Profile
```javascript
const getProfile = async (userId) => {
  const response = await fetch(`/api/public-profile?userId=${userId}`);
  return await response.json();
};
```
