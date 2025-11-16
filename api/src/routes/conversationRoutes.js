import express from "express";
import { verifyAccessToken } from "../middleware/auth.js";
import * as conversationController from "../controllers/conversationController.js";

const router = express.Router();

// All routes require authentication
router.use(verifyAccessToken);

// ========== CONVERSATION ROUTES ==========
router.get("/", conversationController.getConversations);
router.post("/", conversationController.createConversation);
router.get("/:id", conversationController.getConversation);
router.put("/:id", conversationController.updateConversation);

// ========== 👥 GROUP MANAGEMENT ROUTES ==========

// Get group members
router.get("/:id/members", conversationController.getGroupMembers);

// Add participants to group
router.post("/:id/participants", conversationController.addParticipants);

// Remove participant from group
router.delete(
  "/:id/participants/:userId",
  conversationController.removeParticipant
);

// Leave group
router.post("/:id/leave", conversationController.leaveGroup);

// Promote user to admin
router.post("/:id/admins/:userId", conversationController.promoteToAdmin);

// Demote admin to member
router.delete("/:id/admins/:userId", conversationController.demoteFromAdmin);

// Update group info (name, description, avatar)
router.patch("/:id/info", conversationController.updateGroupInfo);

// Transfer ownership
router.post(
  "/:id/transfer-ownership",
  conversationController.transferOwnership
);

export default router;
