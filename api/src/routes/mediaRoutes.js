import express from "express";
import { verifyAccessToken } from "../middleware/auth.js";
import * as mediaController from "../controllers/mediaController.js";
import {
  uploadChatImage,
  uploadChatVideo,
  uploadChatAudio,
  uploadChatDocument,
} from "../config/cloudinary.js";

const router = express.Router();

// All routes require authentication
router.use(verifyAccessToken);

// ============ MEDIA UPLOADS ============

/**
 * Upload image to conversation
 * POST /api/media/upload/image
 * Body: { conversationId }
 * File: image file
 */
router.post(
  "/upload/image",
  uploadChatImage.single("file"),
  mediaController.uploadImage
);

/**
 * Upload video to conversation
 * POST /api/media/upload/video
 * Body: { conversationId }
 * File: video file
 */
router.post(
  "/upload/video",
  uploadChatVideo.single("file"),
  mediaController.uploadVideo
);

/**
 * Upload audio/voice note to conversation
 * POST /api/media/upload/audio
 * Body: { conversationId }
 * File: audio file
 */
router.post(
  "/upload/audio",
  uploadChatAudio.single("file"),
  mediaController.uploadAudio
);

/**
 * Upload document to conversation
 * POST /api/media/upload/document
 * Body: { conversationId }
 * File: document file
 */
router.post(
  "/upload/document",
  uploadChatDocument.single("file"),
  mediaController.uploadDocument
);

export default router;
