# ChatGPT Prompt: Generate Bulk Upload Sample Excel Data

Use this prompt with ChatGPT to generate a sample Excel dataset for testing the bulk upload feature.

---

## Prompt for ChatGPT

```
Create an Excel file with sample data for a welfare scheme beneficiary bulk upload system. The file should contain the following columns and data:

**REQUIRED COLUMNS:**
1. Aadhaar Number (Column A) - Must be exactly 12 digits, numeric only
   - Example values: 123456789012, 987654321098, 112233445566, 998877665544

2. Full Name (Column B) - Complete name of the beneficiary
   - Example values: Ram Kumar Sharma, Sita Devi, John Doe, Priya Patel, Mohan Singh

3. Date of Birth (Column C) - Date in format YYYY-MM-DD or DD/MM/YYYY
   - Example values: 1990-05-15, 1985-12-20, 1995-03-10, 2000-07-25, 1988-11-08

4. Gender (Column D) - Values: M (Male), F (Female), or O (Other)
   - Example values: M, F, F, M, O

5. Street (Column E) - Street address (optional but recommended)
   - Example values: 123 Main Street, House No. 45, Building A, Flat 201, Near Park

6. Locality (Column F) - Village/Town/City area (REQUIRED)
   - Example values: City Center, Suburb Area, Village Panchayat, Town Square, Market Area

7. District (Column G) - District name (REQUIRED)
   - Example values: Mumbai, Pune, Delhi, Bangalore, Kolkata

8. State (Column H) - State name (REQUIRED)
   - Example values: Maharashtra, Karnataka, Delhi, West Bengal, Tamil Nadu

9. Pincode (Column I) - 6-digit postal code (REQUIRED, numeric only)
   - Example values: 400001, 411001, 110001, 560001, 700001

10. Mobile (Column J) - 10-digit mobile number (REQUIRED, numeric only)
    - Example values: 9876543210, 9876543211, 9876543212, 9876543213, 9876543214

11. Email (Column K) - Valid email address (optional but recommended)
    - Example values: ram.sharma@email.com, sita.devi@email.com, john.doe@email.com, priya.patel@email.com, mohan.singh@email.com

**DATA REQUIREMENTS:**
- Create 20 rows of sample data (1 header row + 19 data rows)
- Include mix of genders (M, F, O)
- Include different age groups (dates of birth ranging from 1980 to 2000)
- Use realistic Indian names (mix of Hindi and English names)
- Use real Indian districts, states, and pincodes
- Ensure all Aadhaar numbers are unique and exactly 12 digits
- Ensure all mobile numbers are exactly 10 digits and unique
- Ensure all pincodes are exactly 6 digits
- Include some rows with valid email addresses and some without
- Make street addresses varied (some with house numbers, some with landmarks)

**ADDITIONAL INSTRUCTIONS:**
- Include 2-3 rows with intentional errors for testing (e.g., invalid Aadhaar, missing required fields, invalid pincode)
- Format dates consistently (use one date format throughout)
- Make sure column headers are clearly labeled
- Use proper Excel formatting (text format for Aadhaar and mobile numbers to preserve leading zeros)
- Keep data realistic and consistent (e.g., pincodes should match the district/state)

**COLUMN HEADER VARIATIONS (ChatGPT can use these):**
You can use any of these column name variations as the API normalizes them:
- Aadhaar Number / Aadhaar / Aadhar / UID
- Full Name / Name / Complete Name / Applicant Name
- Date of Birth / DOB / Birth Date / Date
- Gender / Sex
- Street / Street Address / Address Line 1
- Locality / Village / Town / City
- District
- State
- Pincode / Pin Code / Postal Code / Zip Code
- Mobile / Mobile Number / Phone / Contact
- Email / E-mail / Email Address

Please provide the data in a table format that can be easily copied to Excel, or create a CSV format that can be imported into Excel.
```

---

## Alternative Shorter Prompt

