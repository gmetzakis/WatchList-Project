import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { me, updateProfileController, checkUsernameAvailability, changePasswordController, uploadAvatarController } from "../controllers/profileController.js";

const router = Router();

router.get("/", authMiddleware, me);
router.put("/", authMiddleware, updateProfileController);
router.put("/password", authMiddleware, changePasswordController);
router.put("/avatar", authMiddleware, uploadAvatarController);
router.get("/me", authMiddleware, me);
router.put("/update", authMiddleware, updateProfileController);
router.get("/check-username", checkUsernameAvailability);

export default router;