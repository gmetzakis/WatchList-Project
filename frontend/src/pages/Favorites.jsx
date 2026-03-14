import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

export default function FavoritesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sort = searchParams.get("sort") || "";
  const type = searchParams.get("type") || "all"; // ⭐ NEW

  useEffect(() => {
    load();
  }, [sort, type]); // ⭐ reload when filters change

  async function load() {
    try {
      const res = await api.get("/media/favorites", {
        params: {
          sort: sort || undefined,
          type: type !== "all" ? type : undefined // ⭐ send only movie/series
        }
      });

      setItems(res.data);
    } catch (err) {
      console.error("Favorites load error:", err);
    } finally {
      setLoading(false);
    }
  }

  // ⭐ NEW: update URL with both filters
  function updateQuery(newSort, newType) {
    const params = new URLSearchParams();

    if (newSort) params.set("sort", newSort);
    if (newType && newType !== "all") params.set("type", newType);

    navigate(`/favorites?${params.toString()}`);
  }

  // ⭐ UPDATED: preserve type
  function handleSortChange(e) {
    updateQuery(e.target.value, type);
  }

  // ⭐ NEW: type filter handler
  function handleTypeChange(e) {
    updateQuery(sort, e.target.value);
  }

  async function handleRemoveFavorite(item) {
    try {
      await api.delete(`/media/${item.tmdb_id}/favorite`, {
        data: { type: item.type }
      });

      setItems(prev => prev.filter(i => i.tmdb_id !== item.tmdb_id));
    } catch (err) {
      console.error("Unfavorite error:", err);
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

  async function handleRemoveWatched(item) {
    try {
      await api.delete(`/media/${item.tmdb_id}/watched`, {
        data: { type: item.type }
      });

      setItems(prev => prev.filter(i => i.tmdb_id !== item.tmdb_id));
    } catch (err) {
      console.error("Remove watched error:", err);
    }
  }

  if (loading) {
    return <div>Loading favorites...</div>;
  }

  return (
    <div className="page-container">
      <h1>Favorites</h1>

      {/* ⭐ FILTER BAR */}
      <div className="filter-bar" style={{ marginBottom: "20px" }}>

        {/* SORT */}
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

        {/* TYPE */}
        <div style={{ marginLeft: "20px" }}>
          <label className="filter-label">Type:</label>
          <select
            value={type}
            onChange={handleTypeChange}
            className="filter-select"
          >
            <option value="all">All</option>
            <option value="movie">Movies</option>
            <option value="series">Shows</option>
          </select>
        </div>

      </div>

      {items.length === 0 && (
        <p>You have no favorite movies or series yet.</p>
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

            {/* Remove from favorites */}
            <button
              onClick={() => handleRemoveFavorite(item)}
              className="btn btn-unfavorite"
            >
              Remove Favorite
            </button>

            {/* Remove from watched */}
            <button
              onClick={() => handleRemoveWatched(item)}
              className="btn btn-remove"
            >
              Remove from Watched
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}