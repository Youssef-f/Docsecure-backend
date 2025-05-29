const express = require("express");
const router = express.Router();
const folderController = require("../controllers/folderController");
const { protect } = require("../middleware/authMiddleware");

// All routes are protected
router.use(protect);

// Create a new folder
router.post("/", folderController.createFolder);

// Get all folders for the current user
router.get("/", folderController.getFolders);

// Delete a folder
router.delete("/:id", folderController.deleteFolder);

// Update folder name
router.put("/:id", folderController.updateFolder);

module.exports = router;
