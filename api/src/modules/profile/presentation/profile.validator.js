import Joi from "joi";

/**
 * Profile Validation Schemas
 */
export const profileValidator = {
  updateProfile: Joi.object({
    body: Joi.object({
      displayName: Joi.string().min(2).max(50).trim().optional().messages({
        "string.min": "Display name must be at least 2 characters",
        "string.max": "Display name must not exceed 50 characters",
      }),
      username: Joi.string()
        .min(3)
        .max(30)
        .pattern(/^[a-zA-Z0-9_]+$/)
        .trim()
        .optional()
        .messages({
          "string.min": "Username must be at least 3 characters",
          "string.max": "Username must not exceed 30 characters",
          "string.pattern.base":
            "Username can only contain letters, numbers, and underscores",
        }),
      about: Joi.string().max(200).trim().allow("").optional().messages({
        "string.max": "About must not exceed 200 characters",
      }),
    })
      .min(1)
      .messages({
        "object.min": "At least one field must be provided",
      }),
  }),

  changePassword: Joi.object({
    body: Joi.object({
      currentPassword: Joi.string().required().min(6).messages({
        "string.empty": "Current password is required",
        "string.min": "Password must be at least 6 characters",
        "any.required": "Current password is required",
      }),
      newPassword: Joi.string()
        .required()
        .min(6)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .messages({
          "string.empty": "New password is required",
          "string.min": "New password must be at least 6 characters",
          "string.pattern.base":
            "New password must contain at least one uppercase letter, one lowercase letter, and one number",
          "any.required": "New password is required",
        }),
    }),
  }),

  requestPasswordReset: Joi.object({
    body: Joi.object({
      email: Joi.string().required().email().trim().lowercase().messages({
        "string.empty": "Email is required",
        "string.email": "Invalid email format",
        "any.required": "Email is required",
      }),
    }),
  }),

  resetPassword: Joi.object({
    body: Joi.object({
      token: Joi.string().required().messages({
        "string.empty": "Reset token is required",
        "any.required": "Reset token is required",
      }),
      newPassword: Joi.string()
        .required()
        .min(6)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .messages({
          "string.empty": "New password is required",
          "string.min": "New password must be at least 6 characters",
          "string.pattern.base":
            "New password must contain at least one uppercase letter, one lowercase letter, and one number",
          "any.required": "New password is required",
        }),
    }),
  }),

  updatePrivacy: Joi.object({
    body: Joi.object({
      lastSeen: Joi.string()
        .valid("everyone", "contacts", "nobody")
        .optional()
        .messages({
          "any.only":
            "Invalid value for lastSeen. Must be: everyone, contacts, or nobody",
        }),
      profilePhoto: Joi.string()
        .valid("everyone", "contacts", "nobody")
        .optional()
        .messages({
          "any.only":
            "Invalid value for profilePhoto. Must be: everyone, contacts, or nobody",
        }),
      about: Joi.string()
        .valid("everyone", "contacts", "nobody")
        .optional()
        .messages({
          "any.only":
            "Invalid value for about. Must be: everyone, contacts, or nobody",
        }),
    })
      .min(1)
      .messages({
        "object.min": "At least one privacy setting must be provided",
      }),
  }),
};
