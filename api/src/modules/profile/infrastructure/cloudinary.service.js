import cloudinary from "../../../config/cloudinary.js";

/**
 * Cloudinary Service
 * Handles Cloudinary image operations
 */
export class CloudinaryService {
  constructor() {
    this.cloudinary = cloudinary;
  }

  /**
   * Delete image from Cloudinary
   */
  async deleteImage(publicId) {
    try {
      const result = await this.cloudinary.uploader.destroy(publicId);
      return result;
    } catch (error) {
      throw new Error(
        `Failed to delete image from Cloudinary: ${error.message}`
      );
    }
  }

  /**
   * Upload image to Cloudinary (if you need manual upload)
   */
  async uploadImage(filePath, folder = "avatars") {
    try {
      const result = await this.cloudinary.uploader.upload(filePath, {
        folder,
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
        ],
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (error) {
      throw new Error(`Failed to upload image to Cloudinary: ${error.message}`);
    }
  }
}
