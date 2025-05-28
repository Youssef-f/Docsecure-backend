const mongoose = require("mongoose");

const documentPermissionSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: [true, "Document ID is required"],
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
    },

    canRead: {
      type: Boolean,
      default: false,
    },
    canWrite: {
      type: Boolean,
      default: false,
    },
    canDownload: {
      type: Boolean,
      default: false,
    },
    canShare: {
      type: Boolean,
      default: false,
    },
    canDelete: {
      type: Boolean,
      default: false,
    },

    accessStartDate: {
      type: Date,
      default: Date.now,
    },
    accessEndDate: {
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

    // Metadata
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Permission granter is required"],
    },
  },
  {
    timestamps: true,
  }
);

documentPermissionSchema.index({ documentId: 1, userId: 1 });
documentPermissionSchema.index({ documentId: 1, roleId: 1 });
documentPermissionSchema.index({ userId: 1 });
documentPermissionSchema.index({ roleId: 1 });

documentPermissionSchema.pre("validate", function (next) {
  if (!this.userId && !this.roleId) {
    return next(new Error("Either userId or roleId must be specified"));
  }
  if (this.userId && this.roleId) {
    return next(new Error("Cannot specify both userId and roleId"));
  }
  next();
});

documentPermissionSchema.virtual("isActive").get(function () {
  const now = new Date();
  const afterStart = !this.accessStartDate || this.accessStartDate <= now;
  const beforeEnd = !this.accessEndDate || this.accessEndDate >= now;
  return afterStart && beforeEnd;
});

documentPermissionSchema.virtual("canStillDownload").get(function () {
  return !this.maxDownloads || this.downloadCount < this.maxDownloads;
});

documentPermissionSchema.methods.incrementDownload = async function () {
  if (this.canDownload && this.canStillDownload) {
    this.downloadCount += 1;
    return await this.save();
  }
  throw new Error("Download not allowed or limit reached");
};

documentPermissionSchema.methods.hasPermission = function (action) {
  if (!this.isActive) return false;

  switch (action) {
    case "read":
      return this.canRead;
    case "write":
      return this.canWrite;
    case "download":
      return this.canDownload && this.canStillDownload;
    case "share":
      return this.canShare;
    case "delete":
      return this.canDelete;
    default:
      return false;
  }
};

documentPermissionSchema.statics.findUserPermissions = function (
  userId,
  documentId
) {
  return this.findOne({ userId, documentId });
};

documentPermissionSchema.statics.findRolePermissions = function (
  roleId,
  documentId
) {
  return this.findOne({ roleId, documentId });
};

documentPermissionSchema.statics.findDocumentPermissions = function (
  documentId
) {
  return this.find({ documentId })
    .populate("userId", "username email firstName lastName")
    .populate("roleId", "name description");
};

module.exports = mongoose.model("DocumentPermission", documentPermissionSchema);
