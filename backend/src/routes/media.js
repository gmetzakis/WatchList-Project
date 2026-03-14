import { Router } from "express";
import db from "../db/index.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { addToWatchlist, markAsWatched, getWatchlist, rateMedia,
         getWatchedHistory, removeFromWatchlist, removeFromWatched,
         moveWatchlistToWatched, removeRating, markAsFavorite, removeFavorite, getFavorites } from "../controllers/mediaController.js";

const router = Router();

router.post("/:tmdbId/watchlist", authMiddleware, addToWatchlist);
router.delete("/:tmdbId/watchlist", authMiddleware, removeFromWatchlist);
router.post("/:tmdbId/watched", authMiddleware, markAsWatched);
router.delete("/:tmdbId/watched", authMiddleware, removeFromWatched);

router.get("/watchlist", authMiddleware, getWatchlist);
router.get("/watched", authMiddleware, getWatchedHistory);

router.post("/:tmdbId/watchlist-to-watched", authMiddleware, moveWatchlistToWatched);

router.post("/:tmdbId/rating", authMiddleware, rateMedia);
router.delete("/:tmdbId/rating", authMiddleware, removeRating);

router.post("/:tmdbId/favorite", authMiddleware, markAsFavorite);
router.delete("/:tmdbId/favorite", authMiddleware, removeFavorite);

router.get("/favorites", authMiddleware, getFavorites);

router.get("/:type/:tmdbId/status", authMiddleware, async (req, res) => {
  const user_id = req.user.id;
  const tmdb_id = (req.params.tmdbId);
  const type = req.params.type;

  const result = await db.query(
    `SELECT user_media.status
     FROM user_media
     JOIN media ON media.id = user_media.media_id
     WHERE user_media.user_id = $1
       AND media.tmdb_id = $2
       AND media.type = $3
     LIMIT 1`,
    [user_id, tmdb_id, type]
  );

  if (result.rows.length === 0) {
    return res.json({ status: null });
  }

  res.json({ status: result.rows[0].status });
});


export default router;