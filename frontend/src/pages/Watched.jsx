import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../api/axios.js";

export default function WatchedPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sort = searchParams.get("sort") || "";
  const favorites = searchParams.get("favorites") || "";

  useEffect(() => {
    load();
  }, [sort, favorites]);

  async function load() {
    try {
      const res = await api.get("/media/watched", {
        params: {
          sort: sort || undefined,
          favorites: favorites || undefined
        }
      });

      setItems(res.data);
    } catch (err) {
      console.error("Watched load error:", err);
    } finally {
      setLoading(false);
    }
  }

  function updateQuery(newSort, newFavorites) {
    const params = new URLSearchParams();

    if (newSort) params.set("sort", newSort);
    if (newFavorites) params.set("favorites", newFavorites);

    navigate(`/watched?${params.toString()}`);
  }

  function handleSortChange(e) {
    updateQuery(e.target.value, favorites);
  }

  function handleFavoritesToggle() {
    const newValue = favorites === "true" ? "" : "true";
    updateQuery(sort, newValue);
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

  async function handleFavorite(item) {
    try {
      await api.post(`/media/${item.tmdb_id}/favorite`, {
        type: item.type
      });

      setItems(prev =>
        prev.map(i =>
          i.tmdb_id === item.tmdb_id ? { ...i, is_favorite: true } : i
        )
      );
    } catch (err) {
      console.error("Favorite error:", err);
    }
  }

  async function handleUnfavorite(item) {
    try {
      await api.delete(`/media/${item.tmdb_id}/favorite`, {
        data: { type: item.type }
      });

      setItems(prev =>
        prev.map(i =>
          i.tmdb_id === item.tmdb_id ? { ...i, is_favorite: false } : i
        )
      );
    } catch (err) {
      console.error("Unfavorite error:", err);
    }
  }

  if (loading) {
    return <div>Loading watched history...</div>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Watched</h1>

      {/* FILTER BAR */}
      <div style={{
        display: "flex",
        gap: "20px",
        marginTop: "20px",
        marginBottom: "20px",
        alignItems: "center"
      }}>
        
        {/* SORT SELECT */}
        <div>
          <label style={{ color: "white", marginRight: "10px" }}>
            Sort:
          </label>
          <select
            value={sort}
            onChange={handleSortChange}
            style={{
              padding: "6px",
              borderRadius: "6px",
              background: "#333",
              color: "white",
              border: "1px solid #555"
            }}
          >
            <option value="">None</option>
            <option value="rating_desc">Rating Desc</option>
            <option value="rating_asc">Rating Asc</option>
          </select>
        </div>

        {/* FAVORITES TOGGLE */}
        <button
          onClick={handleFavoritesToggle}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            background: favorites === "true" ? "gold" : "#444",
            color: favorites === "true" ? "black" : "white",
            border: "none",
            cursor: "pointer"
          }}
        >
          {favorites === "true" ? "Showing Favorites" : "Show Favorites Only"}
        </button>
      </div>


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

            {/* Rating */}
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

            {/* Favorite / Unfavorite */}
            {item.is_favorite ? (
              <button
                onClick={() => handleUnfavorite(item)}
                style={{
                  width: "100%",
                  padding: "8px",
                  background: "orange",
                  border: "none",
                  borderRadius: "6px",
                  color: "black",
                  cursor: "pointer",
                  marginBottom: "10px"
                }}
              >
                Remove Favorite
              </button>
            ) : (
              <button
                onClick={() => handleFavorite(item)}
                style={{
                  width: "100%",
                  padding: "8px",
                  background: "gold",
                  border: "none",
                  borderRadius: "6px",
                  color: "black",
                  cursor: "pointer",
                  marginBottom: "10px"
                }}
              >
                Add to Favorites
              </button>
            )}

            {/* Remove from watched */}
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