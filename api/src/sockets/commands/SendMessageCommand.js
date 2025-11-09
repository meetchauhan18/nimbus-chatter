// api/src/sockets/commands/SendMessageCommand.js
import { messageService } from '../../services/message.service.js';
import { connectionManager } from '../managers/ConnectionManager.js';
import { queueMessageDelivery } from '../../queues/messageDeliveryQueue.js';
import Conversation from '../../models/Conversation.js';
import { cacheService } from '../../services/cache.service.js';

/**
 * SendMessageCommand - Handles sending messages via WebSocket
 * Uses BullMQ for reliable delivery with retry logic
 */
export class SendMessageCommand {
  constructor(io) {
    this.io = io;
  }

  /**
   * Execute command
   */
  async execute(socket, data) {
    try {
      const { conversationId, content, type = 'text', metadata = {}, replyTo } = data;
      const senderId = socket.userId;

      // Validate input
      if (!conversationId || !content) {
        return socket.emit('error', {
          event: 'message:send',
          message: 'Conversation ID and content are required'
        });
      }

      // Create message in database
      const message = await messageService.createMessage({
        senderId,
        conversationId,
        content,
        type,
        metadata,
        replyTo,
      });

      // Get conversation participants (with caching)
      let participants = await cacheService.getConversationParticipants(conversationId);
      
      if (!participants) {
        const conversation = await Conversation.findById(conversationId)
          .select('participants')
          .lean();
        
        if (!conversation) {
          throw new Error('Conversation not found');
        }
        
        participants = conversation.participants.map(p => p.user.toString());
        await cacheService.cacheConversationParticipants(conversationId, participants);
      }

      const recipients = participants.filter(id => id !== senderId);

      // Format message for transmission
      const formattedMessage = await this.formatMessage(message);

      // Emit confirmation to sender immediately
      socket.emit('message:sent', {
        tempId: data.tempId, // Client-side temporary ID for optimistic updates
        message: formattedMessage,
      });

      // Deliver to recipients
      for (const recipientId of recipients) {
        const isOnline = await connectionManager.isUserOnline(recipientId);

        if (isOnline) {
          // User is online - emit via pub/sub for cross-instance delivery
          await connectionManager.emitToUser(recipientId, 'message:new', {
            message: formattedMessage,
          });

          // Mark as delivered
          await messageService.markAsDelivered(message._id, recipientId);
        } else {
          // User is offline - queue for delivery with retry
          await queueMessageDelivery(
            recipientId,
            'message:new',
            { message: formattedMessage },
            message._id.toString(),
            1 // Priority (1 = normal)
          );
        }
      }

      console.log(`✉️ Message ${message._id} sent to ${recipients.length} recipients`);

    } catch (error) {
      console.error('SendMessageCommand error:', error);
      socket.emit('error', {
        event: 'message:send',
        message: error.message || 'Failed to send message'
      });
    }
  }

  /**
   * Format message for client with populated fields
   */
  async formatMessage(message) {
    // Populate sender if not already populated
    if (!message.senderId?.displayName) {
      await message.populate('senderId', 'displayName avatar username');
    }

    // Populate reply if exists
    if (message.replyTo && !message.replyTo.content) {
      await message.populate({
        path: 'replyTo',
        select: 'content senderId type createdAt',
        populate: {
          path: 'senderId',
          select: 'displayName avatar',
        },
      });
    }

    return {
      id: message._id,
      clientMsgId: message.clientMsgId,
      conversationId: message.conversationId,
      sender: {
        id: message.senderId._id,
        displayName: message.senderId.displayName,
        avatar: message.senderId.avatar?.url || null,
        username: message.senderId.username || null,
      },
      content: message.content,
      type: message.type,
      metadata: message.metadata,
      media: message.media,
      status: message.status,
      replyTo: message.replyTo ? {
        id: message.replyTo._id,
        content: message.replyTo.content,
        type: message.replyTo.type,
        sender: {
          displayName: message.replyTo.senderId?.displayName,
          avatar: message.replyTo.senderId?.avatar?.url,
        },
      } : null,
      reactions: message.reactions,
      edited: message.edited,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }
}
