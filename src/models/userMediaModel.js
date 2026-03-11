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


export async function deleteUserMedia(userId, mediaId) {
  await db.query(
    `DELETE FROM user_media
     WHERE user_id = $1 AND media_id = $2`,
    [userId, mediaId]
  );
}


export async function updateUserMediaStatus(userId, mediaId, status) {
  const result = await db.query(
    `UPDATE user_media
     SET status = $3,
         watched_at = CASE WHEN $3 = 'watched' THEN NOW() ELSE NULL END
     WHERE user_id = $1 AND media_id = $2
     RETURNING *`,
    [userId, mediaId, status]
  );

  return result.rows[0];
}


export async function getUserWatchlist(userId) {
  const result = await db.query(
    `SELECT 
        m.id,
        m.tmdb_id,
        m.type,
        m.title,
        m.poster_path,
        m.release_year,
        um.created_at AS added_at
     FROM user_media um
     JOIN media m ON m.id = um.media_id
     WHERE um.user_id = $1
       AND um.status = 'watchlist'
     ORDER BY um.created_at DESC`,
    [userId]
  );

  return result.rows;
}


export async function getUserWatched(userId) {
  const result = await db.query(
    `SELECT 
        m.id,
        m.tmdb_id,
        m.type,
        m.title,
        m.poster_path,
        m.release_year,
        um.watched_at
     FROM user_media um
     JOIN media m ON m.id = um.media_id
     WHERE um.user_id = $1
       AND um.status = 'watched'
     ORDER BY um.watched_at DESC`,
    [userId]
  );

  return result.rows;
}