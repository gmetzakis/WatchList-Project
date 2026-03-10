import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { findUserByEmail, createUser } from "../models/userModel.js";

export async function register(req, res) {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await createUser(email, hash);

    res.status(201).json({
      id: newUser.id,
      email: newUser.email,
    });
  } catch (err) {
    console.error("Register error:", err);
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