export function sendSuccess(res, { status = 200, message, data, pagination }) {
  return res.status(status).json({
    status: "ok",
    message,
    data,
    ...(pagination ? { pagination } : {})
  });
}

export function sendError(res, { status, message, errors }) {
  return res.status(status).json({
    status: "error",
    message,
    ...(errors ? { errors } : {})
  });
}
