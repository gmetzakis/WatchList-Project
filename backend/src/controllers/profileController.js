import bcrypt from "bcrypt";
import { updateProfile, getProfileByUserId } from "../models/userProfileModel.js";
import { findUserById, findUserAuthById, updateUserPasswordHash } from "../models/userModel.js";
import { getAvatarByUserId, upsertAvatar } from "../models/userAvatarModel.js";
import db from "../db/index.js";

export async function updateProfileController(req, res) {
  const userId = req.user.id;

  const {
    firstName,
    lastName,
    yearOfBirth,
    country,
    username // must not be allowed
  } = req.body;

  if (username) {
    return res.status(400).json({ error: "Username cannot be changed" });
  }

  const fieldsToUpdate = {};
  const currentYear = new Date().getFullYear();

  if (firstName !== undefined) {
    const normalizedFirstName = String(firstName).trim();
    if (!normalizedFirstName) {
      return res.status(400).json({ error: "First name cannot be empty" });
    }
    fieldsToUpdate.first_name = normalizedFirstName;
  }

  if (lastName !== undefined) {
    const normalizedLastName = String(lastName).trim();
    if (!normalizedLastName) {
      return res.status(400).json({ error: "Last name cannot be empty" });
    }
    fieldsToUpdate.last_name = normalizedLastName;
  }

  if (yearOfBirth !== undefined) {
    const normalizedYear = Number(yearOfBirth);
    if (!Number.isInteger(normalizedYear) || normalizedYear < 1900 || normalizedYear > currentYear) {
      return res.status(400).json({ error: `Year of birth must be between 1900 and ${currentYear}` });
    }
    fieldsToUpdate.year_of_birth = normalizedYear;
  }

  if (country !== undefined) {
    const normalizedCountry = String(country).trim();
    if (!normalizedCountry) {
      return res.status(400).json({ error: "Country cannot be empty" });
    }
    fieldsToUpdate.country = normalizedCountry;
  }

  if (Object.keys(fieldsToUpdate).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  try {
    const updated = await updateProfile(userId, fieldsToUpdate);
    const profile = await getProfileByUserId(userId);

    res.json({ profile });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function me(req, res) {
  try {
    const userId = req.user.id;

    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const profile = await getProfileByUserId(userId);
    const avatar = await getAvatarByUserId(userId);

    res.json({
      id: user.id,
      email: user.email,
      profile,
      avatarData: avatar?.image_data || null
    });

  } catch (err) {
    console.error("Error in /auth/me:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function changePasswordController(req, res) {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }

    const user = await findUserAuthById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await updateUserPasswordHash(userId, hashedPassword);

    return res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Password change error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function uploadAvatarController(req, res) {
  try {
    const userId = req.user.id;
    const { imageData } = req.body;

    if (!imageData || typeof imageData !== "string") {
      return res.status(400).json({ error: "imageData is required" });
    }

    if (!imageData.startsWith("data:image/")) {
      return res.status(400).json({ error: "Only image files are allowed" });
    }

    if (imageData.length > 1_500_000) {
      return res.status(400).json({ error: "Image is too large. Please use a smaller image." });
    }

    await upsertAvatar(userId, imageData);

    return res.json({ message: "Avatar updated", avatarData: imageData });
  } catch (err) {
    console.error("Avatar upload error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function checkUsernameAvailability(req, res) {
  const { username } = req.query;

  if (!username || username.trim() === "") {
    return res.status(400).json({ error: "Username is required" });
  }

  try {
    const result = await db.query(
      `SELECT 1 FROM user_profiles WHERE username = $1`,
      [username]
    );

    const available = result.rowCount === 0;

    res.json({ available });
  } catch (err) {
    console.error("Username check error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
