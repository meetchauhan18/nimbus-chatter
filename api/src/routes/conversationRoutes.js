import express from "express";
import { verifyAccessToken } from "../middleware/auth.js";
import * as conversationController from "../controllers/conversationController.js";

const router = express.Router();

// All routes require authentication
router.use(verifyAccessToken);

router.get("/", conversationController.getConversations);
router.post("/", conversationController.createConversation);
router.get("/:id", conversationController.getConversation);
router.put("/:id", conversationController.updateConversation);

export default router;
