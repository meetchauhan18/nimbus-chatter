import { ValidationError } from "../utils/AppError.js";

export const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Return all errors, not just first
      stripUnknown: true, // Remove unknown fields
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      return next(new ValidationError(errors[0].message));
    }

    // Replace request data with validated/sanitized data
    req[property] = value;
    next();
  };
};
