import db from "../db/index.js";

export async function getRecommendationSnapshot() {
  const [usersResult, friendshipsResult, interactionsResult] = await Promise.all([
    db.query(
      `SELECT
         up.user_id,
         up.username,
         up.first_name,
         up.last_name,
         up.country,
         up.year_of_birth
       FROM user_profiles up
       ORDER BY up.user_id ASC`
    ),
    db.query(
      `SELECT
         fr.requester_id AS user_id,
         fr.receiver_id AS friend_id
       FROM friend_requests fr
       WHERE fr.status = 'accepted'`
    ),
    db.query(
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
    ),
  ]);

  return {
    users: usersResult.rows,
    friendships: friendshipsResult.rows,
    interactions: interactionsResult.rows,
  };
}
