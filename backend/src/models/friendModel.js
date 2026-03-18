import db from "../db/index.js";

// export async function ensureFriendRequestsTable() {
//   await db.query(`
//     CREATE TABLE IF NOT EXISTS friend_requests (
//       id SERIAL PRIMARY KEY,
//       requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//       receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//       requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//       status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
//       receiver_seen BOOLEAN NOT NULL DEFAULT false,
//       requester_seen BOOLEAN NOT NULL DEFAULT true,
//       created_at TIMESTAMP NOT NULL DEFAULT NOW(),
//       responded_at TIMESTAMP,
//       UNIQUE (requester_id, receiver_id)
//     )
//   `);

//   // Make sure older tables also get the notification columns.
//   await db.query(`ALTER TABLE friend_requests ADD COLUMN IF NOT EXISTS receiver_seen BOOLEAN NOT NULL DEFAULT false`);
//   await db.query(`ALTER TABLE friend_requests ADD COLUMN IF NOT EXISTS requester_seen BOOLEAN NOT NULL DEFAULT true`);
// }

export async function findUserByUsername(username) {
  const result = await db.query(
    `SELECT up.user_id, up.username, up.first_name, up.last_name
     FROM user_profiles up
     WHERE LOWER(up.username) = LOWER($1)`,
    [username]
  );

  return result.rows[0] || null;
}

export async function findFriendRelationship(userIdOne, userIdTwo) {
  const result = await db.query(
    `SELECT *
     FROM friend_requests
     WHERE (requester_id = $1 AND receiver_id = $2)
        OR (requester_id = $2 AND receiver_id = $1)`,
    [userIdOne, userIdTwo]
  );

  return result.rows[0] || null;
}

export async function createFriendRequest(requesterId, receiverId) {
  const result = await db.query(
    `INSERT INTO friend_requests (requester_id, receiver_id, requested_by, status, receiver_seen, requester_seen)
     VALUES ($1, $2, $1, 'pending', false, true)
     RETURNING *`,
    [requesterId, receiverId]
  );

  return result.rows[0];
}

export async function updateFriendRequest(requestId, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return null;

  const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(", ");
  const values = Object.values(fields);

  const result = await db.query(
    `UPDATE friend_requests
     SET ${setClause}
     WHERE id = $${keys.length + 1}
     RETURNING *`,
    [...values, requestId]
  );

  return result.rows[0] || null;
}

export async function getFriendRequestById(requestId) {
  const result = await db.query(
    `SELECT * FROM friend_requests WHERE id = $1`,
    [requestId]
  );

  return result.rows[0] || null;
}

export async function listFriendsData(userId) {
  const friendsResult = await db.query(
    `SELECT
       fr.id,
       up.user_id,
       up.username,
       up.first_name,
       up.last_name,
       up.country,
       CASE
         WHEN fr.requester_id = $1 THEN fr.receiver_id
         ELSE fr.requester_id
       END AS friend_user_id
     FROM friend_requests fr
     JOIN user_profiles up
       ON up.user_id = CASE
         WHEN fr.requester_id = $1 THEN fr.receiver_id
         ELSE fr.requester_id
       END
     WHERE (fr.requester_id = $1 OR fr.receiver_id = $1)
       AND fr.status = 'accepted'
     ORDER BY LOWER(up.username) ASC`,
    [userId]
  );

  const incomingResult = await db.query(
    `SELECT
       fr.id,
       fr.created_at,
       up.user_id,
       up.username,
       up.first_name,
       up.last_name,
       up.country
     FROM friend_requests fr
     JOIN user_profiles up ON up.user_id = fr.requester_id
     WHERE fr.receiver_id = $1
       AND fr.status = 'pending'
     ORDER BY fr.created_at DESC`,
    [userId]
  );

  const outgoingResult = await db.query(
    `SELECT
       fr.id,
       fr.created_at,
       up.user_id,
       up.username,
       up.first_name,
       up.last_name,
       up.country
     FROM friend_requests fr
     JOIN user_profiles up ON up.user_id = fr.receiver_id
     WHERE fr.requester_id = $1
       AND fr.status = 'pending'
     ORDER BY fr.created_at DESC`,
    [userId]
  );

  const notifications = await getFriendNotificationCounts(userId);

  return {
    friends: friendsResult.rows,
    incomingRequests: incomingResult.rows,
    outgoingRequests: outgoingResult.rows,
    notifications,
  };
}

export async function getFriendNotificationCounts(userId) {
  const incomingResult = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM friend_requests
     WHERE receiver_id = $1
       AND status = 'pending'
       AND receiver_seen = false`,
    [userId]
  );

  const acceptedResult = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM friend_requests
     WHERE requester_id = $1
       AND status = 'accepted'
       AND requester_seen = false`,
    [userId]
  );

  const incomingPending = incomingResult.rows[0]?.count || 0;
  const acceptedUpdates = acceptedResult.rows[0]?.count || 0;

  return {
    incomingPending,
    acceptedUpdates,
    total: incomingPending + acceptedUpdates,
  };
}

export async function markFriendNotificationsAsRead(userId) {
  await db.query(
    `UPDATE friend_requests
     SET receiver_seen = true
     WHERE receiver_id = $1
       AND status = 'pending'
       AND receiver_seen = false`,
    [userId]
  );

  await db.query(
    `UPDATE friend_requests
     SET requester_seen = true
     WHERE requester_id = $1
       AND status = 'accepted'
       AND requester_seen = false`,
    [userId]
  );
}

export async function removeFriendRelationship(userIdOne, userIdTwo) {
  const result = await db.query(
    `DELETE FROM friend_requests
     WHERE status = 'accepted'
       AND ((requester_id = $1 AND receiver_id = $2)
         OR (requester_id = $2 AND receiver_id = $1))
     RETURNING id`,
    [userIdOne, userIdTwo]
  );

  return result.rowCount > 0;
}

export async function cancelOutgoingFriendRequest(userId, requestId) {
  const result = await db.query(
    `DELETE FROM friend_requests
     WHERE id = $1
       AND requester_id = $2
       AND status = 'pending'
     RETURNING id`,
    [requestId, userId]
  );

  return result.rowCount > 0;
}
