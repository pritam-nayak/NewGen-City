const crypto = require('node:crypto');

function isAuthorized(token) {
  const expected = process.env.OPS_API_TOKEN;
  if (!expected) {
    return process.env.NODE_ENV !== 'production';
  }
  if (!token) {
    return false;
  }

  const providedBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function verifyOperationsAccess(req, res, next) {
  if (!process.env.OPS_API_TOKEN && process.env.NODE_ENV === 'production') {
    return res.status(503).json({
      error: 'Operations access is not configured on this server.',
    });
  }

  const match = /^Bearer (.+)$/i.exec(req.get('authorization') || '');
  if (!isAuthorized(match?.[1])) {
    return res.status(401).json({ error: 'Valid staff access is required.' });
  }
  next();
}

module.exports = { verifyOperationsAccess };
