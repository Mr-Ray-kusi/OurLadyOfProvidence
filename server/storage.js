const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { put } = require("@vercel/blob");

function useBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function makeFilename(originalName, fallbackExt) {
  const ext = path.extname(originalName || "").toLowerCase() || fallbackExt;
  return `${Date.now()}-${crypto.randomUUID()}${ext}`;
}

/**
 * Persist an uploaded multer file (memory or disk) and return public metadata.
 * On Vercel (BLOB_READ_WRITE_TOKEN set): stores in Vercel Blob.
 * Locally without token: writes under server/uploads/.
 */
async function saveUpload(file, { folder, fallbackExt = ".bin" }) {
  if (!file) throw new Error("No file provided");

  const filename = file.filename || makeFilename(file.originalname, fallbackExt);
  const contentType = file.mimetype || "application/octet-stream";

  if (useBlobStorage()) {
    const body = file.buffer
      ? file.buffer
      : fs.readFileSync(file.path);

    const blob = await put(`${folder}/${filename}`, body, {
      access: "public",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false
    });

    if (file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        /* ignore */
      }
    }

    return {
      originalName: file.originalname,
      filename,
      url: blob.url,
      size: file.size,
      mimeType: contentType,
      storage: "blob"
    };
  }

  // Local disk fallback
  const uploadsRoot = path.join(__dirname, "uploads", folder);
  if (!fs.existsSync(uploadsRoot)) fs.mkdirSync(uploadsRoot, { recursive: true });

  if (file.buffer) {
    const dest = path.join(uploadsRoot, filename);
    fs.writeFileSync(dest, file.buffer);
  } else if (file.path) {
    const dest = path.join(uploadsRoot, filename);
    if (path.resolve(file.path) !== path.resolve(dest)) {
      fs.renameSync(file.path, dest);
    }
  } else {
    throw new Error("Upload has no buffer or path");
  }

  return {
    originalName: file.originalname,
    filename,
    url: `/uploads/${folder}/${filename}`,
    size: file.size,
    mimeType: contentType,
    storage: "disk"
  };
}

module.exports = {
  useBlobStorage,
  saveUpload
};
