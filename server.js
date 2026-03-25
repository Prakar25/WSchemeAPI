const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
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

// Swagger UI
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

// Scheduled fraud/redundancy check (4x daily by default)
const fraudCheckEnabled = process.env.FRAUD_CHECK_ENABLED !== "false";
if (fraudCheckEnabled) {
  const cron = require("node-cron");
  const { runFraudCheck } = require("./jobs/fraudCheck");
  const schedule = process.env.FRAUD_CHECK_CRON || "0 6,12,18,0 * * *"; // 6am, 12pm, 6pm, midnight

  cron.schedule(schedule, () => {
    runFraudCheck();
  });

  if (process.env.FRAUD_CHECK_RUN_ON_START === "true") {
    runFraudCheck();
  }
}

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
// Compatibility: some reverse proxies strip the `/api` prefix before forwarding.
// Mounting the same router at root allows both `/api/...` and `/<route>` to work.
app.use("/", require("./routes/index"));

// File upload to server code - mount under /api to match frontend
app.use("/api/upload", require("./routes/uploadFileToServer"));
app.use("/upload", require("./routes/uploadFileToServer"));

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
app.use(
  "/deleteFile",
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
const staticUploadsHeaders = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:5173");
  res.header("Cross-Origin-Resource-Policy", "cross-origin"); // Allow loading cross-origin images
  next();
};

// Resolve uploads directory robustly.
// If the server is started from `dist/server.js`, `__dirname` becomes `dist/`
// and `dist/public/uploads` won't exist. In that case we fall back to ../public/uploads.
const uploadsDirCandidate1 = path.join(__dirname, "public", "uploads");
const uploadsDirCandidate2 = path.join(__dirname, "..", "public", "uploads");
const uploadsDir = fs.existsSync(uploadsDirCandidate1)
  ? uploadsDirCandidate1
  : fs.existsSync(uploadsDirCandidate2)
    ? uploadsDirCandidate2
    : uploadsDirCandidate1;

// Serve under both URL prefixes to avoid frontend/static-path mismatches.
app.use(
  "/public/uploads",
  staticUploadsHeaders,
  express.static(uploadsDir)
);
app.use(
  "/uploads",
  staticUploadsHeaders,
  express.static(uploadsDir)
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
