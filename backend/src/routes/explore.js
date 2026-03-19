import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { getRecommendations } from "../controllers/exploreController.js";

const router = Router();

router.get("/recommendations", authMiddleware, getRecommendations);

export default router;
