import { Router } from "express";
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

export default router;