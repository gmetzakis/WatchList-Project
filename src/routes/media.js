import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { addToWatchlist, markAsWatched, getWatchlist, 
         getWatchedHistory, removeFromWatchlist, removeFromWatched,
         moveWatchlistToWatched } from "../controllers/mediaController.js";

const router = Router();

router.post("/:tmdbId/watchlist", authMiddleware, addToWatchlist);
router.post("/:tmdbId/watched", authMiddleware, markAsWatched);
router.get("/watchlist", authMiddleware, getWatchlist);
router.get("/watched", authMiddleware, getWatchedHistory);
router.delete("/:tmdbId/watchlist", authMiddleware, removeFromWatchlist);
router.delete("/:tmdbId/watched", authMiddleware, removeFromWatched);
router.post("/:tmdbId/watchlist-to-watched", authMiddleware, moveWatchlistToWatched);

export default router;