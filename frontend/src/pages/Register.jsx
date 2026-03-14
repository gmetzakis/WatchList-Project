import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios.js";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      await api.post("/auth/register", { email, password });
      navigate("/login");
    } catch (err) {
      setError("Registration failed");
      console.error("Register error:", err);
    }
  }

  return (
    <div className="auth-container">
      <h1 className="auth-title">Register</h1>

      {error && <p className="auth-error">{error}</p>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          className="auth-input"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="auth-input"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        <button className="auth-btn" type="submit">
          Register
        </button>
      </form>

      <p className="auth-switch">
        Already have an account?{" "}
        <a href="/login">Login</a>
      </p>
    </div>
  );
}