import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../api/axios.js";
import { Link } from "react-router-dom";

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
    <div className="page-container">
      <h1>Watched</h1>

      {/* FILTER BAR */}
      <div className="filter-bar">
        <div>
          <label className="filter-label">Sort:</label>
          <select
            value={sort}
            onChange={handleSortChange}
            className="filter-select"
          >
            <option value="">None</option>
            <option value="rating_desc">Rating Desc</option>
            <option value="rating_asc">Rating Asc</option>
          </select>
        </div>

        <button
          onClick={handleFavoritesToggle}
          className={favorites === "true" ? "btn-fav-toggle active" : "btn-fav-toggle"}
        >
          {favorites === "true" ? "Showing Favorites" : "Show Favorites Only"}
        </button>
      </div>

      {items.length === 0 && (
        <p>You haven't watched anything yet.</p>
      )}

      <div className="media-grid">
        {items.map(item => (
          <div key={item.tmdb_id} className="media-card">
            <Link to={`/media/${item.type}/${item.tmdb_id}`}>
              <img
                src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
                className="media-card-img"
              />
            </Link>

            <h3 className="media-title">{item.title}</h3>
            <p className="media-year">{item.release_year}</p>

            {/* Rating */}
            <div className="rating-row">
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button
                  key={n}
                  onClick={() => handleRate(item, n)}
                  className={item.rating >= n ? "btn-rating active" : "btn-rating"}
                >
                  {n}
                </button>
              ))}
            </div>

            {item.rating && (
              <button
                onClick={() => handleRemoveRating(item)}
                className="btn-remove-rating"
              >
                Remove rating
              </button>
            )}

            {/* Favorite / Unfavorite */}
            {item.is_favorite ? (
              <button
                onClick={() => handleUnfavorite(item)}
                className="btn btn-unfavorite"
              >
                Remove Favorite
              </button>
            ) : (
              <button
                onClick={() => handleFavorite(item)}
                className="btn btn-favorite"
              >
                Add to Favorites
              </button>
            )}

            <button
              onClick={() => handleRemove(item)}
              className="btn btn-remove"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

