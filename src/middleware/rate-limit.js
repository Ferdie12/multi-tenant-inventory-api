import { rateLimit } from "express-rate-limit";

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createRateLimiter(options = {}) {
  return rateLimit({
    windowMs: options.windowMs ?? positiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    limit: options.limit ?? positiveInteger(process.env.RATE_LIMIT_MAX, 1_000),
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        status: "error",
        message: "Too many requests"
      });
    },
    ...options
  });
}