```
Generate a sample Excel dataset for a welfare scheme beneficiary bulk upload with the following specifications:

Create 20 rows of data with these columns:
1. Aadhaar Number (12 digits, unique)
2. Full Name (Indian names)
3. Date of Birth (YYYY-MM-DD format, ages 20-50)
4. Gender (M/F/O)
5. Street (address line)
6. Locality (required)
7. District (required, Indian districts)
8. State (required, Indian states)
9. Pincode (6 digits, required)
10. Mobile (10 digits, required)
11. Email (optional, valid format)

Include:
- Mix of genders and age groups
- Realistic Indian addresses with matching pincodes
- 2-3 rows with validation errors (invalid Aadhaar, missing fields)
- Proper header row

Provide in table or CSV format ready for Excel import.
```

---

## Sample Output Format

After using the prompt, you should receive data like this:

| Aadhaar Number | Full Name | Date of Birth | Gender | Street | Locality | District | State | Pincode | Mobile | Email |
|----------------|-----------|---------------|--------|--------|----------|----------|-------|---------|--------|-------|
| 123456789012 | Ram Kumar Sharma | 1990-05-15 | M | 123 Main Street | City Center | Mumbai | Maharashtra | 400001 | 9876543210 | ram.sharma@email.com |
| 987654321098 | Sita Devi | 1985-12-20 | F | House No. 45 | Suburb Area | Pune | Maharashtra | 411001 | 9876543211 | sita.devi@email.com |
| 112233445566 | John Doe | 1995-03-10 | M | Building A, Flat 201 | Village Panchayat | Bangalore | Karnataka | 560001 | 9876543212 | john.doe@email.com |
| 998877665544 | Priya Patel | 2000-07-25 | F | Near Park | Town Square | Delhi | Delhi | 110001 | 9876543213 | priya.patel@email.com |
| 556677889900 | Mohan Singh | 1988-11-08 | M | 456 Oak Avenue | Market Area | Kolkata | West Bengal | 700001 | 9876543214 | mohan.singh@email.com |
| 12345678901 | Invalid Aadhaar | 1990-01-01 | M | Test St | Test Locality | Test District | Test State | 123456 | 9876543215 | test@email.com |
| 223344556677 | Missing Fields | | F | | | | | | | |
| ... (continue with 17 more rows) |

---

## How to Use

1. **Copy the prompt above** and paste it into ChatGPT
2. **Ask ChatGPT** to generate the dataset
3. **Copy the output** from ChatGPT
4. **Paste into Excel**:
   - Open Excel
   - Paste the data
   - Adjust formatting if needed (especially for Aadhaar and mobile numbers - set as Text format to preserve leading zeros)
5. **Save as** `.xlsx` or `.csv` file
6. **Test upload** using the bulk upload feature

---

## Quick Test Cases to Include

When creating the dataset, ensure it includes these test cases:

1. **Valid rows** (15-17 rows) - All fields correct
2. **Invalid Aadhaar** (1 row) - Less than 12 digits or contains letters
3. **Missing required field** (1 row) - Missing locality, district, state, pincode, or mobile
4. **Invalid pincode** (1 row) - Less than 6 digits or contains letters
5. **Invalid email** (1 row, optional) - Invalid email format
6. **Missing DOB** (1 row) - Empty or invalid date format

This will help test error handling in the bulk upload feature.

---

## Excel Formatting Tips

1. **Aadhaar Numbers**: Format as Text (prevents Excel from converting to scientific notation)
2. **Mobile Numbers**: Format as Text (preserves leading zeros)
3. **Pincodes**: Format as Text (preserves leading zeros)
4. **Dates**: Use consistent date format (YYYY-MM-DD recommended)
5. **Headers**: Make sure first row contains column headers

---

## Direct CSV Sample (Copy-Paste Ready)

