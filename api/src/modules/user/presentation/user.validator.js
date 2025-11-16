import Joi from "joi";

/**
 * User Validation Schemas
 */
export const userValidator = {
  searchUsers: Joi.object({
    query: Joi.object({
      q: Joi.string().required().min(2).max(100).trim().messages({
        "string.empty": "Search query is required",
        "string.min": "Search query must be at least 2 characters",
        "string.max": "Search query must not exceed 100 characters",
        "any.required": "Search query is required",
      }),
      limit: Joi.number().integer().min(1).max(100).default(20).optional(),
    }),
  }),

  getUserById: Joi.object({
    params: Joi.object({
      userId: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid user ID"),
    }),
  }),

  blockUser: Joi.object({
    params: Joi.object({
      userId: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid user ID"),
    }),
  }),

  unblockUser: Joi.object({
    params: Joi.object({
      userId: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid user ID"),
    }),
  }),

  checkBlockStatus: Joi.object({
    params: Joi.object({
      userId: Joi.string()
        .required()
        .regex(/^[0-9a-fA-F]{24}$/)
        .message("Invalid user ID"),
    }),
  }),
};
