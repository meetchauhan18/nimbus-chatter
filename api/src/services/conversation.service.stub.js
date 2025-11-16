import Conversation from "../models/Conversation.js";

/**
 * Temporary Conversation Service Stub
 * Provides minimal functionality until conversation module is migrated
 * DELETE THIS FILE after migrating conversation module
 */
export class ConversationServiceStub {
  async getById(conversationId) {
    return Conversation.findById(conversationId).populate(
      "participants",
      "username displayName avatar"
    );
  }

  async updateLastMessage(conversationId, messageId) {
    return Conversation.findByIdAndUpdate(
      conversationId,
      {
        lastMessage: messageId,
        updatedAt: new Date(),
      },
      { new: true }
    );
  }
}
