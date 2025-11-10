import Joi from "joi";

export const registerSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .lowercase()
    .trim()
    .max(255)
    .messages({
      "string.email": "Email must be a valid email address",
      "any.required": "Email is required",
    }),

  username: Joi.string()
    .pattern(/^[a-zA-Z0-9._-]+$/)
    .min(3)
    .max(30)
    .required()
    .trim()
    .messages({
      "string.pattern.base":
        "Username can only contain letters, numbers, dots, underscores, and hyphens",
      "string.min": "Username must be at least 3 characters",
      "string.max": "Username must not exceed 30 characters",
      "any.required": "Username is required",
    }),

  password: Joi.string().min(8).max(128).required().messages({
    "string.min": "Password must be at least 8 characters",
    "any.required": "Password is required",
  }),
});

export const loginSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .lowercase()
    .trim()
    .messages({
      "string.email": "Email must be a valid email address",
      "any.required": "Email is required",
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
