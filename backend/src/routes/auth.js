const crypto = require('node:crypto');
const { promisify } = require('node:util');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const Citizen = require('../models/Citizen');
const { getBearerToken, requireCitizen } = require('../middleware/citizenAuth');

const scrypt = promisify(crypto.scrypt);
const router = express.Router();
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const passwordParameters = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const dummySalt = Buffer.alloc(16, 7);
const dummyPasswordHash = hashPassword('invalid-citizen-login', dummySalt);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const accountRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many account attempts. Please wait 15 minutes and try again.' },
});

async function hashPassword(password, salt = crypto.randomBytes(16)) {
  const hash = await scrypt(password, salt, 64, passwordParameters);
  return `${salt.toString('base64url')}.${hash.toString('base64url')}`;
}

async function verifyPassword(password, storedHash) {
  const [saltPart, hashPart] = storedHash.split('.');
  const salt = Buffer.from(saltPart, 'base64url');
  const expected = Buffer.from(hashPart, 'base64url');
  const actual = await scrypt(password, salt, expected.length, passwordParameters);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

async function createSession(user) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await Citizen.createSession(user.id, tokenHash, expiresAt);
  return { token, expiresAt: expiresAt.toISOString() };
}

function validEmail(value) {
  return typeof value === 'string'
    && value.length <= 254
    && emailPattern.test(value);
}

router.post('/register', accountRateLimit, async (req, res, next) => {
  try {
    const fullName = typeof req.body.fullName === 'string' ? req.body.fullName.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.password;
    if (fullName.length < 2 || fullName.length > 100) {
      return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
    }
    if (!validEmail(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be between 10 and 128 characters.' });
    }

    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = await Citizen.create({ fullName, email, passwordHash });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
      }
      throw error;
    }
    const session = await createSession(user);
    res.status(201).json({ user, ...session });
  } catch (error) {
    next(error);
  }
});

router.post('/login', accountRateLimit, async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.password;
    if (!validEmail(email) || typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ error: 'Enter a valid email and password.' });
    }

    const user = await Citizen.findByEmail(email);
    const storedHash = user ? user.passwordHash : await dummyPasswordHash;
    const passwordIsValid = await verifyPassword(password, storedHash);
    if (!user || !passwordIsValid) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }

    const session = await createSession(user);
    const safeUser = { id: user.id, fullName: user.fullName, email: user.email };
    res.json({ user: safeUser, ...session });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireCitizen, (req, res) => {
  res.json({ user: req.citizen });
});

router.post('/logout', async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await Citizen.deleteSession(tokenHash);
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
