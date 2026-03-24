import React from "react";
import { SpeedInsights } from "@vercel/speed-insights/react"
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import App from "./App";
import WatchedPage from "./pages/Watched.jsx";
import WatchlistPage from "./pages/Watchlist.jsx";
import FavoritesPage from "./pages/Favorites.jsx";
import LoginPage from "./pages/Login.jsx";
import RegisterPage from "./pages/Register.jsx";
import SearchPage from "./pages/Search.jsx";
import HomePage from "./pages/Home.jsx";
import MediaDetails from "./pages/MediaDetails.jsx";
import FriendsPage from "./pages/Friends.jsx";
import ProfilePage from "./pages/Profile.jsx";
import PersonDetailsPage from "./pages/PersonDetails.jsx";
import ExplorePage from "./pages/Explore.jsx";

import "./index.css";
import "./styles/cinema.css";


function isTokenValid(token) {
  if (!token || token === "undefined" || token === "null") {
    return false;
  }

  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return false;

    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));

    if (!payload?.exp) return true;

    const nowInSeconds = Math.floor(Date.now() / 1000);
    return payload.exp > nowInSeconds;
  } catch {
    return false;
  }
}


function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  if (!isTokenValid(token)) {
    localStorage.removeItem("token");
    localStorage.removeItem("auth-storage");
    return <Navigate to="/login" replace />;
  }

  return children;
}


ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      {/* PUBLIC ROUTES */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* PROTECTED ROUTES */}
      <Route path="/" element={
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        }>
        <Route index element={<HomePage />} />
        <Route path="media/:type/:tmdbId" element={<MediaDetails />} />
        <Route path="person/:personId" element={<PersonDetailsPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="watched" element={<WatchedPage />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="favorites" element={<FavoritesPage />} />
        <Route path="friends" element={<FriendsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);