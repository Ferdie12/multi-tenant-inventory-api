export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function routeNotFound(_req, res) {
  return sendError(res, { status: 404, message: "Route not found" });
}

export function handleError(error, _req, res, _next) {
  if (error.code === "P2002") {
    return sendError(res, {
      status: 409,
      message: "A resource with that SKU or code already exists"
    });
  }

  const status = error.status ?? 500;
  return sendError(res, {
    status,
    message: status === 500 ? "Internal server error" : error.message,
    errors: error.details
  });
}
import { sendError } from "../response/api-response.js";

