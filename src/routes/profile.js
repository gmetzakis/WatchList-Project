import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { me, updateProfileController, checkUsernameAvailability } from "../controllers/profileController.js";

const router = Router();

router.get("/me", authMiddleware, me);
router.put("/update", authMiddleware, updateProfileController);
router.get("/check-username", checkUsernameAvailability);

export default router;