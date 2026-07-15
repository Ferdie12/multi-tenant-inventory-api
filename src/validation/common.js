import Joi from "joi";

import { HttpError } from "../error/response-error.js";

export function validate(schema, value) {
  const result = schema.validate(value, { abortEarly: false });
  if (result.error) {
    throw new HttpError(
      400,
      "Request validation failed",
      result.error.details.map((detail) => detail.message)
    );
  }
  return result.value;
}
