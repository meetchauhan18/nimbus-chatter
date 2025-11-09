import { connectionManager } from '../managers/ConnectionManager.js';
import Conversation from '../../models/Conversation.js';

/**
 * TypingCommand - Handles typing indicators
 */
export class TypingCommand {
  constructor(io) {
    this.io = io;
    this.typingTimers = new Map(); // userId+conversationId -> timer
  }

  /**
   * Handle typing start
   */
  async handleTypingStart(socket, data) {
    try {
      const { conversationId } = data;
      const userId = socket.userId;

      if (!conversationId) {
        return socket.emit('error', {
          event: 'typing:start',
          message: 'Conversation ID is required'
        });
      }

      // Verify user is in conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return;
      }

      const isParticipant = conversation.participants.some(
        p => p.user.toString() === userId
      );

      if (!isParticipant) {
        return;
      }

      // Clear existing timer
      const timerKey = `${userId}:${conversationId}`;
      if (this.typingTimers.has(timerKey)) {
        clearTimeout(this.typingTimers.get(timerKey));
      }

      // Emit to other participants
      const recipients = conversation.participants
        .map(p => p.user.toString())
        .filter(id => id !== userId);

      for (const recipientId of recipients) {
        const recipientSockets = connectionManager.getUserSockets(recipientId);
        recipientSockets.forEach(recipientSocket => {
          recipientSocket.emit('typing:start', {
            conversationId,
            userId
          });
        });
      }

      // Auto-stop after 3 seconds
      const timer = setTimeout(() => {
        this.handleTypingStop(socket, { conversationId });
      }, 3000);

      this.typingTimers.set(timerKey, timer);
    } catch (error) {
      console.error('TypingCommand handleStart error:', error);
    }
  }

  /**
   * Handle typing stop
   */
  async handleTypingStop(socket, data) {
    try {
      const { conversationId } = data;
      const userId = socket.userId;

      if (!conversationId) {
        return;
      }

      // Clear timer
      const timerKey = `${userId}:${conversationId}`;
      if (this.typingTimers.has(timerKey)) {
        clearTimeout(this.typingTimers.get(timerKey));
        this.typingTimers.delete(timerKey);
      }

      // Emit to other participants
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return;
      }

      const recipients = conversation.participants
        .map(p => p.user.toString())
        .filter(id => id !== userId);

      for (const recipientId of recipients) {
        const recipientSockets = connectionManager.getUserSockets(recipientId);
        recipientSockets.forEach(recipientSocket => {
          recipientSocket.emit('typing:stop', {
            conversationId,
            userId
          });
        });
      }
    } catch (error) {
      console.error('TypingCommand handleStop error:', error);
    }
  }
}
