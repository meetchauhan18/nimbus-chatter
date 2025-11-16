import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

// --- Cloudinary Configuration ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

// --- Common File Filter Helper ---
const fileFilter = (allowedTypes) => (req, file, cb) => {
  const isAllowed = allowedTypes.some((type) => file.mimetype.startsWith(type));
  if (isAllowed) cb(null, true);
  else
    cb(new Error(`Only ${allowedTypes.join(", ")} files are allowed`), false);
};

// --- Avatar Storage ---
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "nimbus-chat/avatars",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [
      { width: 500, height: 500, crop: "fill", gravity: "face" },
      { quality: "auto" },
    ],
  },
});

// --- Chat Image Storage ---
const chatImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "nimbus-chat/messages/images",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ width: 1920, quality: "auto:good" }],
  },
});

// --- Video Storage ---
const chatVideoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "nimbus-chat/messages/videos",
    allowed_formats: ["mp4", "mov", "avi", "mkv", "webm"],
    resource_type: "video",
  },
});

// --- Audio Storage ---
const chatAudioStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "nimbus-chat/messages/audio",
    allowed_formats: ["mp3", "wav", "m4a", "ogg", "webm"],
    resource_type: "raw",
  },
});

// --- Document Storage ---
const chatDocumentStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "nimbus-chat/messages/documents",
    resource_type: "raw",
  },
});

// --- Multer Uploaders ---
export const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter(["image/"]),
});

export const uploadChatImage = multer({
  storage: chatImageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: fileFilter(["image/"]),
});

export const uploadChatVideo = multer({
  storage: chatVideoStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: fileFilter(["video/"]),
});

export const uploadChatAudio = multer({
  storage: chatAudioStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: fileFilter(["audio/"]),
});

export const uploadChatDocument = multer({
  storage: chatDocumentStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// --- Default Export ---
export default cloudinary;
