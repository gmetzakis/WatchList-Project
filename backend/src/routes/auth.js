import { Router } from "express";
import { register, login, checkUsernameAvailability } from "../controllers/authController.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/username-availability", checkUsernameAvailability);

export default router;