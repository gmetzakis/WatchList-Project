import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { addToWatchlist, markAsWatched } from "../controllers/mediaController.js";

const router = Router();

router.post("/:tmdbId/watchlist", authMiddleware, addToWatchlist);
router.post("/:tmdbId/watched", authMiddleware, markAsWatched);

export default router;