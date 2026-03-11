import { findOrCreateMedia } from "../models/mediaModel.js";
import { addUserMedia, findUserMedia } from "../models/userMediaModel.js";
import { incrementWatchedCount } from "../models/userProfileModel.js";

export async function markAsWatched(req, res) {
  const userId = req.user.id;
  const { tmdbId } = req.params;
  const { type } = req.body;

  if (!type || !["movie", "series"].includes(type)) {
    return res.status(400).json({ error: "Invalid or missing type" });
  }

  try {
    // Step 1: Ensure media exists locally
    const media = await findOrCreateMedia(tmdbId, type);

    // Step 2: Check if user already has this media
    const existing = await findUserMedia(userId, media.id);

    // If already watched, return early
    if (existing && existing.status === "watched") {
      return res.status(200).json({
        media,
        status: "watched"
      });
    }

    // Step 3: Insert or update user_media
    await addUserMedia(userId, media.id, "watched", true);

    // Step 4: Update profile stats
    await incrementWatchedCount(userId, type);

    res.status(201).json({
      media,
      status: "watched"
    });

  } catch (err) {
    console.error("Mark as watched error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function addToWatchlist(req, res) {
  const userId = req.user.id;
  const { tmdbId } = req.params;
  const { type } = req.body;

  if (!type || !["movie", "series"].includes(type)) {
    return res.status(400).json({ error: "Invalid or missing type" });
  }

  try {
    const media = await findOrCreateMedia(tmdbId, type);

    const existing = await findUserMedia(userId, media.id);
    if (existing && existing.status === "watchlist") {
      return res.status(200).json({ media, status: "watchlist" });
    }

    await addUserMedia(userId, media.id, "watchlist");

    res.status(201).json({
      media,
      status: "watchlist"
    });

  } catch (err) {
    console.error("Add to watchlist error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}