```
Aadhaar Number,Full Name,Date of Birth,Gender,Street,Locality,District,State,Pincode,Mobile,Email
123456789012,Ram Kumar Sharma,1990-05-15,M,123 Main Street,City Center,Mumbai,Maharashtra,400001,9876543210,ram.sharma@email.com
987654321098,Sita Devi,1985-12-20,F,House No. 45,Suburb Area,Pune,Maharashtra,411001,9876543211,sita.devi@email.com
112233445566,John Doe,1995-03-10,M,Building A Flat 201,Village Panchayat,Bangalore,Karnataka,560001,9876543212,john.doe@email.com
998877665544,Priya Patel,2000-07-25,F,Near Park,Town Square,Delhi,Delhi,110001,9876543213,priya.patel@email.com
556677889900,Mohan Singh,1988-11-08,M,456 Oak Avenue,Market Area,Kolkata,West Bengal,700001,9876543214,mohan.singh@email.com
223344556677,Anjali Verma,1992-08-30,F,789 Pine Road,Residential Area,Chennai,Tamil Nadu,600001,9876543215,anjali.verma@email.com
334455667788,Ravi Kumar,1987-04-12,M,321 Elm Street,Commercial Area,Hyderabad,Telangana,500001,9876543216,ravi.kumar@email.com
445566778899,Deepika Reddy,1993-09-18,F,654 Maple Avenue,Industrial Area,Ahmedabad,Gujarat,380001,9876543217,deepika.reddy@email.com
556677889911,Vikram Malhotra,1989-06-22,M,987 Cedar Lane,IT Park,Bhubaneswar,Odisha,751001,9876543218,vikram.malhotra@email.com
667788990011,Neha Agarwal,1991-02-14,F,147 Birch Street,University Area,Jaipur,Rajasthan,302001,9876543219,neha.agarwal@email.com
778899001122,Amit Joshi,1986-10-05,M,258 Spruce Road,Old City,Lucknow,Uttar Pradesh,226001,9876543220,amit.joshi@email.com
889900112233,Kavita Nair,1994-07-28,F,369 Ash Avenue,New Town,Patna,Bihar,800001,9876543221,kavita.nair@email.com
990011223344,Arjun Mehta,1990-03-19,M,741 Willow Lane,Garden City,Chandigarh,Punjab,160001,9876543222,arjun.mehta@email.com
101112131415,Meera Iyer,1988-12-03,F,852 Poplar Street,Temple Area,Varanasi,Uttar Pradesh,221001,9876543223,meera.iyer@email.com
121314151617,Suresh Menon,1985-05-25,M,963 Hickory Road,Beach Area,Goa,Goa,403001,9876543224,suresh.menon@email.com
131415161718,Anita Rao,1992-11-09,F,159 Fir Avenue,Port Area,Visakhapatnam,Andhra Pradesh,530001,9876543225,anita.rao@email.com
141516171819,Rajesh Tiwari,1987-08-16,M,357 Hemlock Street,Airport Area,Indore,Madhya Pradesh,452001,9876543226,rajesh.tiwari@email.com
151617181920,Sunita Menon,1993-04-07,F,468 Cypress Lane,Hill Station,Shimla,Himachal Pradesh,171001,9876543227,sunita.menon@email.com
161718192021,Nitin Desai,1989-01-21,M,579 Juniper Road,Plains Area,Amritsar,Punjab,143001,9876543228,nitin.desai@email.com
171819202122,Invalid Test,1990-01-01,M,Test Street,Test Locality,Test District,Test State,123456,9876543229,invalid-email
```

**Note**: Copy this CSV data, paste into Excel, save as `.xlsx` or `.csv` file, and use for testing.

---

## Verification Checklist

Before using the generated data:

- [ ] All Aadhaar numbers are exactly 12 digits
- [ ] All mobile numbers are exactly 10 digits
- [ ] All pincodes are exactly 6 digits
- [ ] All required fields (Name, DOB, Gender, Locality, District, State, Pincode, Mobile) are filled
- [ ] Dates are in a consistent format
- [ ] Email addresses are in valid format (if provided)
- [ ] At least 2-3 rows have intentional errors for testing
- [ ] Column headers match the expected format (or variations that API normalizes)

---

## Usage Tips

1. **Start Small**: Test with 5-10 rows first
2. **Gradual Testing**: Add more rows as you verify the upload works
3. **Error Testing**: Include rows with errors to test validation
4. **Format Check**: Ensure Excel doesn't auto-format numbers (Aadhaar, mobile, pincode should be text)
5. **Save Format**: Save as `.xlsx` for Excel or `.csv` for CSV format
