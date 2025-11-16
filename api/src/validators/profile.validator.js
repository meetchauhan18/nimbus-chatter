import Joi from "joi";

export const updateProfileSchema = Joi.object({
  displayName: Joi.string().min(2).max(50).trim().optional(),
  username: Joi.string()
    .pattern(/^[a-zA-Z0-9._-]+$/)
    .min(3)
    .max(30)
    .trim()
    .optional(),
  about: Joi.string().max(150).trim().allow("").optional(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "any.required": "Current password is required",
  }),
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?^()_+=\-\[\]{};:'",.<>\/\\|`~])/
    )
    .required()
    .messages({
      "string.min": "New password must be at least 8 characters",
      "string.pattern.base":
        "New password must contain uppercase, lowercase, number, and special character",
      "any.required": "New password is required",
    }),
});

export const requestPasswordResetSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Valid email is required",
    "any.required": "Email is required",
  }),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    "any.required": "Reset token is required",
  }),
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?^()_+=\-\[\]{};:'",.<>\/\\|`~])/
    )
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters",
      "string.pattern.base":
        "Password must contain uppercase, lowercase, number, and special character",
      "any.required": "Password is required",
    }),
});
