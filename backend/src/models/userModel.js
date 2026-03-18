import db from "../db/index.js";

export async function findUserByEmail(email) {
  const result = await db.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0];
}

export async function createUser(email, passwordHash) {
  const result = await db.query(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *",
    [email, passwordHash]
  );
  return result.rows[0];
}

export async function findUserById(id) {
  const result = await db.query(
    `SELECT id, email FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0];
}

export async function findUserAuthById(id) {
  const result = await db.query(
    `SELECT id, password_hash FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0];
}

export async function updateUserPasswordHash(id, passwordHash) {
  const result = await db.query(
    `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id`,
    [passwordHash, id]
  );
  return result.rows[0];
}