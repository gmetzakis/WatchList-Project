import db from "../db/index.js";
import { fetchTMDBMedia } from "../services/tmdb.js";

export async function findMediaByTMDBId(tmdbId) {
  const result = await db.query(
    `SELECT * FROM media WHERE tmdb_id = $1`,
    [tmdbId]
  );
  return result.rows[0];
}

export async function createMedia(mediaData) {
  const { tmdb_id, type, title, poster_path, release_year } = mediaData;

  const result = await db.query(
    `INSERT INTO media (tmdb_id, type, title, poster_path, release_year)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [tmdb_id, type, title, poster_path, release_year]
  );

  return result.rows[0];
}

export async function findOrCreateMedia(tmdbId, type) {
  const existing = await findMediaByTMDBId(tmdbId);
  if (existing) return existing;

  const mediaData = await fetchTMDBMedia(tmdbId, type);
  return await createMedia(mediaData);
}