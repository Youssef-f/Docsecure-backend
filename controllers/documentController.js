const Document = require("../models/Document");
const Folder = require("../models/folder");
const AuditLog = require("../models/auditLog");
const path = require("path");
const fs = require("fs").promises;
const { encryptFile, decryptFile } = require("../utils/encryption");

// Ensure uploads directory exists
const ensureUploadsDir = async () => {
  const uploadsDir = path.join(process.cwd(), "uploads");
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true });
  }
  return uploadsDir;
};

// Helper function to create audit log
const createAuditLog = async (
  userId,
  action,
  resourceType,
  resourceId,
  status,
  details = {}
) => {
  try {
    await AuditLog.create({
      user: userId,
      action,
      resourceType,
      resourceId,
      status,
      details,
    });
  } catch (error) {
    console.error("Error creating audit log:", error);
  }
};

// Upload a new document
exports.uploadDocument = async (req, res) => {
  try {
    const { name, description, folderId, tags } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Ensure uploads directory exists
    const uploadsDir = await ensureUploadsDir();

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      // Delete the uploaded file
      try {
        await fs.unlink(file.path);
      } catch (error) {
        console.error("Error deleting oversized file:", error);
      }
      return res.status(400).json({ message: "File size exceeds 10MB limit" });
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "image/jpeg",
      "image/png",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      // Delete the uploaded file
      try {
        await fs.unlink(file.path);
      } catch (error) {
        console.error("Error deleting invalid file:", error);
      }
      return res.status(400).json({ message: "File type not supported" });
    }

    // Create encrypted file path
    const encryptedFilePath = path.join(
      uploadsDir,
      `encrypted-${Date.now()}-${path.basename(file.originalname)}`
    );

    try {
      // Encrypt the file
      const { key, iv } = await encryptFile(file.path, encryptedFilePath);

      // Delete the original unencrypted file
      await fs.unlink(file.path);

      const document = await Document.create({
        name: name || file.originalname,
        description,
        filePath: encryptedFilePath,
        fileType: file.mimetype,
        fileSize: file.size,
        owner: req.user._id,
        folder: folderId,
        tags: tags ? tags.split(",").map((tag) => tag.trim()) : [],
        isEncrypted: true,
        encryptionKey: key,
        encryptionIV: iv,
      });

      await createAuditLog(
        req.user._id,
        "document_upload",
        "document",
        document._id,
        "success",
        { fileName: file.originalname, fileSize: file.size }
      );

      res.status(201).json({
        success: true,
        data: document,
      });
    } catch (error) {
      // Clean up files if encryption fails
      try {
        if (fs.existsSync(file.path)) {
          await fs.unlink(file.path);
        }
        if (fs.existsSync(encryptedFilePath)) {
          await fs.unlink(encryptedFilePath);
        }
      } catch (cleanupError) {
        console.error("Error cleaning up files:", cleanupError);
      }
      throw error;
    }
  } catch (error) {
    console.error("Upload error:", error);
    await createAuditLog(
      req.user._id,
      "document_upload",
      "document",
      null,
      "failure",
      { error: error.message }
    );

    res.status(500).json({
      success: false,
      message: "Error uploading document",
      error: error.message,
    });
  }
};

// Get all documents for a user
exports.getDocuments = async (req, res) => {
  try {
    const { folderId, search, status = "active" } = req.query;
    const query = {
      $or: [{ owner: req.user._id }, { "sharedWith.user": req.user._id }],
      status,
    };

    if (folderId) {
      query.folder = folderId;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    const documents = await Document.find(query)
      .populate("owner", "username email")
      .populate("folder", "name path")
      .sort({ createdAt: -1 });

    await createAuditLog(
      req.user._id,
      "document_view",
      "document",
      null,
      "success",
      { search, folderId }
    );

    res.status(200).json({
      success: true,
      count: documents.length,
      data: documents,
    });
  } catch (error) {
    await createAuditLog(
      req.user._id,
      "document_view",
      "document",
      null,
      "failure",
      { error: error.message }
    );

    res.status(500).json({
      success: false,
      message: "Error fetching documents",
      error: error.message,
    });
  }
};

// Get a single document
exports.getDocument = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      $or: [
        { owner: req.user._id },
        { "sharedWith.user": req.user._id },
        {
          accessRules: {
            $elemMatch: {
              type: "user",
              value: req.user._id.toString(),
              permission: { $in: ["view", "read", "write", "admin"] },
            },
          },
        },
      ],
    })
      .populate("owner", "username email")
      .populate("folder", "name path");

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found or you don't have permission to access it",
      });
    }

    await createAuditLog(
      req.user._id,
      "document_view",
      "document",
      document._id,
      "success"
    );

    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    await createAuditLog(
      req.user._id,
      "document_view",
      "document",
      req.params.id,
      "failure",
      { error: error.message }
    );

    res.status(500).json({
      success: false,
      message: "Error fetching document",
      error: error.message,
    });
  }
};

