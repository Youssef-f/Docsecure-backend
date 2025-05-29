const mongoose = require("mongoose");

const folderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Folder name is required"],
      trim: true,
    },
    path: {
      type: String,
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
    },
  },
  {
    timestamps: true,
  }
);

// Add index for faster queries
folderSchema.index({ owner: 1, path: 1 });
folderSchema.index({ parent: 1 });

module.exports = mongoose.model("Folder", folderSchema);
