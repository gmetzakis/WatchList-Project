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


export async function getUserWatchlist(userId, type, options = {}) {
  const hasPagination = Number.isInteger(options?.limit) && options.limit > 0;
  const page = hasPagination ? Math.max(options.page || 1, 1) : 1;
  const limit = hasPagination ? options.limit : null;
  const offset = hasPagination ? (page - 1) * limit : 0;
  const search = String(options?.search || "").trim();
  const genreId = Number.isInteger(options?.genreId) ? options.genreId : null;

  let orderBy = "um.created_at DESC";
  if (options?.sort === "title_asc") {
    orderBy = "m.title ASC";
  } else if (options?.sort === "title_desc") {
    orderBy = "m.title DESC";
  } else if (options?.sort === "year_asc") {
    orderBy = "m.release_year ASC NULLS LAST, m.title ASC";
  } else if (options?.sort === "year_desc") {
    orderBy = "m.release_year DESC NULLS LAST, m.title ASC";
  }

  let filter = "um.status = 'watchlist'";
  const queryParams = [userId];
  let paramIndex = 2;

  if (type === "movie") {
    filter += ` AND m.type = $${paramIndex}`;
    queryParams.push("movie");
    paramIndex += 1;
  }

  if (type === "series") {
    filter += ` AND m.type = $${paramIndex}`;
    queryParams.push("series");
    paramIndex += 1;
  }

  if (search) {
    filter += ` AND m.title ILIKE $${paramIndex}`;
    queryParams.push(`%${search}%`);
    paramIndex += 1;
  }

  if (genreId) {
    filter += ` AND COALESCE(um.genres::text, '') ~ $${paramIndex}`;
    queryParams.push(`(^|[^0-9])${genreId}([^0-9]|$)`);
    paramIndex += 1;
  }

  const selectQuery = `SELECT 
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
     ORDER BY ${orderBy}`;

  const paginatedQueryParams = hasPagination
    ? [...queryParams, limit, offset]
    : queryParams;

  const queryText = hasPagination
    ? `${selectQuery}\nLIMIT $${paginatedQueryParams.length - 1} OFFSET $${paginatedQueryParams.length}`
    : selectQuery;

  const result = await db.query(queryText, paginatedQueryParams);

  if (!hasPagination) {
    return result.rows;
  }

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM user_media um
     JOIN media m ON m.id = um.media_id
     WHERE um.user_id = $1
       AND ${filter}`,
    queryParams
  );

  const total = countResult.rows[0]?.total || 0;

  return {
    items: result.rows,
    total,
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
}


export async function getUserWatched(userId, sort, favorites, type, options = {}) {
  const hasPagination = Number.isInteger(options?.limit) && options.limit > 0;
  const page = hasPagination ? Math.max(options.page || 1, 1) : 1;
  const limit = hasPagination ? options.limit : null;
  const offset = hasPagination ? (page - 1) * limit : 0;
  const search = String(options?.search || "").trim();
  const genreId = Number.isInteger(options?.genreId) ? options.genreId : null;

  let orderBy = "um.watched_at DESC";

  if (sort === "rating_desc") {
    orderBy = "um.rating DESC NULLS LAST, um.watched_at DESC";
  }

  if (sort === "rating_asc") {
    orderBy = "um.rating ASC NULLS LAST, um.watched_at DESC";
  }

  if (sort === "title_asc") {
    orderBy = "m.title ASC";
  }

  if (sort === "title_desc") {
    orderBy = "m.title DESC";
  }

  if (sort === "year_asc") {
    orderBy = "m.release_year ASC NULLS LAST, m.title ASC";
  }

  if (sort === "year_desc") {
    orderBy = "m.release_year DESC NULLS LAST, m.title ASC";
  }


  let filter = "um.status = 'watched'";
  const queryParams = [userId];
  let paramIndex = 2;

  if (favorites === "true") {
    filter += " AND um.is_favorite = true";
  }

  if (type === "movie") {
    filter += ` AND m.type = $${paramIndex}`;
    queryParams.push("movie");
    paramIndex += 1;
  }

  if (type === "series") {
    filter += ` AND m.type = $${paramIndex}`;
    queryParams.push("series");
    paramIndex += 1;
  }

  if (search) {
    filter += ` AND m.title ILIKE $${paramIndex}`;
    queryParams.push(`%${search}%`);
    paramIndex += 1;
  }

  if (genreId) {
    filter += ` AND COALESCE(um.genres::text, '') ~ $${paramIndex}`;
    queryParams.push(`(^|[^0-9])${genreId}([^0-9]|$)`);
    paramIndex += 1;
  }

  const selectQuery = `SELECT 
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
     ORDER BY ${orderBy}`;

  const paginatedQueryParams = hasPagination
    ? [...queryParams, limit, offset]
    : queryParams;

  const queryText = hasPagination
    ? `${selectQuery}\nLIMIT $${paginatedQueryParams.length - 1} OFFSET $${paginatedQueryParams.length}`
    : selectQuery;

  const result = await db.query(queryText, paginatedQueryParams);

  if (!hasPagination) {
    return result.rows;
  }

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM user_media um
     JOIN media m ON m.id = um.media_id
     WHERE um.user_id = $1
       AND ${filter}`,
    queryParams
  );

  const total = countResult.rows[0]?.total || 0;

  return {
    items: result.rows,
    total,
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
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


export async function getUserFavorites(userId, sort, type, options = {}) {
  const hasPagination = Number.isInteger(options?.limit) && options.limit > 0;
  const page = hasPagination ? Math.max(options.page || 1, 1) : 1;
  const limit = hasPagination ? options.limit : null;
  const offset = hasPagination ? (page - 1) * limit : 0;
  const search = String(options?.search || "").trim();
  const genreId = Number.isInteger(options?.genreId) ? options.genreId : null;

  let orderBy = "um.watched_at DESC";

  if (sort === "rating_desc") {
    orderBy = "um.rating DESC NULLS LAST, um.watched_at DESC";
  }

  if (sort === "rating_asc") {
    orderBy = "um.rating ASC NULLS LAST, um.watched_at DESC";
  }

  if (sort === "title_asc") {
    orderBy = "m.title ASC";
  }

  if (sort === "title_desc") {
    orderBy = "m.title DESC";
  }

  if (sort === "year_asc") {
    orderBy = "m.release_year ASC NULLS LAST, m.title ASC";
  }

  if (sort === "year_desc") {
    orderBy = "m.release_year DESC NULLS LAST, m.title ASC";
  }

  let filter = "um.status = 'watched' AND um.is_favorite = true";
  const queryParams = [userId];
  let paramIndex = 2;

  if (type === "movie") {
    filter += ` AND m.type = $${paramIndex}`;
    queryParams.push("movie");
    paramIndex += 1;
  }

  if (type === "series") {
    filter += ` AND m.type = $${paramIndex}`;
    queryParams.push("series");
    paramIndex += 1;
  }

  if (search) {
    filter += ` AND m.title ILIKE $${paramIndex}`;
    queryParams.push(`%${search}%`);
    paramIndex += 1;
  }

  if (genreId) {
    filter += ` AND COALESCE(um.genres::text, '') ~ $${paramIndex}`;
    queryParams.push(`(^|[^0-9])${genreId}([^0-9]|$)`);
    paramIndex += 1;
  }

  const selectQuery = `SELECT 
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
     ORDER BY ${orderBy}`;

  const paginatedQueryParams = hasPagination
    ? [...queryParams, limit, offset]
    : queryParams;

  const queryText = hasPagination
    ? `${selectQuery}\nLIMIT $${paginatedQueryParams.length - 1} OFFSET $${paginatedQueryParams.length}`
    : selectQuery;

  const result = await db.query(queryText, paginatedQueryParams);

  if (!hasPagination) {
    return result.rows;
  }

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM user_media um
     JOIN media m ON m.id = um.media_id
     WHERE um.user_id = $1
       AND ${filter}`,
    queryParams
  );

  const total = countResult.rows[0]?.total || 0;

  return {
    items: result.rows,
    total,
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
}

