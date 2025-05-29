const Folder = require("../models/folder");
const Document = require("../models/Document");
const { createAuditLog } = require("./documentController");

// Create a new folder
exports.createFolder = async (req, res) => {
  try {
    const { name, parentId } = req.body;

    // Validate folder name
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Folder name is required",
      });
    }

    // Check if parent folder exists if parentId is provided
    if (parentId) {
      const parentFolder = await Folder.findOne({
        _id: parentId,
        owner: req.user._id,
      });

      if (!parentFolder) {
        return res.status(404).json({
          success: false,
          message: "Parent folder not found",
        });
      }
    }

    // Create folder path
    const path = parentId ? `${parentFolder.path}/${name}` : `/${name}`;

    const folder = await Folder.create({
      name,
      path,
      owner: req.user._id,
      parent: parentId,
    });

    await createAuditLog(
      req.user._id,
      "folder_create",
      "folder",
      folder._id,
      "success"
    );

    res.status(201).json({
      success: true,
      data: folder,
    });
  } catch (error) {
    await createAuditLog(
      req.user._id,
      "folder_create",
      "folder",
      null,
      "failure",
      { error: error.message }
    );

    res.status(500).json({
      success: false,
      message: "Error creating folder",
      error: error.message,
    });
  }
};

// Get all folders for a user
exports.getFolders = async (req, res) => {
  try {
    const folders = await Folder.find({
      owner: req.user._id,
    }).sort({ path: 1 });

    res.status(200).json({
      success: true,
      data: folders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching folders",
      error: error.message,
    });
  }
};

// Delete a folder
exports.deleteFolder = async (req, res) => {
  try {
    const folder = await Folder.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Folder not found or you don't have permission to delete it",
      });
    }

    // Check if folder has subfolders
    const hasSubfolders = await Folder.exists({
      parent: req.params.id,
    });

    if (hasSubfolders) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete folder with subfolders",
      });
    }

    // Check if folder has documents
    const hasDocuments = await Document.exists({
      folder: req.params.id,
    });

    if (hasDocuments) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete folder with documents",
      });
    }

    // Delete the folder
    await Folder.findByIdAndDelete(req.params.id);

    await createAuditLog(
      req.user._id,
      "folder_delete",
      "folder",
      folder._id,
      "success"
    );

    res.status(200).json({
      success: true,
      message: "Folder deleted successfully",
    });
  } catch (error) {
    await createAuditLog(
      req.user._id,
      "folder_delete",
      "folder",
      req.params.id,
      "failure",
      { error: error.message }
    );

    res.status(500).json({
      success: false,
      message: "Error deleting folder",
      error: error.message,
    });
  }
};

// Update folder name
exports.updateFolder = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Folder name is required",
      });
    }

    const folder = await Folder.findOne({
      _id: req.params.id,
      owner: req.user._id,
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Folder not found or you don't have permission to update it",
      });
    }

    // Update folder name and path
    const oldPath = folder.path;
    const newPath = folder.parent
      ? `${folder.parent.path}/${name}`
      : `/${name}`;

    folder.name = name;
    folder.path = newPath;
    await folder.save();

    // Update paths of all subfolders
    await Folder.updateMany({ path: { $regex: `^${oldPath}/` } }, [
      {
        $set: {
          path: {
            $replaceAll: {
              input: "$path",
              find: oldPath,
              replacement: newPath,
            },
          },
        },
      },
    ]);

    await createAuditLog(
      req.user._id,
      "folder_update",
      "folder",
      folder._id,
      "success",
      { oldName: folder.name, newName: name }
    );

    res.status(200).json({
      success: true,
      data: folder,
    });
  } catch (error) {
    await createAuditLog(
      req.user._id,
      "folder_update",
      "folder",
      req.params.id,
      "failure",
      { error: error.message }
    );

    res.status(500).json({
      success: false,
      message: "Error updating folder",
      error: error.message,
    });
  }
};
