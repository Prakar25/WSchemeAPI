/**
 * Seeded into DocumentType collection on startup when empty.
 * Add new entries here, then restart API (or POST /api/document-types as admin).
 */
module.exports = [
  {
    key: "aadhaarCard",
    label: "Aadhaar Card",
    aliases: ["Aadhaar Card", "Aadhar Card", "Aadhaar", "aadhaar card"],
    profileReusable: true,
    sortOrder: 10,
  },
  {
    key: "birthCertificate",
    label: "Birth Certificate",
    aliases: ["Birth Certificate", "birth certificate"],
    profileReusable: true,
    sortOrder: 20,
  },
  {
    key: "certificateOfIdentification",
    label: "Certificate of Identification",
    aliases: [
      "Certificate of Identification",
      "Certificate Of Identification",
      "COI",
      "Identification Certificate",
    ],
    profileReusable: true,
    sortOrder: 30,
  },
  {
    key: "bankAccountDetails",
    label: "Bank Account Details",
    aliases: ["Bank Account Details", "Bank Passbook", "Bank Details"],
    profileReusable: false,
    sortOrder: 40,
  },
  {
    key: "residenceProof",
    label: "Residence Proof",
    aliases: ["Residence Proof", "Address Proof"],
    profileReusable: false,
    sortOrder: 50,
  },
  {
    key: "educationalCertificates",
    label: "Educational Certificates",
    aliases: ["Educational Certificates", "Education Certificate", "Marksheet"],
    profileReusable: false,
    sortOrder: 60,
  },
  {
    key: "pregnancyCertificate",
    label: "Pregnancy Certificate",
    aliases: ["Pregnancy Certificate", "Maternity Certificate"],
    profileReusable: false,
    sortOrder: 70,
  },
  {
    key: "schoolCollegeId",
    label: "School/College ID",
    aliases: ["School/College ID", "School ID", "College ID"],
    profileReusable: false,
    sortOrder: 80,
  },
  {
    key: "deathCertificate",
    label: "Death Certificate",
    aliases: ["Death Certificate of Deceased", "Death Certificate"],
    profileReusable: false,
    sortOrder: 90,
  },
  {
    key: "bankPassbookFirstPage",
    label: "Bank Passbook (First Page)",
    aliases: ["First Page of Bank Account Passbook", "Bank Passbook"],
    profileReusable: false,
    sortOrder: 100,
  },
  {
    key: "udidCertificate",
    label: "UDID Certificate",
    aliases: ["UDID Certificate"],
    profileReusable: false,
    sortOrder: 110,
  },
  {
    key: "electoralPhotoId",
    label: "Electoral Photo Identity Card",
    aliases: [
      "Electoral Photo Identity Card",
      "Birth Certificate or Electoral Photo Identity Card",
      "Voter ID",
    ],
    profileReusable: false,
    sortOrder: 120,
  },
  {
    key: "certificateOfIdentificationCopy",
    label: "Attested COI/RC Copy",
    aliases: ["Attested photocopy of COI/RC", "COI/RC"],
    profileReusable: false,
    sortOrder: 130,
  },
  {
    key: "bplRationCard",
    label: "BPL / Ration Card (AAY or PHH)",
    aliases: [
      'Attested copy of Below Poverty Line certificate/Ration card under category of "AAY" or "PHH" duty.',
      "BPL Certificate",
      "Ration Card",
    ],
    profileReusable: false,
    sortOrder: 140,
  },
  {
    key: "gramSabhaResolution",
    label: "Gram Sabha / Ward Sabha Resolution",
    aliases: ["Gram Sabha/Ward Sabha Resolution", "Gram Sabha Resolution"],
    profileReusable: false,
    sortOrder: 150,
  },
];
