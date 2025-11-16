import Joi from "joi";

/**
 * Conversation Validation Schemas
 */
export const conversationValidator = {
  getConversations: Joi.object({
    query: Joi.object({
      limit: Joi.number().integer().min(1).max(100).default(50),
      offset: Joi.number().integer().min(0).default(0),
    }),
  }),

  createConversation: Joi.object({
    body: Joi.object({
      participantIds: Joi.array()
        .items(Joi.string().regex(/^[0-9a-fA-F]{24}$/))
        .min(2)
        .max(256)
        .required()
        .messages({
          "array.min": "At least 2 participants required",
          "array.max": "Maximum 256 participants allowed",
        }),
      type: Joi.string()
        .valid("direct", "group", "broadcast")
        .default("direct"),
      name: Joi.string().min(1).max(100).trim().when("type", {
        is: "group",
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
    }),
  }),

  getConversation: Joi.object({
    params: Joi.object({
      id: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid conversation ID"),
    }),
  }),

  updateConversation: Joi.object({
    params: Joi.object({
      id: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid conversation ID"),
    }),
    body: Joi.object({
      name: Joi.string().min(1).max(100).trim().optional(),
      description: Joi.string().max(300).trim().optional(),
      settings: Joi.object().optional(),
    })
      .min(1)
      .messages({
        "object.min": "At least one field must be provided",
      }),
  }),

  deleteConversation: Joi.object({
    params: Joi.object({
      id: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid conversation ID"),
    }),
  }),

  searchConversations: Joi.object({
    query: Joi.object({
      q: Joi.string().required().min(1).max(100).trim().messages({
        "string.empty": "Search query is required",
        "any.required": "Search query is required",
      }),
    }),
  }),

  // Group management validators

  addParticipants: Joi.object({
    params: Joi.object({
      id: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid conversation ID"),
    }),
    body: Joi.object({
      userIds: Joi.array()
        .items(Joi.string().regex(/^[0-9a-fA-F]{24}$/))
        .min(1)
        .max(50)
        .required()
        .messages({
          "array.min": "At least 1 user ID required",
          "array.max": "Maximum 50 users can be added at once",
        }),
    }),
  }),

  removeParticipant: Joi.object({
    params: Joi.object({
      id: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid conversation ID"),
      userId: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid user ID"),
    }),
  }),

  leaveGroup: Joi.object({
    params: Joi.object({
      id: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid conversation ID"),
    }),
  }),

  promoteToAdmin: Joi.object({
    params: Joi.object({
      id: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid conversation ID"),
      userId: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid user ID"),
    }),
  }),

  demoteFromAdmin: Joi.object({
    params: Joi.object({
      id: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid conversation ID"),
      userId: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid user ID"),
    }),
  }),

  updateGroupInfo: Joi.object({
    params: Joi.object({
      id: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid conversation ID"),
    }),
    body: Joi.object({
      name: Joi.string().min(1).max(100).trim().optional(),
      description: Joi.string().max(300).trim().optional(),
      avatar: Joi.object({
        url: Joi.string().uri().optional(),
        publicId: Joi.string().optional(),
      }).optional(),
    })
      .min(1)
      .messages({
        "object.min": "At least one field must be provided",
      }),
  }),

  transferOwnership: Joi.object({
    params: Joi.object({
      id: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid conversation ID"),
    }),
    body: Joi.object({
      newOwnerId: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid user ID"),
    }),
  }),

  getGroupMembers: Joi.object({
    params: Joi.object({
      id: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid conversation ID"),
    }),
  }),
};
