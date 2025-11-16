import { asyncHandler } from "../shared/utils/asyncHandler.js";
import { mediaService } from "../services/media.service.js";
import { messageService } from "../services/message.service.js";
import { successResponse } from "../shared/utils/response.js";

/**
 * Upload chat image
 */
export const uploadImage = asyncHandler(async (req, res) => {
  const { conversationId } = req.body;
  const userId = req.user.userId;

  console.log("🚀 ~ uploadImage ~ conversationId:", conversationId);
  console.log("🚀 ~ uploadImage ~ file:", req.file?.filename);

  // Process image
  const mediaData = await mediaService.processImage(req.file);

  // Create message with image
  const message = await messageService.createMessage({
    senderId: userId,
    conversationId,
    type: "image",
    content: mediaData.url,
    metadata: {
      fileName: req.file.originalname,
      fileSize: mediaData.size,
    },
    media: mediaData,
  });

  res.json(successResponse(message, "Image uploaded successfully"));
});

/**
 * Upload chat video
 */
export const uploadVideo = asyncHandler(async (req, res) => {
  const { conversationId } = req.body;
  const userId = req.user.userId;

  console.log("🚀 ~ uploadVideo ~ conversationId:", conversationId);

  // Process video
  const mediaData = await mediaService.processVideo(req.file);

  // Create message with video
  const message = await messageService.createMessage({
    senderId: userId,
    conversationId,
    type: "video",
    content: mediaData.url,
    metadata: {
      fileName: req.file.originalname,
      fileSize: mediaData.size,
      duration: mediaData.duration,
    },
    media: mediaData,
  });

  res.json(successResponse(message, "Video uploaded successfully"));
});

/**
 * Upload audio/voice note
 */
export const uploadAudio = asyncHandler(async (req, res) => {
  const { conversationId } = req.body;
  const userId = req.user.userId;

  console.log("🚀 ~ uploadAudio ~ conversationId:", conversationId);

  // Process audio
  const mediaData = await mediaService.processAudio(req.file);

  // Create message with audio
  const message = await messageService.createMessage({
    senderId: userId,
    conversationId,
    type: "audio",
    content: mediaData.url,
    metadata: {
      fileName: req.file.originalname,
      fileSize: mediaData.size,
      duration: mediaData.duration,
    },
    media: mediaData,
  });

  res.json(successResponse(message, "Audio uploaded successfully"));
});

/**
 * Upload document
 */
export const uploadDocument = asyncHandler(async (req, res) => {
  const { conversationId } = req.body;
  const userId = req.user.userId;

  console.log("🚀 ~ uploadDocument ~ conversationId:", conversationId);

  // Process document
  const mediaData = await mediaService.processDocument(req.file);

  // Create message with document
  const message = await messageService.createMessage({
    senderId: userId,
    conversationId,
    type: "file",
    content: mediaData.url,
    metadata: {
      fileName: mediaData.originalName,
      fileSize: mediaData.size,
    },
    media: mediaData,
  });

  res.json(successResponse(message, "Document uploaded successfully"));
});
