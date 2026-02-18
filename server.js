const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();
const connectDB = require("./config/database");

const app = express();

const deleteFileFromServer = require("./routes/deleteFileFromServer");

// Middleware
// Normalize double (or multiple) leading slashes so static files work when frontend uses baseURL + filePath
app.use((req, res, next) => {
  if (req.path.startsWith("//")) {
    const normalized = "/" + req.path.replace(/^\/+/, "");
    return res.redirect(302, normalized);
  }
  next();
});

// Configure CORS to allow credentials from frontend
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Welfare Scheme API",
    status: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    database:
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    timestamp: new Date().toISOString(),
  });
});

// API Routes (to be expanded)
app.use("/api", require("./routes/index"));

// File upload to server code - mount under /api to match frontend
app.use("/api/upload", require("./routes/uploadFileToServer"));

// File delete from server code
app.use(
  "/api/deleteFile",
  (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "http://localhost:5173");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
  },
  deleteFileFromServer
);

// Static file serving
app.use(
  "/public/uploads",
  (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "http://localhost:5173");
    res.header("Cross-Origin-Resource-Policy", "cross-origin"); // Allow loading cross-origin images
    next();
  },
  express.static(path.join(__dirname, "public", "uploads"))
);

// Error handling middleware (must be after all routes)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message: err.message,
  });
});

// 404 handler (must be last, after all routes)
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
