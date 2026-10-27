const db = require('../db/connection');

async function findByEmail(email) {
  const { rows } = await db.query(
    `SELECT id, full_name AS "fullName", email, password_hash AS "passwordHash"
     FROM citizen_users
     WHERE email = $1`,
    [email]
  );
  return rows[0] || null;
}

async function create({ fullName, email, passwordHash }) {
  const { rows } = await db.query(
    `INSERT INTO citizen_users (full_name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, full_name AS "fullName", email`,
    [fullName, email, passwordHash]
  );
  return rows[0];
}

async function createSession(userId, tokenHash, expiresAt) {
  await db.query('DELETE FROM citizen_sessions WHERE expires_at <= NOW()');
  await db.query(
    `INSERT INTO citizen_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

async function findSession(tokenHash) {
  const { rows } = await db.query(
    `SELECT u.id, u.full_name AS "fullName", u.email
     FROM citizen_sessions s
     JOIN citizen_users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [tokenHash]
  );
  return rows[0] || null;
}

async function deleteSession(tokenHash) {
  await db.query('DELETE FROM citizen_sessions WHERE token_hash = $1', [tokenHash]);
}

module.exports = {
  create,
  createSession,
  deleteSession,
  findByEmail,
  findSession,
};
