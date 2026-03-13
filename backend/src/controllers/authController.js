import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { findUserById, findUserByEmail, createUser } from "../models/userModel.js";
import { getProfileByUserId, createProfile } from "../models/userProfileModel.js";
import db from "../db/index.js";

export async function register(req, res) {
  try {  
    const {
      email,
      password,
      firstName,
      lastName,
      username,
      yearOfBirth,
      country
    } = req.body;

    if (!email || !password || !firstName || !lastName || !username || !yearOfBirth || !country) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query("BEGIN");

    const user = await createUser(email, hashedPassword);

    const profile = await createProfile({
      userId: user.id,
      firstName,
      lastName,
      username,
      yearOfBirth,
      country
    });

    await db.query("COMMIT");

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        profile
      }
    });

  } catch (err) {
    await db.query("ROLLBACK");

    if (err.code === "23505") {
      return res.status(400).json({ error: "Username already taken" });
    }

    console.error("Registration error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}



export async function login(req, res) {
  try {
    const { email, password } = req.body;


    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: "There is no user with this email" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "Wrong password" });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}