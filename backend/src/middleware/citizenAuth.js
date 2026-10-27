const crypto = require('node:crypto');
const Citizen = require('../models/Citizen');

function getBearerToken(req) {
  const match = /^Bearer ([A-Za-z0-9_-]{40,60})$/.exec(req.get('authorization') || '');
  return match?.[1] || null;
}

async function findCitizen(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return Citizen.findSession(tokenHash);
}

async function requireCitizen(req, res, next) {
  try {
    const citizen = await findCitizen(req);
    if (!citizen) {
      return res.status(401).json({ error: 'Sign in to access your citizen account.' });
    }
    req.citizen = citizen;
    next();
  } catch (error) {
    next(error);
  }
}

async function optionalCitizen(req, res, next) {
  try {
    const authorization = req.get('authorization');
    if (!authorization) {
      req.citizen = null;
      return next();
    }
    const citizen = await findCitizen(req);
    if (!citizen) {
      return res.status(401).json({ error: 'Your citizen session is invalid. Sign in again.' });
    }
    req.citizen = citizen;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { findCitizen, getBearerToken, optionalCitizen, requireCitizen };
