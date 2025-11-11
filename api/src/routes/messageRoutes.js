import express from "express";
import { verifyAccessToken } from "../middleware/auth.js";
import * as messageController from "../controllers/messageController.js";

const router = express.Router();

// All routes require authentication
router.use(verifyAccessToken);

// ============ GET MESSAGES ============
// Get messages for a conversation
router.get("/conversations/:conversationId", messageController.getMessages);

// Get messages with pagination (alternative endpoint)
router.get(
  "/conversations/:conversationId/paginated",
  messageController.getMessagesPaginated
);

// Get single message by ID
router.get("/:messageId", messageController.getMessage);

// ============ EDIT/DELETE ============
// Edit message
router.patch("/:messageId/edit", messageController.editMessage);

// Delete message for current user
router.delete("/:messageId", messageController.deleteMessage);

// Delete message for everyone (sender only)
router.delete(
  "/:messageId/everyone",
  messageController.deleteMessageForEveryone
);

// ============ REACTIONS ============
// Add reaction
router.post("/:messageId/reactions", messageController.addReaction);

// Remove reaction
router.delete("/:messageId/reactions", messageController.removeReaction);

// ============ READ RECEIPTS ============
// Mark message as delivered
router.post("/:messageId/delivered", messageController.markAsDelivered);

// Mark message as read
router.post("/:messageId/read", messageController.markAsRead);

// Mark all conversation messages as read
router.post(
  "/conversations/:conversationId/read",
  messageController.markConversationAsRead
);

export default router;
