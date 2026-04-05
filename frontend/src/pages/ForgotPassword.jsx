import { useState } from "react";
import api from "../api/axios.js";
import "../styles/auth.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await api.post("/auth/forgot-password", { email });
      setMessage(res.data.message);
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

  return (
    <div className="auth-container">
      <h1 className="auth-title">Forgot Password</h1>

      {error && <p className="auth-error">{error}</p>}
      {message && <p className="auth-success">{message}</p>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Enter your email"
          className="auth-input"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />

        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? "Sending…" : "Send Reset Link"}
        </button>
      </form>

      <p className="auth-switch">
        Remember your password?{" "}
        <a href="/login">Login</a>
      </p>
    </div>
  );
}
