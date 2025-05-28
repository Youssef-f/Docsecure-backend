const mongoose = require("mongoose");

const documentFolderSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: [true, "Document ID is required"],
    },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Folder",
      required: [true, "Folder ID is required"],
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User who added document to folder is required"],
    },
  },
  {
    timestamps: { createdAt: "addedAt", updatedAt: true },
  }
);

documentFolderSchema.index({ documentId: 1, folderId: 1 }, { unique: true });
documentFolderSchema.index({ documentId: 1 });
documentFolderSchema.index({ folderId: 1 });

documentFolderSchema.statics.addDocumentToFolder = async function (
  documentId,
  folderId,
  userId
) {
  try {
    const existing = await this.findOne({ documentId, folderId });
    if (existing) {
      throw new Error("Document is already in this folder");
    }

    return await this.create({
      documentId,
      folderId,
      addedBy: userId,
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      throw new Error("Document is already in this folder");
    }
    throw error;
  }
};

documentFolderSchema.statics.removeDocumentFromFolder = async function (
  documentId,
  folderId
) {
  return await this.findOneAndDelete({ documentId, folderId });
};

documentFolderSchema.statics.getFoldersForDocument = function (documentId) {
  return this.find({ documentId }).populate(
    "folderId",
    "name path description"
  );
};

documentFolderSchema.statics.getDocumentsInFolder = function (folderId) {
  return this.find({ folderId }).populate("documentId");
};

documentFolderSchema.statics.moveDocument = async function (
  documentId,
  fromFolderId,
  toFolderId,
  userId
) {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      if (fromFolderId) {
        await this.findOneAndDelete({
          documentId,
          folderId: fromFolderId,
        }).session(session);
      }

      if (toFolderId) {
        await this.create(
          [
            {
              documentId,
              folderId: toFolderId,
              addedBy: userId,
            },
          ],
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }
};

documentFolderSchema.statics.getFolderTreeWithCounts = async function (userId) {
  const pipeline = [
    {
      $lookup: {
        from: "folders",
        localField: "folderId",
        foreignField: "_id",
        as: "folder",
      },
    },
    {
      $unwind: "$folder",
    },
    {
      $match: {
        "folder.owner": new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $group: {
        _id: "$folderId",
        documentCount: { $sum: 1 },
        folder: { $first: "$folder" },
      },
    },
    {
      $project: {
        _id: "$folder._id",
        name: "$folder.name",
        path: "$folder.path",
        parentFolder: "$folder.parentFolder",
        documentCount: 1,
      },
    },
  ];

  return await this.aggregate(pipeline);
};

module.exports = mongoose.model("DocumentFolder", documentFolderSchema);
