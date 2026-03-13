import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import App from "./App";
import WatchedPage from "./pages/Watched.jsx";
import WatchlistPage from "./pages/Watchlist.jsx";
import FavoritesPage from "./pages/Favorites.jsx";

import "./index.css";
import "./styles/cinema.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />}>
        <Route path="watched" element={<WatchedPage />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="favorites" element={<FavoritesPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);