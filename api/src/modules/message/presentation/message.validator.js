import Joi from "joi";

/**
 * Message Validation Schemas
 * Validates incoming HTTP requests
 */
export const messageValidator = {
  sendMessage: Joi.object({
    body: Joi.object({
      conversationId: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid conversation ID"),
      content: Joi.string().required().min(1).max(5000).trim(),
      type: Joi.string()
        .valid("text", "image", "video", "audio", "file", "location")
        .default("text"),
      metadata: Joi.object().optional(),
    }),
  }),

  getMessages: Joi.object({
    params: Joi.object({
      conversationId: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid conversation ID"),
    }),
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(50),
    }),
  }),

  getMessageById: Joi.object({
    params: Joi.object({
      messageId: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid message ID"),
    }),
  }),

  markAsRead: Joi.object({
    params: Joi.object({
      messageId: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid message ID"),
    }),
  }),

  markAllAsRead: Joi.object({
    params: Joi.object({
      conversationId: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid conversation ID"),
    }),
  }),

  deleteMessage: Joi.object({
    params: Joi.object({
      messageId: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid message ID"),
    }),
  }),

  searchMessages: Joi.object({
    params: Joi.object({
      conversationId: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid conversation ID"),
    }),
    query: Joi.object({
      q: Joi.string()
        .required()
        .min(1)
        .max(100)
        .trim()
        .message("Search query is required"),
    }),
  }),
};
