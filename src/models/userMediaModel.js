import db from "../db/index.js";

export async function findUserMedia(userId, mediaId) {
  const result = await db.query(
    `SELECT * FROM user_media WHERE user_id = $1 AND media_id = $2`,
    [userId, mediaId]
  );
  return result.rows[0];
}

export async function addUserMedia(userId, mediaId, status, setWatchedAt = false) {
  const result = await db.query(
    `INSERT INTO user_media (user_id, media_id, status, watched_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, media_id)
     DO UPDATE SET 
       status = EXCLUDED.status,
       watched_at = EXCLUDED.watched_at
     RETURNING *`,
    [userId, mediaId, status, setWatchedAt ? new Date() : null]
  );

  return result.rows[0];
}
