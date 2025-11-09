import { messageService } from '../../services/message.service.js';
import { connectionManager } from '../managers/ConnectionManager.js';
import { messageQueue } from '../managers/MessageQueue.js';
import Conversation from '../../models/Conversation.js';

/**
 * SendMessageCommand - Handles sending messages via WebSocket
 * Command Pattern for modular event handling
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
      const { conversationId, content, type = 'text', metadata = {} } = data;
      const senderId = socket.userId;

      // Validate input
      if (!conversationId || !content) {
        return socket.emit('error', {
          event: 'message:send',
          message: 'Conversation ID and content are required'
        });
      }

      // Create message
      const message = await messageService.createMessage({
        senderId,
        conversationId,
        content,
        type,
        metadata
      });

      // Get conversation participants
      const conversation = await Conversation.findById(conversationId);
      const recipients = conversation.participants
        .map(p => p.user.toString())
        .filter(id => id !== senderId);

      // Emit to sender (confirmation)
      socket.emit('message:sent', {
        tempId: data.tempId, // Client-side temporary ID
        message: this.formatMessage(message)
      });

      // Emit to online recipients
      for (const recipientId of recipients) {
        const recipientSockets = connectionManager.getUserSockets(recipientId);

        if (recipientSockets.length > 0) {
          // User is online - send immediately
          recipientSockets.forEach(recipientSocket => {
            recipientSocket.emit('message:received', {
              message: this.formatMessage(message)
            });
          });

          // Mark as delivered
          await messageService.markAsDelivered(message._id, recipientId);
        } else {
          // User is offline - queue message
          await messageQueue.enqueue(recipientId, {
            event: 'message:received',
            message: this.formatMessage(message)
          });
        }
      }

      console.log(`✉️ Message sent: ${message._id} (${type})`);
    } catch (error) {
      console.error('SendMessageCommand error:', error);
      socket.emit('error', {
        event: 'message:send',
        message: error.message
      });
    }
  }

  /**
   * Format message for client
   */
  formatMessage(message) {
    return {
      id: message._id,
      clientMsgId: message.clientMsgId,
      conversationId: message.conversationId, // ✅ NEW
      sender: {
        id: message.senderId?._id || message.senderId, // ✅ NEW
        displayName: message.senderId?.displayName,
        avatar: message.senderId?.avatar?.url
      },
      content: message.content,
      type: message.type,
      metadata: message.metadata,
      status: message.status,
      createdAt: message.createdAt,
      isDeleted: message.isDeleted
    };
  }
}
