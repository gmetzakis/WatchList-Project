import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios.js";
import { Heart, Eraser, EyeOff } from "lucide-react";

export default function WatchedPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sort = searchParams.get("sort") || "";
  const favorites = searchParams.get("favorites") || "";
  const type = searchParams.get("type") || "all";

  useEffect(() => {
    load();
  }, [sort, favorites, type]);

  async function load() {
    try {
      const res = await api.get("/media/watched", {
        params: {
          sort: sort || undefined,
          favorites: favorites || undefined,
          type: type !== "all" ? type : undefined
        }
      });

      setItems(res.data);
    } catch (err) {
      console.error("Watched load error:", err);
    } finally {
      setLoading(false);
    }
  }

  function updateQuery(newSort, newFavorites, newType) {
    const params = new URLSearchParams();

    if (newSort) params.set("sort", newSort);
    if (newFavorites) params.set("favorites", newFavorites);
    if (newType && newType !== "all") params.set("type", newType);

    navigate(`/watched?${params.toString()}`);
  }

  function handleSortChange(e) {
    updateQuery(e.target.value, favorites, type);
  }

  function handleFavoritesToggle() {
    const newValue = favorites === "true" ? "" : "true";
    updateQuery(sort, newValue, type);
  }

  function handleTypeChange(e) {
    updateQuery(sort, favorites, e.target.value);
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

        <div>
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
        <p>You haven't watched anything yet.</p>
      )}

      <div className="media-grid">
        {items.map(item => (
          <div key={item.tmdb_id} className="media-card">

            <Link
              to={`/media/${item.type}/${item.tmdb_id}`}
              className="media-image-wrapper"
            >
              <img
                src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
                className="media-card-img"
              />

              {/* HOVER OVERLAY */}
              <div className="hover-controls">

                {/* TITLE + YEAR — TOP LEFT */}
                <div className="hover-title">
                  <span className="hover-title-text">{item.title}</span>
                  <span className="hover-year-text">{item.release_year}</span>

                  <div className="rating-inline">
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <span
                        key={n}
                        className={item.rating >= n ? "star active" : "star"}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRate(item, n);
                        }}
                      >
                        ★
                      </span>
                    ))}

                    {item.rating && (
                      <span className="rating-label">{item.rating}/10</span>
                    )}
                  </div>
                </div>

                {/* ICONS — bottom left */}
                <div className="control-icons">

                  <span
                    className={`favorite-icon ${item.is_favorite ? "active" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      item.is_favorite ? handleUnfavorite(item) : handleFavorite(item);
                    }}
                  >
                    <Heart size={32} />
                  </span>

                  <span
                    className="watched-icon active"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemove(item);
                    }}
                    title="Remove from watched"
                  >
                    <EyeOff size={32} />
                  </span>

                </div>

              </div>
            </Link>


          </div>
        ))}
      </div>
    </div>
  );
}
