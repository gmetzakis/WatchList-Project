import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import api from "../api/axios.js";
import "../styles/auth.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    try {
      const res = await api.post("/auth/login", { email, password });

      if (!res.data?.token) {
        setError("Login succeeded but no token was returned");
        return;
      }

      localStorage.setItem("token", res.data.token);
      navigate("/");
    } catch (err) {
        if (err.response && err.response.data) {
            const backendError = err.response.data.error || err.response.data.message;
            setError(backendError || "Something went wrong");
        } else {
          setError("Network error!!");
        }
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

        <div className="auth-password-wrapper">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            className="auth-input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPassword(prev => !prev)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <button className="auth-btn" type="submit">
          Login
        </button>
      </form>

      <p className="auth-switch">
        <a href="/forgot-password">Forgot your password?</a>
      </p>

      <p className="auth-switch">
        Don't have an account?{" "}
        <a href="/register">Register</a>
      </p>
    </div>
  );
}