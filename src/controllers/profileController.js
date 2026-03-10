import { updateProfile, getProfileByUserId } from "../models/userProfileModel.js";
import { findUserById } from "../models/userModel.js";
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

  if (firstName) fieldsToUpdate.first_name = firstName;
  if (lastName) fieldsToUpdate.last_name = lastName;
  if (yearOfBirth) fieldsToUpdate.year_of_birth = yearOfBirth;
  if (country) fieldsToUpdate.country = country;

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

    res.json({
      id: user.id,
      email: user.email,
      profile
    });

  } catch (err) {
    console.error("Error in /auth/me:", err);
    res.status(500).json({ error: "Internal server error" });
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
