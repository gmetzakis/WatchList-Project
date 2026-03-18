import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios.js";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [yearOfBirth, setYearOfBirth] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!email || !password || !firstName || !lastName || !username || !yearOfBirth || !country) {
        setError("All fields are required");
        setLoading(false);
        return;
      }

      const res = await api.post("/auth/register", {
        email,
        password,
        firstName,
        lastName,
        username,
        yearOfBirth: parseInt(yearOfBirth),
        country
      });

      if (!res.data?.token) {
        setError("Registration succeeded but no token was returned");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", res.data.token);
      navigate("/watched");
    } catch (err) {
      if (err.response && err.response.data) {
        const backendError = err.response.data.error || err.response.data.message;
        setError(backendError || "Something went wrong");
      } else {
        setError("Network error!!");
      }
      console.error("Register error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <h1 className="auth-title">Register</h1>

      {error && <p className="auth-error">{error}</p>}

      <form className="auth-form" onSubmit={handleSubmit}>
        {/* EMAIL */}
        <input
          type="email"
          placeholder="Email"
          className="auth-input"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />

        {/* PASSWORD */}
        <input
          type="password"
          placeholder="Password"
          className="auth-input"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        {/* FIRST NAME */}
        <input
          type="text"
          placeholder="First Name"
          className="auth-input"
          value={firstName}
          onChange={e => setFirstName(e.target.value)}
          required
        />

        {/* LAST NAME */}
        <input
          type="text"
          placeholder="Last Name"
          className="auth-input"
          value={lastName}
          onChange={e => setLastName(e.target.value)}
          required
        />

        {/* USERNAME */}
        <input
          type="text"
          placeholder="Username"
          className="auth-input"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
        />

        {/* YEAR OF BIRTH */}
        <input
          type="number"
          placeholder="Year of Birth"
          className="auth-input"
          min="1900"
          max={new Date().getFullYear()}
          value={yearOfBirth}
          onChange={e => setYearOfBirth(e.target.value)}
          required
        />

        {/* COUNTRY */}
        <input
          type="text"
          placeholder="Country"
          className="auth-input"
          value={country}
          onChange={e => setCountry(e.target.value)}
          required
        />

        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? "Registering..." : "Register"}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account?{" "}
        <a href="/login">Login</a>
      </p>
    </div>
  );
}