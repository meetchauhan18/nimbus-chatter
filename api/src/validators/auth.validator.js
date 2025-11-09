import Joi from "joi";

/**
 * Validation Schemas for Authentication Endpoints
 * Uses Joi for robust input validation
 */

export const registerSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+[1-9]\d{1,14}$/)
    .required()
    .messages({
      "string.pattern.base":
        "Phone must be in E.164 format (e.g., +1234567890)",
      "any.required": "Phone number is required",
    }),

  displayName: Joi.string().min(2).max(50).trim().required().messages({
    "string.min": "Display name must be at least 2 characters",
    "string.max": "Display name must not exceed 50 characters",
    "any.required": "Display name is required",
  }),

  password: Joi.string().min(8).max(128).required().messages({
    "string.min": "Password must be at least 8 characters",
    "any.required": "Password is required",
  }),

  username: Joi.string()
    .pattern(/^[a-zA-Z0-9._-]+$/)
    .min(3)
    .max(30)
    .optional()
    .messages({
      "string.pattern.base":
        "Username can only contain letters, numbers, dots, underscores, and hyphens",
    }),
});

export const loginSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+[1-9]\d{1,14}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone must be in E.164 format",
      "any.required": "Phone number is required",
    }),

  password: Joi.string().required().messages({
    "any.required": "Password is required",
  }),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    "any.required": "Refresh token is required",
  }),
});
