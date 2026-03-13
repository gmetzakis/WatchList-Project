import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { addToWatchlist, markAsWatched, getWatchlist, rateMedia,
         getWatchedHistory, removeFromWatchlist, removeFromWatched,
         moveWatchlistToWatched, removeRating } from "../controllers/mediaController.js";

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


export default router;