const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: [true, "Original filename is required"],
      trim: true,
    },
    fileName: {
      type: String,
      required: [true, "Stored filename is required"],
      unique: true,
    },
    filePath: {
      type: String,
      required: [true, "File path is required"],
    },
    fileSize: {
      type: Number,
      required: [true, "File size is required"],
      min: [0, "File size cannot be negative"],
    },
    mimeType: {
      type: String,
      required: [true, "MIME type is required"],
    },
    encryptionKey: {
      type: String,
      required: true,
      select: false,
    },
    checksum: {
      type: String,
      required: true,
    },

    // Metadata
    title: {
      type: String,
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    category: {
      type: String,
      trim: true,
      enum: ["confidential", "internal", "public", "restricted", "personal"],
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    customMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    parentDocument: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
    },
    isLatestVersion: {
      type: Boolean,
      default: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Document owner is required"],
    },
    visibility: {
      type: String,
      enum: ["private", "internal", "restricted"],
      default: "private",
    },

    expirationDate: {
      type: Date,
    },
    maxDownloads: {
      type: Number,
      min: 0,
      default: null,
    },
    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    accessStartDate: {
      type: Date,
      default: Date.now,
    },
    accessEndDate: {
      type: Date,
    },

    status: {
      type: String,
      enum: ["active", "archived", "deleted"],
      default: "active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

documentSchema.index({ owner: 1 });
documentSchema.index({ createdAt: -1 });
documentSchema.index({ tags: 1 });
documentSchema.index({ status: 1 });
documentSchema.index({ category: 1 });
documentSchema.index({ fileName: 1 }, { unique: true });

documentSchema.virtual("isExpired").get(function () {
  return this.expirationDate && this.expirationDate < new Date();
});

documentSchema.virtual("isAccessible").get(function () {
  const now = new Date();
  const afterStart = !this.accessStartDate || this.accessStartDate <= now;
  const beforeEnd = !this.accessEndDate || this.accessEndDate >= now;
  const notExpired = !this.expirationDate || this.expirationDate >= now;
  return afterStart && beforeEnd && notExpired && this.status === "active";
});

documentSchema.virtual("canDownload").get(function () {
  return !this.maxDownloads || this.downloadCount < this.maxDownloads;
});

documentSchema.methods.incrementDownload = async function () {
  this.downloadCount += 1;
  return await this.save();
};

documentSchema.statics.findAccessible = function (userId) {
  const now = new Date();
  return this.find({
    $and: [
      { status: "active" },
      { $or: [{ accessStartDate: { $lte: now } }, { accessStartDate: null }] },
      { $or: [{ accessEndDate: { $gte: now } }, { accessEndDate: null }] },
      { $or: [{ expirationDate: { $gte: now } }, { expirationDate: null }] },
    ],
  });
};

documentSchema.statics.findByOwner = function (userId) {
  return this.find({ owner: userId, status: { $ne: "deleted" } });
};

module.exports = mongoose.model("Document", documentSchema);
