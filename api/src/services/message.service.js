import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import { NotFoundError, BadRequestError } from '../utils/AppError.js';

/**
 * Message Service
 * Handles all message-related business logic
 */
export class MessageService {
  /**
   * Create a new message
   */
  async createMessage({ senderId, conversationId, content, type = 'text', metadata = {} }) {
    // Validate conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Verify sender is a participant
    const isSenderInConversation = conversation.participants.some(
      p => p.user.toString() === senderId
    );

    if (!isSenderInConversation) {
      throw new BadRequestError('You are not a participant in this conversation');
    }

    const message = await Message.create({
        clientMsgId: `${senderId}_${Date.now()}_${Math.random().toString(36)}`, // ✅ NEW
        conversationId,
        senderId,
        content,
        type,
        metadata: metadata || {},
        status: 'sent'
    });

    // Update conversation's last message
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt: new Date()
    });

    // Populate sender info
    await message.populate('sender', 'displayName avatar phone');

    return message;
  }

  /**
   * Get messages for a conversation (with pagination)
   */
  async getMessages(conversationId, { before = null, limit = 50 }) {
    const query = { conversation: conversationId };
    
    // Cursor-based pagination
    if (before) {
      query._id = { $lt: before };
    }

    const messages = await Message
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'displayName avatar phone')
      .lean();

    return {
      messages,
      nextCursor: messages.length > 0 ? messages[messages.length - 1]._id : null,
      hasMore: messages.length === limit
    };
  }

  /**
   * Mark message as delivered
   */
  async markAsDelivered(messageId, userId) {
    const message = await Message.findById(messageId);
    
    if (!message) {
      throw new NotFoundError('Message not found');
    }

    // Update delivery status
    if (!message.deliveredTo.includes(userId)) {
      message.deliveredTo.push(userId);
      message.status = 'delivered';
      await message.save();
    }

    return message;
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId, userId) {
    const message = await Message.findById(messageId);
    
    if (!message) {
      throw new NotFoundError('Message not found');
    }

    // Update read status
    if (!message.readBy.some(r => r.user.toString() === userId)) {
      message.readBy.push({
        user: userId,
        readAt: new Date()
      });
      message.status = 'read';
      await message.save();
    }

    return message;
  }

  /**
   * Delete message (soft delete)
   */
  async deleteMessage(messageId, userId) {
    const message = await Message.findById(messageId);
    
    if (!message) {
      throw new NotFoundError('Message not found');
    }

    if (message.sender.toString() !== userId) {
      throw new BadRequestError('You can only delete your own messages');
    }

    message.isDeleted = true;
    message.content = '';
    await message.save();

    return message;
  }

  /**
   * Add reaction to message
   */
  async addReaction(messageId, userId, emoji) {
    const message = await Message.findById(messageId);
    
    if (!message) {
      throw new NotFoundError('Message not found');
    }

    // Remove existing reaction from this user
    message.reactions = message.reactions.filter(
      r => r.user.toString() !== userId
    );

    // Add new reaction
    message.reactions.push({ user: userId, emoji });
    await message.save();

    return message;
  }
}

// Singleton instance
export const messageService = new MessageService();
