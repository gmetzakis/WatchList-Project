import db from "../db/index.js";

export async function createProfile({
  userId,
  firstName,
  lastName,
  username,
  yearOfBirth,
  country
}) {
  const result = await db.query(
    `INSERT INTO user_profiles 
      (user_id, first_name, last_name, username, year_of_birth, country)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, firstName, lastName, username, yearOfBirth, country]
  );

  return result.rows[0];
}

export async function getProfileByUserId(userId) {
  const result = await db.query(
    `SELECT * FROM user_profiles WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0];
}

export async function updateProfile(userId, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return null;

  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(", ");
  const values = Object.values(fields);

  const result = await db.query(
    `UPDATE user_profiles
     SET ${setClause}
     WHERE user_id = $${keys.length + 1}
     RETURNING *`,
    [...values, userId]
  );

  return result.rows[0];
}

//Probably not needed if we have the generic incrementWatchedCount function, but keeping for reference
// export async function incrementMoviesWatched(userId) {
//   const result = await db.query(
//     `UPDATE user_profiles
//      SET movies_watched = movies_watched + 1
//      WHERE user_id = $1
//      RETURNING movies_watched`,
//     [userId]
//   );
//   return result.rows[0];
// }

// export async function incrementSeriesWatched(userId) {
//   const result = await db.query(
//     `UPDATE user_profiles
//      SET series_watched = series_watched + 1
//      WHERE user_id = $1
//      RETURNING series_watched`,
//     [userId]
//   );
//   return result.rows[0];
// }

export async function incrementWatchedCount(userId, type) {
  const column = type === "movie" ? "movies_watched" : "series_watched";

  await db.query(
    `UPDATE user_profiles
     SET ${column} = ${column} + 1
     WHERE user_id = $1`,
    [userId]
  );
}