// Download a document
exports.downloadDocument = async (req, res) => {
  try {
    console.log("Download request for document:", req.params.id);
    console.log("User ID:", req.user._id);

    const document = await Document.findOne({
      _id: req.params.id,
      $or: [
        { owner: req.user._id },
        {
          "sharedWith.user": req.user._id,
          "sharedWith.accessType": { $in: ["read", "write"] },
        },
      ],
    }).select("+encryptionKey +encryptionIV");

    if (!document) {
      console.log("Document not found or no permission");
      return res.status(404).json({
        success: false,
        message:
          "Document not found or you don't have permission to download it",
      });
    }

    // Ensure uploads directory exists
    const uploadsDir = await ensureUploadsDir();

    // Use absolute path for file operations
    const filePath = path.isAbsolute(document.filePath)
      ? document.filePath
      : path.join(uploadsDir, path.basename(document.filePath));

    console.log("Document found:", {
      id: document._id,
      name: document.name,
      filePath: filePath,
    });

    // Ensure the file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      console.error("File not found:", {
        path: filePath,
        error: error.message,
      });
      return res.status(404).json({
        success: false,
        message: "Document file not found on server",
      });
    }

    // Create temporary decrypted file path
    const decryptedFilePath = path.join(
      uploadsDir,
      `decrypted-${Date.now()}-${path.basename(document.name)}`
    );

    console.log("Decrypting file:", {
      from: filePath,
      to: decryptedFilePath,
    });

    // Decrypt the file
    await decryptFile(
      filePath,
      decryptedFilePath,
      document.encryptionKey,
      document.encryptionIV
    );

    await createAuditLog(
      req.user._id,
      "document_download",
      "document",
      document._id,
      "success"
    );

    // Send the decrypted file
    res.download(decryptedFilePath, document.name, async (err) => {
      // Clean up the temporary decrypted file
      try {
        await fs.unlink(decryptedFilePath);
      } catch (error) {
        console.error("Error cleaning up temporary file:", error);
      }
    });
  } catch (error) {
    console.error("Download error:", error);
    await createAuditLog(
      req.user._id,
      "document_download",
      "document",
      req.params.id,
      "failure",
      { error: error.message }
    );

    res.status(500).json({
      success: false,
      message: "Error downloading document",
      error: error.message,
    });
  }
};

// Update document metadata
exports.updateDocument = async (req, res) => {
  try {
    const { name, description, folderId, tags } = req.body;
    const document = await Document.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const updatedDocument = await Document.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        folder: folderId,
        tags: tags ? tags.split(",").map((tag) => tag.trim()) : document.tags,
        version: document.version + 1,
      },
      { new: true, runValidators: true }
    );

    await createAuditLog(
      req.user._id,
      "document_edit",
      "document",
      document._id,
      "success",
      { updatedFields: Object.keys(req.body) }
    );

    res.status(200).json({
      success: true,
      data: updatedDocument,
    });
  } catch (error) {
    await createAuditLog(
      req.user._id,
      "document_edit",
      "document",
      req.params.id,
      "failure",
      { error: error.message }
    );

    res.status(500).json({
      success: false,
      message: "Error updating document",
      error: error.message,
    });
  }
};

