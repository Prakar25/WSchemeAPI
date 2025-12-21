const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router(); // Use router instead of app

// CORS middleware for upload route
router.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:5173");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Set up multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    //const folderName = req.body.folderName; // e.g., 'news-and-events'
    const folderName = "admin-uploads";
    // console.log("folderName", folderName);

    // Check if folderName exists and is valid
    if (!folderName || typeof folderName !== "string") {
      console.error("folderName is missing or not a string", folderName);
      return cb(new Error("Invalid folderName"));
    }

    const folderPath = path.join(
      __dirname,
      "..", //to come out of 'routes' folder and reach the root
      "public",
      "uploads",
      folderName
    ); // Adjusted to server-side path

    // console.log("folderPath", folderPath);

    // Create folder if it doesn't exist
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    cb(null, folderPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname); // Extract file extension
    const fileNameWithoutExt = path.basename(file.originalname, fileExtension); // Extract file name without extension
    const newFileName = `${fileNameWithoutExt}-${uniqueSuffix}${fileExtension}`;

    cb(null, newFileName); // Save file with unique name
  },
});

const upload = multer({ storage: storage });

router.post("/filetoserver", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const filePath = `/uploads/admin-uploads/${req.file.filename}`; // This is the relative path for frontend use
  res.json({ filePath });
});

module.exports = router; // Export the router
