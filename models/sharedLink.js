const mongoose = require("mongoose");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const sharedLinkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: [true, "Document ID is required"],
    },
    linkToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    password: {
      type: String,
      select: false,
    },
    expirationDate: {
      type: Date,
      required: [true, "Expiration date is required"],
    },
    maxViews: {
      type: Number,
      min: 1,
      default: null,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
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

    canView: {
      type: Boolean,
      default: true,
    },
    canDownload: {
      type: Boolean,
      default: false,
    },

    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Link creator is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    lastAccessedAt: {
      type: Date,
    },
    accessHistory: [
      {
        accessedAt: {
          type: Date,
          default: Date.now,
        },
        ipAddress: String,
        userAgent: String,
        action: {
          type: String,
          enum: ["view", "download"],
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes
sharedLinkSchema.index({ linkToken: 1 }, { unique: true });
sharedLinkSchema.index({ documentId: 1 });
sharedLinkSchema.index({ createdBy: 1 });
sharedLinkSchema.index({ expirationDate: 1 });

sharedLinkSchema.pre("save", async function (next) {
  if (this.isNew) {
    let token;
    let exists = true;

    while (exists) {
      token = crypto.randomBytes(32).toString("hex");
      exists = await this.constructor.findOne({ linkToken: token });
    }

    this.linkToken = token;
  }

  if (this.password && this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 12);
  }

  next();
});

sharedLinkSchema.virtual("isExpired").get(function () {
  return this.expirationDate && this.expirationDate < new Date();
});

sharedLinkSchema.virtual("viewLimitReached").get(function () {
  return this.maxViews && this.viewCount >= this.maxViews;
});

sharedLinkSchema.virtual("downloadLimitReached").get(function () {
  return this.maxDownloads && this.downloadCount >= this.maxDownloads;
});

sharedLinkSchema.virtual("isAccessible").get(function () {
  return this.isActive && !this.isExpired && !this.viewLimitReached;
});

sharedLinkSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return true; // No password set
  return await bcrypt.compare(candidatePassword, this.password);
};

sharedLinkSchema.methods.recordAccess = async function (
  action,
  ipAddress,
  userAgent
) {
  if (action === "view") {
    this.viewCount += 1;
  } else if (
    action === "download" &&
    this.canDownload &&
    !this.downloadLimitReached
  ) {
    this.downloadCount += 1;
  }

  this.lastAccessedAt = new Date();

  this.accessHistory.push({
    action,
    ipAddress,
    userAgent,
  });

  if (this.accessHistory.length > 100) {
    this.accessHistory = this.accessHistory.slice(-100);
  }

  return await this.save();
};

//
