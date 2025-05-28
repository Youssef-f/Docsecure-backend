const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  getAuditLogs,
  getUserAuditLogs,
  getResourceAuditLogs,
  getAuditLogStats,
  cleanupAuditLogs,
} = require("../controllers/auditLogController");

// Admin only routes
router.get("/", auth, getAuditLogs);
router.get("/stats", auth, getAuditLogStats);
router.post("/cleanup", auth, cleanupAuditLogs);

// User specific routes
router.get("/user/:userId", auth, getUserAuditLogs);

// Resource specific routes
router.get("/resource/:resourceType/:resourceId", auth, getResourceAuditLogs);

module.exports = router;
