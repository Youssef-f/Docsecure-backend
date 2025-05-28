const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Role name is required"],
      unique: true,
      trim: true,
      lowercase: true,
      enum: ["admin", "manager", "user", "auditor"],
    },
    description: {
      type: String,
      required: [true, "Role description is required"],
      trim: true,
      maxlength: [200, "Description cannot exceed 200 characters"],
    },
    permissions: [
      {
        resource: {
          type: String,
          required: true,
          enum: ["documents", "users", "roles", "logs", "folders", "system"],
        },
        actions: [
          {
            type: String,
            enum: [
              "create",
              "read",
              "update",
              "delete",
              "download",
              "share",
              "manage",
            ],
          },
        ],
      },
    ],
    isDefault: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

roleSchema.statics.getDefaultRoles = function () {
  return this.find({ isDefault: true });
};

roleSchema.methods.hasPermission = function (resource, action) {
  const permission = this.permissions.find((p) => p.resource === resource);
  return permission && permission.actions.includes(action);
};

module.exports = mongoose.model("Role", roleSchema);
