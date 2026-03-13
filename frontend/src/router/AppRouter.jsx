import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Search from "../pages/Search";
import MediaDetails from "../pages/MediaDetails";
import Watchlist from "../pages/Watchlist";
import Watched from "../pages/Watched";
import Favorites from "../pages/Favorites";
import ProtectedRoute from "./ProtectedRoute";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<ProtectedRoute> <Search /> </ProtectedRoute>} />
        <Route path="/media/:id" element={<ProtectedRoute> <MediaDetails /> </ProtectedRoute>} />
        <Route path="/watchlist" element={<ProtectedRoute> <Watchlist /> </ProtectedRoute>} />
        <Route path="/watched" element={<ProtectedRoute> <Watched /> </ProtectedRoute>} />
        <Route path="/favorites" element={<ProtectedRoute> <Favorites /> </ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

