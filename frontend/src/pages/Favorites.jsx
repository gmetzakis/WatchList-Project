import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { Link } from "react-router-dom";

export default function FavoritesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await api.get("/media/favorites");
      setItems(res.data);
    } catch (err) {
      console.error("Favorites load error:", err);
    } finally {
      setLoading(false);
    }
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