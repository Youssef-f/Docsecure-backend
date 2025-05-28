const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const auth = require("../middleware/auth");
const {
  uploadDocument,
  getDocuments,
  getDocument,
  downloadDocument,
  updateDocument,
  deleteDocument,
  shareDocument,
  setAccessRules,
  removeShare,
} = require("../controllers/documentController");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// Document routes
router.post("/upload", auth, upload.single("file"), uploadDocument);
router.get("/", auth, getDocuments);
router.get("/:id", auth, getDocument);
router.get("/:id/download", auth, downloadDocument);
router.put("/:id", auth, updateDocument);
router.delete("/:id", auth, deleteDocument);

// Sharing and access control routes
router.post("/:id/share", auth, shareDocument);
router.put("/:id/access-rules", auth, setAccessRules);
router.delete("/:id/share/:userId", auth, removeShare);

module.exports = router;
