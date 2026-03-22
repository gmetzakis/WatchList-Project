import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { discardRecommendation, discardRecommendationsBulk, getRecommendations } from "../controllers/exploreController.js";

const router = Router();

router.get("/recommendations", authMiddleware, getRecommendations);
router.post("/recommendations/:tmdbId/discard", authMiddleware, discardRecommendation);
router.post("/recommendations/discard-bulk", authMiddleware, discardRecommendationsBulk);

export default router;
