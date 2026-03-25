import db from "../db/index.js";

async function ensureDiscardedRecommendationsTable() {
  await db.query(
    `CREATE TABLE IF NOT EXISTS user_disliked_media (
       user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       PRIMARY KEY (user_id, media_id)
     )`
  );
}

export async function addDiscardedRecommendation(userId, mediaId) {
  await ensureDiscardedRecommendationsTable();

  const result = await db.query(
    `INSERT INTO user_disliked_media (user_id, media_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, media_id)
     DO UPDATE SET created_at = NOW()
     RETURNING user_id, media_id, created_at`,
    [userId, mediaId]
  );

  return result.rows[0];
}

export async function getRecommendationSnapshot() {
  await ensureDiscardedRecommendationsTable();

  const usersResult = await db.query(
    `SELECT
       up.user_id,
       up.username,
       up.first_name,
       up.last_name,
       up.country,
       up.year_of_birth
     FROM user_profiles up
     ORDER BY up.user_id ASC`
  );

  const friendshipsResult = await db.query(
    `SELECT
       fr.requester_id AS user_id,
       fr.receiver_id AS friend_id
     FROM friend_requests fr
     WHERE fr.status = 'accepted'`
  );

  const interactionsResult = await db.query(
    `SELECT
       um.user_id,
       um.status,
       um.rating,
       um.is_favorite,
       um.watched_at,
       um.created_at,
       um.genres AS user_genres,
       m.tmdb_id,
       m.type,
       m.title,
       m.poster_path,
       m.release_year,
       m.genres AS media_genres
     FROM user_media um
     JOIN media m ON m.id = um.media_id
     ORDER BY um.user_id ASC, um.created_at DESC`
  );

  const discardedResult = await db.query(
    `SELECT
       udm.user_id,
       udm.created_at,
       m.tmdb_id,
       m.type
     FROM user_disliked_media udm
     JOIN media m ON m.id = udm.media_id
     ORDER BY udm.user_id ASC, udm.created_at DESC`
  );

  return {
    users: usersResult.rows,
    friendships: friendshipsResult.rows,
    interactions: interactionsResult.rows,
    discarded: discardedResult.rows,
  };
}

export async function getDiscardedRecommendationsByUser(userId, type) {
  await ensureDiscardedRecommendationsTable();

  let filter = "udm.user_id = $1";
  const params = [userId];

  if (type === "movie" || type === "series") {
    params.push(type);
    filter += ` AND m.type = $${params.length}`;
  }

  const result = await db.query(
    `SELECT
       udm.user_id,
       udm.created_at,
       m.tmdb_id,
       m.type
     FROM user_disliked_media udm
     JOIN media m ON m.id = udm.media_id
     WHERE ${filter}
     ORDER BY udm.created_at DESC`,
    params
  );

  return result.rows;
}
