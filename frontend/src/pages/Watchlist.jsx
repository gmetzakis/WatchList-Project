import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { Link } from "react-router-dom";

export default function WatchlistPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await api.get("/media/watchlist");
      setItems(res.data);
    } catch (err) {
      console.error("Watchlist load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(item) {
    try {
      await api.delete(`/media/${item.tmdb_id}/watchlist`, {
        data: { type: item.type }
      });

      setItems(prev => prev.filter(i => i.tmdb_id !== item.tmdb_id));
    } catch (err) {
      console.error("Remove watchlist error:", err);
    }
  }

  async function handleMoveToWatched(item) {
    try {
      await api.post(`/media/${item.tmdb_id}/watchlist-to-watched`, {
        type: item.type
      });

      setItems(prev => prev.filter(i => i.tmdb_id !== item.tmdb_id));
    } catch (err) {
      console.error("Move to watched error:", err);
    }
  }

  if (loading) {
    return <div>Loading watchlist...</div>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Watchlist</h1>

      {items.length === 0 && (
        <p>Your watchlist is empty.</p>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: "20px",
        marginTop: "20px"
      }}>
        {items.map(item => (
          <div key={item.tmdb_id} style={{
            background: "#222",
            padding: "12px",
            borderRadius: "8px",
            textAlign: "center"
          }}>
            <Link to={`/media/${item.type}/${item.tmdb_id}`}>
              <img
                src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
                className="media-card-img"
              />
            </Link>

            <h3 style={{ color: "white", marginTop: "10px" }}>{item.title}</h3>
            <p style={{ color: "#aaa" }}>{item.release_year}</p>

            <button
              onClick={() => handleMoveToWatched(item)}
              style={{
                width: "100%",
                padding: "8px",
                background: "green",
                border: "none",
                borderRadius: "6px",
                color: "white",
                cursor: "pointer",
                marginTop: "10px"
              }}
            >
              Move to Watched
            </button>

            <button
              onClick={() => handleRemove(item)}
              style={{
                width: "100%",
                padding: "8px",
                background: "red",
                border: "none",
                borderRadius: "6px",
                color: "white",
                cursor: "pointer",
                marginTop: "10px"
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}