import db from "../db/index.js";

// export async function ensureUserAvatarsTable() {
//   await db.query(`
//     CREATE TABLE IF NOT EXISTS user_avatars (
//       user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
//       image_data TEXT NOT NULL,
//       updated_at TIMESTAMP DEFAULT NOW()
//     )
//   `);
// }

export async function getAvatarByUserId(userId) {
  const result = await db.query(
    `SELECT image_data FROM user_avatars WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

export async function upsertAvatar(userId, imageData) {
  const result = await db.query(
    `INSERT INTO user_avatars (user_id, image_data, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET image_data = EXCLUDED.image_data, updated_at = NOW()
     RETURNING user_id`,
    [userId, imageData]
  );

  return result.rows[0];
}
