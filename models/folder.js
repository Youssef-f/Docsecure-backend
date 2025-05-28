const mongoose = require("mongoose");

const folderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Folder name is required"],
      trim: true,
      maxlength: [100, "Folder name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    parentFolder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
    },
    path: {
      type: String,
      required: true,
      index: true,
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Folder owner is required"],
    },
    visibility: {
      type: String,
      enum: ["private", "internal", "restricted"],
      default: "private",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    accessRules: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        role: {
          type: String,
          enum: ["viewer", "editor", "admin"],
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
          enum: ["view", "edit"],
        },
        expiresAt: Date,
      },
    ],

    status: {
      type: String,
      enum: ["active", "archived", "deleted"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
folderSchema.index({ owner: 1 });
folderSchema.index({ parentFolder: 1 });
folderSchema.index({ path: 1 });
folderSchema.index({ name: 1, parentFolder: 1 }, { unique: true }); // Unique name within same parent
folderSchema.index({ name: "text", description: "text" });
folderSchema.index({ owner: 1, status: 1 });
folderSchema.index({ "sharedWith.user": 1 });

// Pre-save middleware to generate path
folderSchema.pre("save", async function (next) {
  if (
    this.isNew ||
    this.isModified("name") ||
    this.isModified("parentFolder")
  ) {
    if (this.parentFolder) {
      const parent = await this.constructor.findById(this.parentFolder);
      if (!parent) {
        return next(new Error("Parent folder not found"));
      }
      this.path = `${parent.path}/${this.name}`;
    } else {
      this.path = `/${this.name}`;
    }
  }
  next();
});

folderSchema.virtual("depth").get(function () {
  return this.path.split("/").length - 2;
});

folderSchema.methods.getChildren = function () {
  return this.constructor.find({ parentFolder: this._id });
};

folderSchema.methods.getDescendants = async function () {
  const descendants = [];
  const queue = [this._id];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = await this.constructor.find({ parentFolder: currentId });

    for (const child of children) {
      descendants.push(child);
      queue.push(child._id);
    }
  }

  return descendants;
};

folderSchema.methods.getHierarchy = async function () {
  const hierarchy = [];
  let current = this;

  while (current) {
    hierarchy.unshift({
      _id: current._id,
      name: current.name,
      path: current.path,
    });

    if (current.parentFolder) {
      current = await this.constructor.findById(current.parentFolder);
    } else {
      break;
    }
  }

  return hierarchy;
};

folderSchema.statics.findRootFolders = function (userId) {
  return this.find({ owner: userId, parentFolder: null });
};

folderSchema.statics.findByPath = function (path) {
  return this.findOne({ path });
};

folderSchema.statics.canMoveTo = async function (folderId, newParentId) {
  if (!newParentId) return true; // Can always move to root

  const folder = await this.findById(folderId);
  if (!folder) return false;

  const newParent = await this.findById(newParentId);
  if (!newParent) return false;

  return !newParent.path.startsWith(folder.path + "/");
};

module.exports = mongoose.model("Folder", folderSchema);
