import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  createFriendRequestController,
  getFriendNotificationsController,
  listFriendsController,
  markFriendNotificationsReadController,
  removeFriendController,
  respondToFriendRequestController,
} from "../controllers/friendController.js";

const router = Router();

router.get("/", authMiddleware, listFriendsController);
router.get("/notifications", authMiddleware, getFriendNotificationsController);
router.post("/notifications/read", authMiddleware, markFriendNotificationsReadController);
router.post("/requests", authMiddleware, createFriendRequestController);
router.post("/requests/:requestId/respond", authMiddleware, respondToFriendRequestController);
router.delete("/:friendUserId", authMiddleware, removeFriendController);

export default router;
