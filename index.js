const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const cors = require("cors");

// Import routes
const userRoutes = require("./routes/userRoutes");
const documentRoutes = require("./routes/documentRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");

// Middleware
app.use(cors());
app.use(express.json());

// Debug logging
console.log("Starting server...");
console.log("Environment variables:", {
  PORT: process.env.PORT,
  MONGODB_URI: process.env.MONGODB_URI
    ? "MongoDB URI is set"
    : "MongoDB URI is not set",
});

// MongoDB Connection
mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/document-management"
  )
  .then(() => {
    console.log("Successfully connected to MongoDB.");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  });

// Routes
app.use("/api/users", userRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/audit-logs", auditLogRoutes);

// Debug route
app.get("/test", (req, res) => {
  res.json({ message: "Server is working!" });
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log("Available routes:");
  console.log("- GET  /");
  console.log("- GET  /test");
  console.log("- POST /api/users/register");
  console.log("- POST /api/users/login");
  console.log("- POST /api/documents/upload");
  console.log("- GET  /api/documents");
  console.log("- GET  /api/documents/:id");
  console.log("- GET  /api/documents/:id/download");
  console.log("- PUT  /api/documents/:id");
  console.log("- DELETE /api/documents/:id");
  console.log("- POST /api/documents/:id/share");
});
