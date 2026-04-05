import { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import App from "./App";
const WatchedPage = lazy(() => import("./pages/Watched.jsx"));
const WatchlistPage = lazy(() => import("./pages/Watchlist.jsx"));
const FavoritesPage = lazy(() => import("./pages/Favorites.jsx"));
const LoginPage = lazy(() => import("./pages/Login.jsx"));
const RegisterPage = lazy(() => import("./pages/Register.jsx"));
const SearchPage = lazy(() => import("./pages/Search.jsx"));
const HomePage = lazy(() => import("./pages/Home.jsx"));
const MediaDetails = lazy(() => import("./pages/MediaDetails.jsx"));
const FriendsPage = lazy(() => import("./pages/Friends.jsx"));
const ProfilePage = lazy(() => import("./pages/Profile.jsx"));
const PersonDetailsPage = lazy(() => import("./pages/PersonDetails.jsx"));
const ExplorePage = lazy(() => import("./pages/Explore.jsx"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPassword.jsx"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPassword.jsx"));

import "./index.css";
import "./styles/global.css";
import "./styles/responsive.css";


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
    <Suspense fallback={<div className="page-container">Loading...</div>}>
      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

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
    </Suspense>
  </BrowserRouter>
);