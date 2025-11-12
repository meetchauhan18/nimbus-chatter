import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Cloudinary Storage for Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "nimbus-chat/avatars",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [
      { width: 500, height: 500, crop: "fill", gravity: "face" },
      { quality: "auto" },
    ],
  },
});

// Chat Images Storage (larger, different folder)
const chatImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "nimbus-chat/messages/images",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [
      { width: 1920, quality: "auto:good" }, // Higher quality for chat
    ],
  },
});

// Video Storage
const chatVideoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "nimbus-chat/messages/videos",
    allowed_formats: ["mp4", "mov", "avi", "mkv", "webm"],
    resource_type: "video",
  },
});

// Audio/Voice Notes Storage
const chatAudioStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "nimbus-chat/messages/audio",
    allowed_formats: ["mp3", "wav", "m4a", "ogg", "webm"],
    resource_type: "raw",
  },
});

// Document Storage
const chatDocumentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "nimbus-chat/messages/documents",
    resource_type: "raw",
  },
});

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

export default cloudinary;
