import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", res.data.token);
      navigate("/watched");
    } catch (err) {
      setError("Invalid email or password");
      console.error("Login error:", err);
    }
  }

  return (
    <div className="auth-container">
      <h1 className="auth-title">Login</h1>

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
          Login
        </button>
      </form>

      <p className="auth-switch">
        Don't have an account?{" "}
        <a href="/register">Register</a>
      </p>
    </div>
  );
}