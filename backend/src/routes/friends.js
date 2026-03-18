import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  createFriendRequestController,
  listFriendsController,
  respondToFriendRequestController,
} from "../controllers/friendController.js";

const router = Router();

router.get("/", authMiddleware, listFriendsController);
router.post("/requests", authMiddleware, createFriendRequestController);
router.post("/requests/:requestId/respond", authMiddleware, respondToFriendRequestController);

export default router;
