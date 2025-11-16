import { ValidationError } from "../shared/errors/index.js";

export const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const messages = error.details.map((detail) => detail.message);
      throw new ValidationError(messages.join(", "));
    }

    next();
  };
};

export default validate;
