import db from "../db/index.js";

export async function createResetToken(userId, tokenHash, expiresAt) {
  // Remove any existing tokens for this user first
  await db.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [userId]);

  const result = await db.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3) RETURNING *`,
    [userId, tokenHash, expiresAt]
  );
  return result.rows[0];
}

export async function findResetToken(tokenHash) {
  const result = await db.query(
    `SELECT * FROM password_reset_tokens
     WHERE token_hash = $1 AND expires_at > NOW()`,
    [tokenHash]
  );
  return result.rows[0];
}

export async function deleteResetToken(id) {
  await db.query("DELETE FROM password_reset_tokens WHERE id = $1", [id]);
}

export async function deleteExpiredTokens() {
  await db.query("DELETE FROM password_reset_tokens WHERE expires_at <= NOW()");
}
