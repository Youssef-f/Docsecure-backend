const AuditLog = require("../models/auditLog");

// Get all audit logs (admin only)
exports.getAuditLogs = async (req, res) => {
  try {
    // Check if user has admin role
    if (!req.user.roles || !req.user.roles.includes("admin")) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    const { startDate, endDate, action, resourceType, userId } = req.query;
    const query = {};

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (action) {
      query.action = action;
    }

    if (resourceType) {
      query.resourceType = resourceType;
    }

    if (userId) {
      query.user = userId;
    }

    const logs = await AuditLog.find(query)
      .populate("user", "username email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching audit logs",
      error: error.message,
    });
  }
};

// Get audit logs for a specific resource (admin only)
exports.getResourceAuditLogs = async (req, res) => {
  try {
    // Check if user has admin role
    if (!req.user.roles || !req.user.roles.includes("admin")) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    const { resourceType, resourceId } = req.params;
    const logs = await AuditLog.find({
      resourceType,
      resourceId,
    })
      .populate("user", "username email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching resource audit logs",
      error: error.message,
    });
  }
};

// Get user's own audit logs
exports.getUserAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find({ user: req.user._id }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching user audit logs",
      error: error.message,
    });
  }
};

// Get audit log statistics
exports.getAuditLogStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchStage = {};

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const stats = await AuditLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            action: "$action",
            status: "$status",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.action",
          total: { $sum: "$count" },
          success: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "success"] }, "$count", 0],
            },
          },
          failure: {
            $sum: {
              $cond: [{ $eq: ["$_id.status", "failure"] }, "$count", 0],
            },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching audit log statistics",
      error: error.message,
    });
  }
};

// Clean up old audit logs (admin only)
exports.cleanupAuditLogs = async (req, res) => {
  try {
    const { daysToKeep = 90 } = req.body;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await AuditLog.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} old audit logs`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error cleaning up audit logs",
      error: error.message,
    });
  }
};
