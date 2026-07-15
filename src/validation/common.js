import Joi from "joi";

import { HttpError } from "../error/response-error.js";

export const paginationInput = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50)
});

export function buildPagination(page, limit, totalItems) {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0
  };
}

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
