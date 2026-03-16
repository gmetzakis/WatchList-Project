import db from "../db/index.js";


export async function findUserMedia(userId, mediaId) {
  const result = await db.query(
    `SELECT * FROM user_media WHERE user_id = $1 AND media_id = $2`,
    [userId, mediaId]
  );
  return result.rows[0];
}


export async function addUserMedia(userId, mediaId, status, genres, setWatchedAt = false) {
  const result = await db.query(
    `INSERT INTO user_media (user_id, media_id, status, genres, watched_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, media_id)
     DO UPDATE SET 
       status = EXCLUDED.status,
       watched_at = EXCLUDED.watched_at
     RETURNING *`,
    [userId, mediaId, status, genres, setWatchedAt ? new Date() : null]
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


export async function getUserWatchlist(userId, type) {

  let filter = "um.status = 'watchlist'";

  if (type === "movie") {
    filter += " AND m.type = 'movie'";
  }

  if (type === "series") {
    filter += " AND m.type = 'series'";
  }

  const result = await db.query(
    `SELECT 
        m.id,
        m.tmdb_id,
        m.type,
        m.title,
        m.poster_path,
        m.release_year,
        um.created_at AS added_at,
        um.genres
     FROM user_media um
     JOIN media m ON m.id = um.media_id
     WHERE um.user_id = $1
       AND ${filter}
     ORDER BY um.created_at DESC`,
    [userId]
  );

  return result.rows;
}


export async function getUserWatched(userId, sort, favorites, type) {
  let orderBy = "um.watched_at DESC";

  if (sort === "rating_desc") {
    orderBy = "um.rating DESC NULLS LAST, um.watched_at DESC";
  }

  if (sort === "rating_asc") {
    orderBy = "um.rating ASC NULLS LAST, um.watched_at DESC";
  }


  let filter = "um.status = 'watched'";

  if (favorites === "true") {
    filter += " AND um.is_favorite = true";
  }

  if (type === "movie") {
    filter += " AND m.type = 'movie'";
  }

  if (type === "series") {
    filter += " AND m.type = 'series'";
  }

  const result = await db.query(
    `SELECT 
        m.id,
        m.tmdb_id,
        m.type,
        m.title,
        m.poster_path,
        m.release_year,
        um.watched_at,
        um.rating,
        um.is_favorite,
        um.genres
     FROM user_media um
     JOIN media m ON m.id = um.media_id
     WHERE um.user_id = $1
       AND ${filter}
     ORDER BY ${orderBy}`,
    [userId]
  );

  return result.rows;
}


export async function setRating(userId, mediaId, rating) {
  const result = await db.query(
    `UPDATE user_media
     SET rating = $3
     WHERE user_id = $1 AND media_id = $2
     RETURNING *`,
    [userId, mediaId, rating]
  );

  return result.rows[0];
}


export async function setFavorite(userId, mediaId, isFavorite) {
  const result = await db.query(
    `UPDATE user_media
     SET is_favorite = $3
     WHERE user_id = $1 AND media_id = $2
     RETURNING *`,
    [userId, mediaId, isFavorite]
  );

  return result.rows[0];
}


export async function getUserFavorites(userId, sort, type) {

  let orderBy = "um.watched_at DESC";

  if (sort === "rating_desc") {
    orderBy = "um.rating DESC NULLS LAST, um.watched_at DESC";
  }

  if (sort === "rating_asc") {
    orderBy = "um.rating ASC NULLS LAST, um.watched_at DESC";
  }

  let filter = "um.status = 'watched' AND um.is_favorite = true";

  if (type === "movie") {
    filter += " AND m.type = 'movie'";
  }

  if (type === "series") {
    filter += " AND m.type = 'series'";
  }

  const result = await db.query(
    `SELECT 
        m.id,
        m.tmdb_id,
        m.type,
        m.title,
        m.poster_path,
        m.release_year,
        um.watched_at,
        um.rating,
        um.is_favorite,
        um.genres
     FROM user_media um
     JOIN media m ON m.id = um.media_id
     WHERE um.user_id = $1
       AND ${filter}
     ORDER BY ${orderBy}`,
    [userId]
  );

  return result.rows;
}

