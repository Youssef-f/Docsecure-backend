const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide a document name"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
    },
    tags: [String],
    version: {
      type: Number,
      default: 1,
    },
    isEncrypted: {
      type: Boolean,
      default: true,
    },
    encryptionKey: {
      type: String,
      select: false, // Don't include in queries by default
    },
    encryptionIV: {
      type: String,
      select: false, // Don't include in queries by default
    },
    status: {
      type: String,
      enum: ["active", "archived", "deleted"],
      default: "active",
    },
    accessRules: [
      {
        type: {
          type: String,
          enum: ["user", "role", "ip"],
          required: true,
        },
        value: {
          type: String,
          required: true,
        },
        permission: {
          type: String,
          enum: ["view", "read", "write", "admin"],
          required: true,
        },
        expiresAt: Date,
      },
    ],
    sharedWith: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        accessType: {
          type: String,
          enum: ["view", "read", "write"],
          default: "read",
        },
        expiresAt: Date,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for better search performance
documentSchema.index({ name: "text", description: "text", tags: "text" });
documentSchema.index({ owner: 1 });
documentSchema.index({ folder: 1 });
documentSchema.index({ status: 1 });
documentSchema.index({ "sharedWith.user": 1 });

module.exports = mongoose.model("Document", documentSchema);