// Delete a document
exports.deleteDocument = async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      owner: req.user._id, // Only owner can delete
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found or you don't have permission to delete it",
      });
    }

    // Ensure uploads directory exists
    const uploadsDir = await ensureUploadsDir();

    // Use absolute path for file operations
    const filePath = path.isAbsolute(document.filePath)
      ? document.filePath
      : path.join(uploadsDir, path.basename(document.filePath));

    // Delete the file from storage
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
    } catch (error) {
      console.error("Error deleting file:", error);
    }

    // Delete from database
    await Document.findByIdAndDelete(req.params.id);

    await createAuditLog(
      req.user._id,
      "document_delete",
      "document",
      document._id,
      "success"
    );

    res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    await createAuditLog(
      req.user._id,
      "document_delete",
      "document",
      req.params.id,
      "failure",
      { error: error.message }
    );

    res.status(500).json({
      success: false,
      message: "Error deleting document",
      error: error.message,
    });
  }
};

// Share document with another user
exports.shareDocument = async (req, res) => {
  try {
    const { userId, accessType } = req.body;
    const documentId = req.params.id;

    console.log("Sharing document:", {
      documentId,
      userId,
      accessType,
      currentUser: req.user._id,
    });

    const document = await Document.findOne({
      _id: documentId,
      owner: req.user._id, // Only owner can share
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found or you don't have permission to share it",
      });
    }

    // Check if already shared with this user
    const existingShare = document.sharedWith.find(
      (share) => share.user.toString() === userId
    );

    if (existingShare) {
      // Update existing share
      existingShare.accessType = accessType;
    } else {
      // Add new share
      document.sharedWith.push({
        user: userId,
        accessType,
      });
    }

    await document.save();

    // Fetch the updated document with populated fields
    const updatedDocument = await Document.findById(documentId)
      .populate("owner", "username email")
      .populate("sharedWith.user", "username email");

    await createAuditLog(
      req.user._id,
      "document_share",
      "document",
      document._id,
      "success",
      { sharedWith: userId, accessType }
    );

    res.status(200).json({
      success: true,
      data: updatedDocument,
    });
  } catch (error) {
    console.error("Share document error:", error);
    await createAuditLog(
      req.user._id,
      "document_share",
      "document",
      req.params.id,
      "failure",
      { error: error.message }
    );

    res.status(500).json({
      success: false,
      message: "Error sharing document",
      error: error.message,
    });
  }
};

// Set access rules for a document
exports.setAccessRules = async (req, res) => {
  try {
    const { rules } = req.body;
    const documentId = req.params.id;

    const document = await Document.findOne({
      _id: documentId,
      owner: req.user._id, // Only owner can set rules
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found or you don't have permission to modify it",
      });
    }

    // Validate rules
    const validRules = rules.map((rule) => ({
      type: rule.type, // 'user', 'role', or 'ip'
      value: rule.value,
      permission: rule.permission, // 'read', 'write', or 'admin'
      expiresAt: rule.expiresAt,
    }));

    document.accessRules = validRules;
    await document.save();

    await createAuditLog(
      req.user._id,
      "access_rules_update",
      "document",
      document._id,
      "success",
      { rules: validRules }
    );

    res.status(200).json({
      success: true,
      data: document,
    });
  } catch (error) {
    await createAuditLog(
      req.user._id,
      "access_rules_update",
      "document",
      req.params.id,
      "failure",
      { error: error.message }
    );

    res.status(500).json({
      success: false,
      message: "Error setting access rules",
      error: error.message,
    });
  }
};

// Remove sharing from a user
exports.removeShare = async (req, res) => {
  try {
    const { userId } = req.params;
    const documentId = req.params.id;

    const document = await Document.findOne({
      _id: documentId,
      owner: req.user._id, // Only owner can remove sharing
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found or you don't have permission to modify it",
      });
    }

    document.sharedWith = document.sharedWith.filter(
      (share) => share.user.toString() !== userId
    );

    await document.save();

    await createAuditLog(
      req.user._id,
      "document_unshare",
      "document",
      document._id,
      "success",
      { unsharedWith: userId }
    );

    res.status(200).json({
      success: true,
      message: "Sharing removed successfully",
    });
  } catch (error) {
    await createAuditLog(
      req.user._id,
      "document_unshare",
      "document",
      req.params.id,
      "failure",
      { error: error.message }
    );

    res.status(500).json({
      success: false,
      message: "Error removing sharing",
      error: error.message,
    });
  }
};
