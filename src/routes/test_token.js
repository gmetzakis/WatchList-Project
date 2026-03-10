import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/me", authMiddleware, (req, res) => {
  res.json({ userId: req.user.id });
});

export default router;