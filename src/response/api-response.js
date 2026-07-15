export function sendSuccess(res, { status = 200, message, data }) {
  return res.status(status).json({
    status: "ok",
    message,
    data
  });
}

export function sendError(res, { status, message, errors }) {
  return res.status(status).json({
    status: "error",
    message,
    ...(errors ? { errors } : {})
  });
}
