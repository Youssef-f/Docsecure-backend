const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");

// Generate a random encryption key
const generateKey = () => {
  return crypto.randomBytes(32); // 256 bits
};

// Generate a random IV (Initialization Vector)
const generateIV = () => {
  return crypto.randomBytes(16); // 128 bits
};

// Encrypt a file
const encryptFile = async (inputPath, outputPath) => {
  try {
    // Generate key and IV
    const key = generateKey();
    const iv = generateIV();

    // Create cipher
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

    // Read the file
    const fileBuffer = await fs.readFile(inputPath);

    // Encrypt the file
    const encryptedBuffer = Buffer.concat([
      cipher.update(fileBuffer),
      cipher.final(),
    ]);

    // Save the encrypted file
    await fs.writeFile(outputPath, encryptedBuffer);

    // Return the key and IV for storage
    return {
      key: key.toString("hex"),
      iv: iv.toString("hex"),
    };
  } catch (error) {
    console.error("Encryption error:", error);
    throw error;
  }
};

// Decrypt a file
const decryptFile = async (inputPath, outputPath, key, iv) => {
  try {
    // Convert key and IV from hex strings to buffers
    const keyBuffer = Buffer.from(key, "hex");
    const ivBuffer = Buffer.from(iv, "hex");

    // Create decipher
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      keyBuffer,
      ivBuffer
    );

    // Read the encrypted file
    const encryptedBuffer = await fs.readFile(inputPath);

    // Decrypt the file
    const decryptedBuffer = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);

    // Save the decrypted file
    await fs.writeFile(outputPath, decryptedBuffer);
  } catch (error) {
    console.error("Decryption error:", error);
    throw error;
  }
};

module.exports = {
  encryptFile,
  decryptFile,
};
