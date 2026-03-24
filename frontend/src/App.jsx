import { Outlet } from "react-router-dom";
import Header from "./components/header.jsx";
import { SpeedInsights } from "@vercel/speed-insights/react"
import "./styles/cinema.css";

export default function App() {
  return (
    <div className="app-root">
      <Header />
      <main className="page-container">
        <Outlet />
      </main>
      <SpeedInsights />
    </div>
  );
}