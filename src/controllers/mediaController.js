import { findOrCreateMedia } from "../models/mediaModel.js";
import { addUserMedia, findUserMedia, deleteUserMedia, setRating,
         updateUserMediaStatus, getUserWatchlist, getUserWatched } from "../models/userMediaModel.js";
import { incrementWatchedCount, decrementWatchedCount } from "../models/userProfileModel.js";

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

    if (existing && existing.status === "watched") {
      await deleteUserMedia(userId, media.id);
      await decrementWatchedCount(userId, type);
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


export async function removeFromWatchlist(req, res) {
  const userId = req.user.id;
  const { tmdbId } = req.params;
  const { type } = req.body;

  if (!type || !["movie", "series"].includes(type)) {
    return res.status(400).json({ error: "Invalid or missing type" });
  }

  try {
    const media = await findOrCreateMedia(tmdbId, type);

    const existing = await findUserMedia(userId, media.id);

    if (!existing || existing.status !== "watchlist") {
      return res.status(404).json({ error: "Not in watchlist" });
    }

    await deleteUserMedia(userId, media.id);

    res.json({ success: true });

  } catch (err) {
    console.error("Remove from watchlist error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


export async function removeFromWatched(req, res) {
  const userId = req.user.id;
  const { tmdbId } = req.params;
  const { type } = req.body;

  if (!type || !["movie", "series"].includes(type)) {
    return res.status(400).json({ error: "Invalid or missing type" });
  }

  try {
    const media = await findOrCreateMedia(tmdbId, type);

    const existing = await findUserMedia(userId, media.id);

    if (!existing || existing.status !== "watched") {
      return res.status(404).json({ error: "Not in watched history" });
    }

    await deleteUserMedia(userId, media.id);
    await decrementWatchedCount(userId, type);

    res.json({ success: true });

  } catch (err) {
    console.error("Remove from watched error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


export async function moveWatchlistToWatched(req, res) {
  const userId = req.user.id;
  const { tmdbId } = req.params;
  const { type } = req.body;

  if (!type || !["movie", "series"].includes(type)) {
    return res.status(400).json({ error: "Invalid or missing type" });
  }

  try {
    const media = await findOrCreateMedia(tmdbId, type);

    const existing = await findUserMedia(userId, media.id);

    if (!existing || existing.status !== "watchlist") {
      return res.status(404).json({ error: "Item is not in watchlist" });
    }

    await updateUserMediaStatus(userId, media.id, "watched");
    await incrementWatchedCount(userId, type);

    res.json({
      media,
      status: "watched"
    });

  } catch (err) {
    console.error("Move watchlist to watched error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


export async function getWatchlist(req, res) {
  const userId = req.user.id;

  try {
    const items = await getUserWatchlist(userId);
    res.json(items);
  } catch (err) {
    console.error("Get watchlist error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


export async function getWatchedHistory(req, res) {
  const userId = req.user.id;

  try {
    const items = await getUserWatched(userId);
    res.json(items);
  } catch (err) {
    console.error("Get watched history error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


export async function rateMedia(req, res) {
  const userId = req.user.id;
  const { tmdbId } = req.params;
  const { type, rating } = req.body;

  if (!type || !["movie", "series"].includes(type)) {
    return res.status(400).json({ error: "Invalid or missing type" });
  }

  if (!rating || rating < 1 || rating > 10) {
    return res.status(400).json({ error: "Rating must be between 1 and 10" });
  }

  try {
    const media = await findOrCreateMedia(tmdbId, type);
    const existing = await findUserMedia(userId, media.id);

    if (!existing || existing.status !== "watched") {
      return res.status(400).json({ error: "You can only rate watched items" });
    }

    await setRating(userId, media.id, rating);

    res.json({
      media,
      rating
    });

  } catch (err) {
    console.error("Rate media error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


export async function removeRating(req, res) {
  const userId = req.user.id;
  const { tmdbId } = req.params;
  const { type } = req.body;

  if (!type || !["movie", "series"].includes(type)) {
    return res.status(400).json({ error: "Invalid or missing type" });
  }

  try {
    const media = await findOrCreateMedia(tmdbId, type);
    const existing = await findUserMedia(userId, media.id);

    if (!existing || existing.status !== "watched") {
      return res.status(400).json({ error: "Item is not rated or not watched" });
    }

    await setRating(userId, media.id, null);

    res.json({ success: true });

  } catch (err) {
    console.error("Remove rating error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}