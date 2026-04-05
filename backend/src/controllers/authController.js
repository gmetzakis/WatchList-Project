import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { findUserById, findUserByEmail, createUser, updateUserPasswordHash } from "../models/userModel.js";
import { getProfileByUserId, createProfile, findProfileByUsername } from "../models/userProfileModel.js";
import { createResetToken, findResetToken, deleteResetToken } from "../models/passwordResetModel.js";
import db from "../db/index.js";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function checkUsernameAvailability(req, res) {
  try {
    const username = (req.query.username || "").trim();

    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    const existing = await findProfileByUsername(username);
    return res.json({ available: !existing });
  } catch (err) {
    console.error("Username availability error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function register(req, res) {
  try {  
    const {
      email: rawEmail,
      password,
      firstName,
      lastName,
      username,
      yearOfBirth,
      country
    } = req.body;

    const email = String(rawEmail || "").trim().toLowerCase();

    if (!email || !password || !firstName || !lastName || !username || !yearOfBirth || !country) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const maxYearOfBirth = new Date().getFullYear() - 10;
    const numericYearOfBirth = Number(yearOfBirth);
    if (!Number.isInteger(numericYearOfBirth) || numericYearOfBirth > maxYearOfBirth) {
      return res.status(400).json({ error: `Year of birth must be ${maxYearOfBirth} or earlier` });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const existingUsername = await findProfileByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ error: "Username already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query("BEGIN");

    const user = await createUser(email, hashedPassword);

    const profile = await createProfile({
      userId: user.id,
      firstName,
      lastName,
      username,
      yearOfBirth: numericYearOfBirth,
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
    const { email: rawEmail, password } = req.body;
    const email = String(rawEmail || "").trim().toLowerCase();


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

export async function forgotPassword(req, res) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await findUserByEmail(email);

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: "If that email exists, a reset link has been sent." });
    }

    // Generate a secure random token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await createResetToken(user.id, tokenHash, expiresAt);

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "MyCineShelf — Password Reset",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Password Reset</h2>
          <p>You requested a password reset. Click the link below to set a new password:</p>
          <p><a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#7b8492;color:#0f1114;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a></p>
          <p style="color:#888;font-size:0.85rem;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    res.json({ message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: "Token and new password are required" });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const resetRecord = await findResetToken(tokenHash);

    if (!resetRecord) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await updateUserPasswordHash(resetRecord.user_id, hashedPassword);
    await deleteResetToken(resetRecord.id);

    res.json({ message: "Password has been reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}