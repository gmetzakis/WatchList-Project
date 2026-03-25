import { findOrCreateMedia } from "../models/mediaModel.js";
import { addUserMedia, findUserMedia, deleteUserMedia, setRating,
         updateUserMediaStatus, getUserWatchlist, getUserWatched,
         setFavorite, getUserFavorites } from "../models/userMediaModel.js";
import { incrementWatchedCount, decrementWatchedCount } from "../models/userProfileModel.js";
import {
  syncExploreGraphOnFavoriteChanged,
  syncExploreGraphOnRatingChanged,
  syncExploreGraphOnWatchlistAdded,
  syncExploreGraphOnWatchlistRemoved,
  syncExploreGraphOnWatchedAdded,
  syncExploreGraphOnWatchedRemoved,
} from "../services/exploreRecommendations.js";

export async function markAsWatched(req, res) {
  const userId = req.user.id;
  const { tmdbId } = req.params;
  const { type, genres } = req.body;

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
    await addUserMedia(userId, media.id, "watched", genres, true);

    // Step 4: Update profile stats
    await incrementWatchedCount(userId, type);
    await syncExploreGraphOnWatchedAdded(userId, media, { rating: existing?.rating || null, isFavorite: existing?.is_favorite || false });

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
  const { type, genres } = req.body;

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

    await addUserMedia(userId, media.id, "watchlist", genres);
  await syncExploreGraphOnWatchlistAdded(userId, media);

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
  await syncExploreGraphOnWatchlistRemoved(userId, media);

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
    await syncExploreGraphOnWatchedRemoved(userId, media);

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
    await syncExploreGraphOnWatchedAdded(userId, media);

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
  const { type, sort } = req.query;
  const search = String(req.query.search || "").trim();
  const genre = String(req.query.genre || "").trim();
  const genreId = genre ? findGenreIdByName(genre) : null;
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 0, 0), 100);

  try {
    const result = limit > 0
      ? await getUserWatchlist(userId, type, { page, limit, sort, search, genreId })
      : await getUserWatchlist(userId, type, { sort, search, genreId });

    const items = Array.isArray(result) ? result : result.items;
    
    // Extract unique genres from items
    const allGenres = new Set();

    items.forEach(item => {
      item.genres = mapGenres(parseGenreSet(item.genres));
      if (Array.isArray(item.genres)) {
        item.genres.forEach(g => {
          if (g) allGenres.add(g);
        });
      }
    });
    
    const payload = {
      items,
      genres: Array.from(allGenres).sort()
    };

    if (!Array.isArray(result)) {
      payload.pagination = {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      };
    }

    res.json(payload);
  } catch (err) {
    console.error("Get watchlist error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


export async function getWatchedHistory(req, res) {
  const userId = req.user.id;
  const { sort, favorites, type } = req.query;
  const search = String(req.query.search || "").trim();
  const genre = String(req.query.genre || "").trim();
  const genreId = genre ? findGenreIdByName(genre) : null;
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 0, 0), 100);

  try {
    const result = limit > 0
      ? await getUserWatched(userId, sort, favorites, type, { page, limit, search, genreId })
      : await getUserWatched(userId, sort, favorites, type, { search, genreId });

    const items = Array.isArray(result) ? result : result.items;
    // Extract unique genres from items
    const allGenres = new Set();

    items.forEach(item => {
      item.genres = mapGenres(parseGenreSet(item.genres));
      if (Array.isArray(item.genres)) {
        item.genres.forEach(g => {
          if (g) allGenres.add(g);
        });
      }
    });

    const payload = {
      items,
      genres: Array.from(allGenres).sort()
    };

    if (!Array.isArray(result)) {
      payload.pagination = {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      };
    }

    res.json(payload);
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
  await syncExploreGraphOnRatingChanged(userId, media, rating);

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
  await syncExploreGraphOnRatingChanged(userId, media, null);

    res.json({ success: true });

  } catch (err) {
    console.error("Remove rating error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


export async function markAsFavorite(req, res) {
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
      return res.status(400).json({ error: "You can only favorite watched items" });
    }

    await setFavorite(userId, media.id, true);
  await syncExploreGraphOnFavoriteChanged(userId, media, true);

    res.json({
      media,
      is_favorite: true
    });

  } catch (err) {
    console.error("Mark as favorite error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


export async function removeFavorite(req, res) {
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
      return res.status(400).json({ error: "Item is not favorited or not watched" });
    }

    await setFavorite(userId, media.id, false);
  await syncExploreGraphOnFavoriteChanged(userId, media, false);

    res.json({ success: true });

  } catch (err) {
    console.error("Remove favorite error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}


export async function getFavorites(req, res) {
  const userId = req.user.id;
  const { sort, type } = req.query;
  const search = String(req.query.search || "").trim();
  const genre = String(req.query.genre || "").trim();
  const genreId = genre ? findGenreIdByName(genre) : null;
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 0, 0), 100);

  try {
    const result = limit > 0
      ? await getUserFavorites(userId, sort, type, { page, limit, search, genreId })
      : await getUserFavorites(userId, sort, type, { search, genreId });

    const items = Array.isArray(result) ? result : result.items;
    // Extract unique genres from items
    const allGenres = new Set();

    items.forEach(item => {
      item.genres = mapGenres(parseGenreSet(item.genres));
      if (Array.isArray(item.genres)) {
        item.genres.forEach(g => {
          if (g) allGenres.add(g);
        });
      }
    });
    
    const payload = {
      items,
      genres: Array.from(allGenres).sort()
    };

    if (!Array.isArray(result)) {
      payload.pagination = {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      };
    }

    res.json(payload);
  } catch (err) {
    console.error("Get favorites error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

const GENRE_MAP = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics"
};

function mapGenres(ids) {
  if (!Array.isArray(ids)) {
    ids = [ids]; // convert single value to array
  }

  return ids
    .map(id => GENRE_MAP[id])
    .filter(Boolean); // remove undefined
}

function parseGenreSet(str) {
  if (!str) return [];
  return str
    .replace(/[{}"]/g, "") // remove { } "
    .split(",")            // split by comma
    .map(s => s.trim())    // clean spaces
    .filter(Boolean);      // remove empty
}

function findGenreIdByName(genreName) {
  const normalized = String(genreName || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const [id, name] of Object.entries(GENRE_MAP)) {
    if (String(name).toLowerCase() === normalized) {
      return Number(id);
    }
  }

  return null;
}
