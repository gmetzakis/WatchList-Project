import {
  createFriendRequest,
  findFriendRelationship,
  findUserByUsername,
  getFriendRequestById,
  listFriendsData,
  updateFriendRequest,
} from "../models/friendModel.js";

export async function listFriendsController(req, res) {
  try {
    const data = await listFriendsData(req.user.id);
    return res.json(data);
  } catch (err) {
    console.error("Friends list error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function createFriendRequestController(req, res) {
  try {

    const userId = req.user.id;
    const username = String(req.body?.username || "").trim();

    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    const targetUser = await findUserByUsername(username);
    if (!targetUser) {
      return res.status(404).json({ error: "No user exists with that username" });
    }

    if (targetUser.user_id === userId) {
      return res.status(400).json({ error: "You cannot send a friend request to yourself" });
    }

    const existingRelationship = await findFriendRelationship(userId, targetUser.user_id);

    if (existingRelationship) {
      if (existingRelationship.status === "accepted") {
        return res.status(400).json({ error: "You are already friends" });
      }

      if (existingRelationship.status === "pending") {
        if (existingRelationship.requested_by === userId) {
          return res.status(400).json({ error: "Friend request already sent" });
        }

        return res.status(400).json({ error: "That user has already sent you a friend request" });
      }

      await updateFriendRequest(existingRelationship.id, {
        requester_id: userId,
        receiver_id: targetUser.user_id,
        requested_by: userId,
        status: "pending",
        responded_at: null,
        created_at: new Date(),
      });

      return res.status(201).json({ message: `Friend request sent to ${targetUser.username}` });
    }

    await createFriendRequest(userId, targetUser.user_id);
    return res.status(201).json({ message: `Friend request sent to ${targetUser.username}` });
  } catch (err) {
    console.error("Create friend request error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function respondToFriendRequestController(req, res) {
  try {

    const requestId = Number(req.params.requestId);
    const action = String(req.body?.action || "").trim().toLowerCase();
    const userId = req.user.id;

    if (!Number.isInteger(requestId)) {
      return res.status(400).json({ error: "Invalid request id" });
    }

    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ error: "Action must be accept or decline" });
    }

    const request = await getFriendRequestById(requestId);
    if (!request) {
      return res.status(404).json({ error: "Friend request not found" });
    }

    if (request.receiver_id !== userId) {
      return res.status(403).json({ error: "You cannot respond to this friend request" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ error: "This friend request has already been handled" });
    }

    const updated = await updateFriendRequest(requestId, {
      status: action === "accept" ? "accepted" : "declined",
      responded_at: new Date(),
    });

    return res.json({
      message: action === "accept" ? "Friend request accepted" : "Friend request declined",
      request: updated,
    });
  } catch (err) {
    console.error("Respond friend request error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
