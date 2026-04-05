import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../api/axios.js";
import "../styles/auth.css";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/auth/reset-password", { token, password });
      setMessage(res.data.message);
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      if (err.response && err.response.data) {
        setError(err.response.data.error || "Something went wrong");
      } else {
        setError("Network error");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-container">
        <h1 className="auth-title">Invalid Link</h1>
        <p className="auth-error">No reset token found. Please request a new reset link.</p>
        <p className="auth-switch">
          <a href="/forgot-password">Request new link</a>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <h1 className="auth-title">Reset Password</h1>

      {error && <p className="auth-error">{error}</p>}
      {message && <p className="auth-success">{message}</p>}

      {!message && (
        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="New password"
            className="auth-input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
          />

          <input
            type="password"
            placeholder="Confirm new password"
            className="auth-input"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Resetting…" : "Reset Password"}
          </button>
        </form>
      )}

      <p className="auth-switch">
        <a href="/login">Back to Login</a>
      </p>
    </div>
  );
}
