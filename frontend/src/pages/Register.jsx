import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios.js";
import "../styles/auth.css";

export default function RegisterPage() {
  const navigate = useNavigate();
  const maxYearOfBirth = new Date().getFullYear() - 10;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [yearOfBirth, setYearOfBirth] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState("idle");
  const [usernameStatusMessage, setUsernameStatusMessage] = useState("");
  const isPasswordValid = password.length >= 8;
  const canSubmitCredentials = isPasswordValid && usernameStatus === "available";

  useEffect(() => {
    const trimmed = username.trim();

    if (!trimmed) {
      setUsernameStatus("idle");
      setUsernameStatusMessage("");
      return;
    }

    if (trimmed.length < 3) {
      setUsernameStatus("error");
      setUsernameStatusMessage("Username must be at least 3 characters");
      return;
    }

    setUsernameStatus("checking");
    setUsernameStatusMessage("Checking username...");

    let isActive = true;
    const timeoutId = setTimeout(async () => {
      try {
        const res = await api.get("/auth/username-availability", {
          params: { username: trimmed },
        });

        if (!isActive) return;

        if (res.data?.available) {
          setUsernameStatus("available");
          setUsernameStatusMessage("Username is available");
        } else {
          setUsernameStatus("taken");
          setUsernameStatusMessage("Username is already taken");
        }
      } catch {
        if (!isActive) return;
        setUsernameStatus("error");
        setUsernameStatusMessage("Could not check username right now");
      }
    }, 350);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [username]);

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

      if (password.length < 8) {
        setError("Password must be at least 8 characters");
        setLoading(false);
        return;
      }

      if (username.trim().length < 3) {
        setError("Username must be at least 3 characters");
        setLoading(false);
        return;
      }

      if (usernameStatus === "taken") {
        setError("Username is already taken");
        setLoading(false);
        return;
      }

      const numericYearOfBirth = parseInt(yearOfBirth, 10);
      if (!Number.isInteger(numericYearOfBirth) || numericYearOfBirth > maxYearOfBirth) {
        setError(`Year of Birth must be ${maxYearOfBirth} or earlier`);
        setLoading(false);
        return;
      }

      const res = await api.post("/auth/register", {
        email,
        password,
        firstName,
        lastName,
        username,
        yearOfBirth: numericYearOfBirth,
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
          minLength={8}
          required
        />
        {password.length > 0 && (
          <p className={`auth-field-hint auth-password-hint ${isPasswordValid ? "success" : "error"}`}>
            {isPasswordValid ? "Password length is valid" : "Password must be at least 8 characters"}
          </p>
        )}

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
        {usernameStatusMessage && (
          <p
            className={`auth-field-hint auth-username-hint ${usernameStatus === "available" ? "success" : ""} ${usernameStatus === "taken" || usernameStatus === "error" ? "error" : ""}`}
          >
            {usernameStatusMessage}
          </p>
        )}

        {/* YEAR OF BIRTH */}
        <input
          type="number"
          placeholder="Year of Birth"
          className="auth-input"
          min="1900"
          max={maxYearOfBirth}
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

        <button className="auth-btn" type="submit" disabled={loading || !canSubmitCredentials}>
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