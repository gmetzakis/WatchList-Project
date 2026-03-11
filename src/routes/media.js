import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { addToWatchlist, markAsWatched, getWatchlist, getWatchedHistory } from "../controllers/mediaController.js";

const router = Router();

router.post("/:tmdbId/watchlist", authMiddleware, addToWatchlist);
router.post("/:tmdbId/watched", authMiddleware, markAsWatched);
router.get("/watchlist", authMiddleware, getWatchlist);
router.get("/watched", authMiddleware, getWatchedHistory);

export default router;