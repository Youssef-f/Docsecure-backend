const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const auth = require("../middleware/auth");

// Base route
router.get("/", (req, res) => {
  res.json({ message: "User API is working" });
});

// Public routes
router.post("/register", userController.register);
router.post("/login", userController.login);

// Protected routes (require authentication)
router.get("/profile", auth, userController.getProfile);
router.put("/profile", auth, userController.updateProfile);
router.put("/change-password", auth, userController.changePassword);

// Admin only routes
router.get("/all", auth, userController.getAllUsers);
router.put("/:userId/role", auth, userController.updateUserRole);
router.delete("/:userId", auth, userController.deleteUser);

module.exports = router;
