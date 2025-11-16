import cloudinary from "../config/cloudinary.js";
import { BadRequestError } from "../utils/AppError.js";

export class MediaService {
  /**
   * Process uploaded image
   */
  async processImage(file) {
    if (!file) {
      throw new BadRequestError("No file provided");
    }

    return {
      url: file.path,
      publicId: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      width: file.width || null,
      height: file.height || null,
      format: file.format,
    };
  }

  /**
   * Process uploaded video
   */
  async processVideo(file) {
    if (!file) {
      throw new BadRequestError("No file provided");
    }

    // Generate thumbnail
    const thumbnailUrl = cloudinary.url(file.filename, {
      resource_type: "video",
      format: "jpg",
      transformation: [
        { width: 300, height: 300, crop: "fill" },
        { start_offset: "1" },
      ],
    });

    return {
      url: file.path,
      publicId: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      duration: file.duration || null,
      thumbnail: thumbnailUrl,
      format: file.format,
    };
  }

  /**
   * Process uploaded audio
   */
  async processAudio(file) {
    if (!file) {
      throw new BadRequestError("No file provided");
    }

    return {
      url: file.path,
      publicId: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      duration: file.duration || null,
      format: file.format,
    };
  }

  /**
   * Process uploaded document
   */
  async processDocument(file) {
    if (!file) {
      throw new BadRequestError("No file provided");
    }

    return {
      url: file.path,
      publicId: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      originalName: file.originalname,
      format: file.format,
    };
  }

  /**
   * Delete media from Cloudinary
   */
  async deleteMedia(publicId, resourceType = "image") {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
      console.log(`✅ Deleted: ${publicId}`);
      return true;
    } catch (error) {
      console.error("Delete error:", error);
      return false;
    }
  }

  /**
   * Get file type from MIME
   */
  getFileType(mimeType) {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    return "file";
  }
}

export const mediaService = new MediaService();
