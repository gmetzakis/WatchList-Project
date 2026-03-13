import { useEffect, useState } from "react";
import api from "../api/axios.js";

export default function WatchedPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await api.get("/media/watched", {
        params: { sort: "rating_desc", favorites: false }
      });
      setItems(res.data);
    } catch (err) {
      console.error("Watched load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(item) {
    try {
      await api.delete(`/media/${item.tmdb_id}/watched`, {
        data: { type: item.type }
      });
      setItems(prev => prev.filter(i => i.tmdb_id !== item.tmdb_id));
    } catch (err) {
      console.error("Remove watched error:", err);
    }
  }

  async function handleRate(item, rating) {
    try {
      await api.post(`/media/${item.tmdb_id}/rating`, {
        type: item.type,
        rating
      });

      setItems(prev =>
        prev.map(i =>
          i.tmdb_id === item.tmdb_id ? { ...i, rating } : i
        )
      );
    } catch (err) {
      console.error("Rate error:", err);
    }
  }

  async function handleRemoveRating(item) {
    try {
      await api.delete(`/media/${item.tmdb_id}/rating`, {
        data: { type: item.type }
      });

      setItems(prev =>
        prev.map(i =>
          i.tmdb_id === item.tmdb_id ? { ...i, rating: null } : i
        )
      );
    } catch (err) {
      console.error("Remove rating error:", err);
    }
  }

  if (loading) {
    return <div>Loading watched history...</div>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Watched</h1>

      {items.length === 0 && (
        <p>You haven't watched anything yet.</p>
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
            <img
              src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
              alt={item.title}
              style={{ width: "100%", borderRadius: "6px" }}
            />

            <h3 style={{ color: "white", marginTop: "10px" }}>{item.title}</h3>
            <p style={{ color: "#aaa" }}>{item.release_year}</p>

            {/* Rating buttons */}
            <div style={{ marginTop: "10px", marginBottom: "10px" }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button
                  key={n}
                  onClick={() => handleRate(item, n)}
                  style={{
                    width: "28px",
                    height: "28px",
                    margin: "2px",
                    borderRadius: "4px",
                    border: "none",
                    cursor: "pointer",
                    background: item.rating >= n ? "gold" : "#555",
                    color: item.rating >= n ? "black" : "white"
                  }}
                >
                  {n}
                </button>
              ))}
            </div>

            {item.rating && (
              <button
                onClick={() => handleRemoveRating(item)}
                style={{
                  marginBottom: "10px",
                  background: "transparent",
                  border: "none",
                  color: "red",
                  cursor: "pointer"
                }}
              >
                Remove rating
              </button>
            )}

            <button
              onClick={() => handleRemove(item)}
              style={{
                width: "100%",
                padding: "8px",
                background: "red",
                border: "none",
                borderRadius: "6px",
                color: "white",
                cursor: "pointer"
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