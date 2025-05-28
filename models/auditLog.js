const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "login",
        "logout",
        "document_upload",
        "document_download",
        "document_view",
        "document_edit",
        "document_delete",
        "document_share",
        "folder_create",
        "folder_edit",
        "folder_delete",
        "access_grant",
        "access_revoke",
      ],
    },
    resourceType: {
      type: String,
      enum: ["document", "folder", "user", "system"],
      required: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "resourceType",
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    status: {
      type: String,
      enum: ["success", "failure"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ status: 1 });

// Static methods
auditLogSchema.statics.logAction = async function (logData) {
  const {
    userId,
    action,
    resourceType,
    resourceId,
    ipAddress,
    userAgent,
    details = {},
    status = "success",
  } = logData;

  try {
    return await this.create({
      user: userId,
      action,
      resourceType,
      resourceId,
      ipAddress,
      userAgent,
      details,
      status,
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    return null;
  }
};

auditLogSchema.statics.getUserActivitySummary = function (userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: "$action",
        count: { $sum: 1 },
        lastOccurrence: { $max: "$timestamp" },
        successRate: {
          $avg: { $cond: ["$success", 1, 0] },
        },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);
};

auditLogSchema.statics.getSecurityEvents = function (
  days = 7,
  riskLevel = "medium"
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const riskLevels = ["medium", "high", "critical"];
  const minRiskIndex = riskLevels.indexOf(riskLevel);
  const allowedRiskLevels = riskLevels.slice(minRiskIndex);

  return this.find({
    timestamp: { $gte: startDate },
    $or: [
      { success: false },
      { riskLevel: { $in: allowedRiskLevels } },
      {
        action: {
          $in: [
            "unauthorized_access_attempt",
            "security_violation",
            "login_failed",
          ],
        },
      },
    ],
  })
    .populate("userId", "username email firstName lastName")
    .sort({ timestamp: -1 })
    .limit(100);
};

auditLogSchema.statics.getResourceHistory = function (
  resourceType,
  resourceId,
  limit = 50
) {
  return this.find({ resourceType, resourceId })
    .populate("userId", "username email firstName lastName")
    .sort({ timestamp: -1 })
    .limit(limit);
};

auditLogSchema.statics.getSystemStats = function (days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    {
      $match: { timestamp: { $gte: startDate } },
    },
    {
      $group: {
        _id: null,
        totalActions: { $sum: 1 },
        uniqueUsers: { $addToSet: "$userId" },
        failedActions: {
          $sum: { $cond: ["$success", 0, 1] },
        },
        securityEvents: {
          $sum: {
            $cond: [{ $in: ["$riskLevel", ["high", "critical"]] }, 1, 0],
          },
        },
        actionsByType: {
          $push: "$action",
        },
      },
    },
    {
      $project: {
        totalActions: 1,
        uniqueUserCount: { $size: "$uniqueUsers" },
        failedActions: 1,
        successRate: {
          $multiply: [
            {
              $divide: [
                { $subtract: ["$totalActions", "$failedActions"] },
                "$totalActions",
              ],
            },
            100,
          ],
        },
        securityEvents: 1,
      },
    },
  ]);
};

auditLogSchema.statics.cleanupOldLogs = async function (retentionDays = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  return await this.deleteMany({
    timestamp: { $lt: cutoffDate },
    riskLevel: { $nin: ["high", "critical"] },
  });
};

// Export the model only if it hasn't been defined yet
module.exports =
  mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
