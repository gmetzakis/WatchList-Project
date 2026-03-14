import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import App from "./App";
import WatchedPage from "./pages/Watched.jsx";
import WatchlistPage from "./pages/Watchlist.jsx";
import FavoritesPage from "./pages/Favorites.jsx";
import LoginPage from "./pages/Login.jsx";
import RegisterPage from "./pages/Register.jsx";

import "./index.css";
import "./styles/cinema.css";


function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
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
        <Route path="watched" element={<WatchedPage />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="favorites" element={<FavoritesPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);