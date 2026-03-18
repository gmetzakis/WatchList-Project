import { useEffect, useMemo, useState } from "react";
import api from "../api/axios.js";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [yearOfBirth, setYearOfBirth] = useState("");
  const [country, setCountry] = useState("");
  const [avatarData, setAvatarData] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [initialValues, setInitialValues] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError("");

    try {
      const res = await api.get("/profile");
      const profile = res.data?.profile || {};

      const values = {
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
        yearOfBirth: profile.year_of_birth ? String(profile.year_of_birth) : "",
        country: profile.country || ""
      };

      setEmail(res.data?.email || "");
      setUsername(profile.username || "");
      setAvatarData(res.data?.avatarData || "");
      setFirstName(values.firstName);
      setLastName(values.lastName);
      setYearOfBirth(values.yearOfBirth);
      setCountry(values.country);
      setInitialValues(values);
    } catch (err) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError("Failed to load profile");
      }
    } finally {
      setLoading(false);
    }
  }

  const hasChanges = useMemo(() => {
    if (!initialValues) return false;

    return (
      firstName !== initialValues.firstName ||
      lastName !== initialValues.lastName ||
      yearOfBirth !== initialValues.yearOfBirth ||
      country !== initialValues.country
    );
  }, [firstName, lastName, yearOfBirth, country, initialValues]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!firstName.trim() || !lastName.trim() || !yearOfBirth.trim() || !country.trim()) {
      setError("First name, last name, year of birth, and country are required");
      return;
    }

    const year = Number(yearOfBirth);
    const currentYear = new Date().getFullYear();

    if (!Number.isInteger(year) || year < 1900 || year > currentYear) {
      setError(`Year of birth must be between 1900 and ${currentYear}`);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        yearOfBirth: year,
        country: country.trim()
      };

      const res = await api.put("/profile", payload);
      const profile = res.data?.profile || {};

      const values = {
        firstName: profile.first_name || "",
        lastName: profile.last_name || "",
        yearOfBirth: profile.year_of_birth ? String(profile.year_of_birth) : "",
        country: profile.country || ""
      };

      setFirstName(values.firstName);
      setLastName(values.lastName);
      setYearOfBirth(values.yearOfBirth);
      setCountry(values.country);
      setInitialValues(values);
      setSuccess("Profile updated successfully");
    } catch (err) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError("Failed to update profile");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setSuccess("");

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const imageData = String(reader.result || "");
      if (!imageData) {
        setError("Could not read image file");
        return;
      }

      setAvatarUploading(true);
      try {
        const res = await api.put("/profile/avatar", { imageData });
        setAvatarData(res.data?.avatarData || imageData);
        setSuccess("Avatar updated successfully");
      } catch (err) {
        if (err.response?.data?.error) {
          setError(err.response.data.error);
        } else {
          setError("Failed to upload avatar");
        }
      } finally {
        setAvatarUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All password fields are required");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match");
      return;
    }

    setPasswordSaving(true);
    try {
      await api.put("/profile/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Password changed successfully");
    } catch (err) {
      if (err.response?.data?.error) {
        setPasswordError(err.response.data.error);
      } else {
        setPasswordError("Failed to change password");
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) {
    return <div className="profile-shell">Loading profile...</div>;
  }

  return (
    <div className="profile-shell">
      <h1 className="profile-title">Profile</h1>

      {error && <p className="profile-message error">{error}</p>}
      {success && <p className="profile-message success">{success}</p>}

      <section className="profile-section">
        <h2 className="profile-section-title">Avatar</h2>
        <div className="avatar-row">
          <div className="avatar-preview-wrap">
            {avatarData ? (
              <img src={avatarData} alt="Profile avatar" className="avatar-preview" />
            ) : (
              <div className="avatar-placeholder">No avatar</div>
            )}
          </div>

          <label className="avatar-upload-btn">
            {avatarUploading ? "Uploading..." : "Upload Avatar"}
            <input type="file" accept="image/*" onChange={handleAvatarChange} disabled={avatarUploading} />
          </label>
        </div>
      </section>

      <form className="profile-form" onSubmit={handleSubmit}>
        <h2 className="profile-section-title">Details</h2>
        <div className="profile-grid">
          <label className="profile-field">
            <span>Email</span>
            <input type="email" value={email} disabled />
          </label>

          <label className="profile-field">
            <span>Username</span>
            <input type="text" value={username} disabled />
          </label>

          <label className="profile-field">
            <span>First Name</span>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </label>

          <label className="profile-field">
            <span>Last Name</span>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </label>

          <label className="profile-field">
            <span>Year of Birth</span>
            <input
              type="number"
              min="1900"
              max={new Date().getFullYear()}
              value={yearOfBirth}
              onChange={(e) => setYearOfBirth(e.target.value)}
              required
            />
          </label>

          <label className="profile-field">
            <span>Country</span>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              required
            />
          </label>
        </div>

        <p className="profile-note">Email and username are read-only.</p>

        <button className="profile-save-btn" type="submit" disabled={saving || !hasChanges}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      <form className="profile-form password-form" onSubmit={handlePasswordSubmit}>
        <h2 className="profile-section-title">Change Password</h2>

        {passwordError && <p className="profile-message error">{passwordError}</p>}
        {passwordSuccess && <p className="profile-message success">{passwordSuccess}</p>}

        <div className="profile-grid">
          <label className="profile-field">
            <span>Current Password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>

          <label className="profile-field">
            <span>New Password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>

          <label className="profile-field">
            <span>Confirm New Password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
        </div>

        <button className="profile-save-btn" type="submit" disabled={passwordSaving}>
          {passwordSaving ? "Updating..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}
