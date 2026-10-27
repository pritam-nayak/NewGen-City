const { rateLimit } = require('express-rate-limit');

const reportRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many reports were submitted from this connection. Please try again later.',
  },
});

module.exports = { reportRateLimiter };
