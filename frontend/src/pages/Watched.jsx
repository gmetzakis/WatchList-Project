import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios.js";
import { Heart, EyeOff, LayoutGrid, GalleryVertical } from "lucide-react";

export default function WatchedPage() {
  const [items, setItems] = useState([]);
  const [availableGenres, setAvailableGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState("all");

  const [loading, setLoading] = useState(true);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sort = searchParams.get("sort") || "";
  const favorites = searchParams.get("favorites") || "";
  const type = searchParams.get("type") || "all";
  const genre = searchParams.get("genre") || "all";


  const [viewMode, setViewMode] = useState("grid");

  // Single-tape scroll (non-grouped mode)
  const scrollRef = useRef(null);

  function scrollLeft() {
    scrollRef.current?.scrollBy({ left: -600, behavior: "smooth" });
  }

  function scrollRight() {
    scrollRef.current?.scrollBy({ left: 600, behavior: "smooth" });
  }

  function renderCard(item) {
    return (
      <div key={item.tmdb_id} className="media-card">
        <Link
          to={`/media/${item.type}/${item.tmdb_id}`}
          className="media-image-wrapper"
        >
          <img
            src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
            className="media-card-img"
          />

          <div className="hover-controls">
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
              >
                <EyeOff size={32} />
              </span>
            </div>
          </div>
        </Link>
      </div>
    );
  }

  // Reusable tape component for grouped mode
  function RatingTape({ items, title }) {
    const localRef = useRef(null);

    function left() {
      localRef.current?.scrollBy({ left: -600, behavior: "smooth" });
    }
    function right() {
      localRef.current?.scrollBy({ left: 600, behavior: "smooth" });
    }

    return (
      <div className="tape-wrapper">
        <button className="tape-arrow left" onClick={left}>‹</button>

        <div className="tape-scroll" ref={localRef}>
          <div className="media-tape">
            {items.map(item => renderCard(item))}
          </div>
        </div>

        <button className="tape-arrow right" onClick={right}>›</button>
      </div>
    );
  }

  useEffect(() => {
    load();
  }, [sort, favorites, type, genre]);

  async function load() {
    try {
      const res = await api.get("/media/watched", {
        params: {
          sort: sort || undefined,
          favorites: favorites || undefined,
          type: type !== "all" ? type : undefined
        }
      });
      setItems(res.data.items);
      setAvailableGenres(res.data.genres);

    } catch (err) {
      console.error("Watched load error:", err);
    } finally {
      setLoading(false);
    }
  }

  function updateQuery(newSort, newFavorites, newType, newGenre) {
    const params = new URLSearchParams();
    if (newSort) params.set("sort", newSort);
    if (newFavorites) params.set("favorites", newFavorites);
    if (newType && newType !== "all") params.set("type", newType);
    if (newGenre && newGenre !== "all") params.set("genre", newGenre);
    navigate(`/watched?${params.toString()}`);
  }

  function handleSortChange(e) {
    updateQuery(e.target.value, favorites, type);
  }

  function handleFavoritesToggle() {
    updateQuery(sort, favorites === "true" ? "" : "true", type);
  }

  function handleTypeChange(e) {
    updateQuery(sort, favorites, e.target.value);
  }

  function handleGenreChange(e) {
    setSelectedGenre(e.target.value);
    updateQuery(sort, favorites, type, e.target.value);
  }

  async function handleRemove(item) {
    try {
      await api.delete(`/media/${item.tmdb_id}/watched`, {
        data: { type: item.type }
      });
      setItems(prev => prev.filter(i => i.tmdb_id !== item.tmdb_id));
    } catch (err) {}
  }

  async function handleRate(item, rating) {
    try {
      await api.post(`/media/${item.tmdb_id}/rating`, {
        type: item.type,
        rating
      });
      setItems(prev =>
        prev.map(i => i.tmdb_id === item.tmdb_id ? { ...i, rating } : i)
      );
    } catch (err) {}
  }

  async function handleFavorite(item) {
    try {
      await api.post(`/media/${item.tmdb_id}/favorite`, {
        type: item.type
      });
      setItems(prev =>
        prev.map(i => i.tmdb_id === item.tmdb_id ? { ...i, is_favorite: true } : i)
      );
    } catch (err) {}
  }

  async function handleUnfavorite(item) {
    try {
      await api.delete(`/media/${item.tmdb_id}/favorite`, {
        data: { type: item.type }
      });
      setItems(prev =>
        prev.map(i => i.tmdb_id === item.tmdb_id ? { ...i, is_favorite: false } : i)
      );
    } catch (err) {}
  }

  if (loading) return <div>Loading watched history...</div>;

  const isRatingSort = sort === "rating_desc" || sort === "rating_asc";

  // Group items by rating
  const grouped = {
    1: [], 2: [], 3: [], 4: [], 5: [],
    6: [], 7: [], 8: [], 9: [], 10: [],
    unrated: []
  };

  const filteredItems = selectedGenre === "all"
  ? items
  : items.filter(item =>
      Array.isArray(item.genres) &&
      item.genres.includes(selectedGenre)
    );

  filteredItems.forEach(item => {
    if (!item.rating) grouped.unrated.push(item);
    else grouped[item.rating].push(item);
  });

  const orderDesc = [10,9,8,7,6,5,4,3,2,1,"unrated"];
  const orderAsc = [1,2,3,4,5,6,7,8,9,10,"unrated"];
  const activeOrder = sort === "rating_desc" ? orderDesc : orderAsc;

  return (
    <div className="page-container">
      <h1>Watched</h1>

      <div className="filter-bar">

        <div className="view-toggle-container">
          <div
            className={`view-toggle-box ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid size={22} />
          </div>

          <div
            className={`view-toggle-box ${viewMode === "tape" ? "active" : ""}`}
            onClick={() => setViewMode("tape")}
          >
            <GalleryVertical size={22} />
          </div>
        </div>

        <div>
          <label className="filter-label">Sort:</label>
          <select value={sort} onChange={handleSortChange} className="filter-select">
            <option value="">None</option>
            <option value="rating_desc">Rating Desc</option>
            <option value="rating_asc">Rating Asc</option>
          </select>
        </div>

        <div>
          <label className="filter-label">Genre:</label>
          <select
            value={genre}
            onChange={handleGenreChange}
            className="filter-select"
          >
            <option value="all">All</option>
            {availableGenres.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
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
          <select value={type} onChange={handleTypeChange} className="filter-select">
            <option value="all">All</option>
            <option value="movie">Movies</option>
            <option value="series">Shows</option>
          </select>
        </div>
      </div>

      {items.length === 0 && <p>You haven't watched anything yet.</p>}

      {/* GROUPED MODE */}
      {isRatingSort && (
        <div className="rating-groups">
          {activeOrder.map(key => {
            const bucket = grouped[key];
            if (!bucket || bucket.length === 0) return null;

            const title = key === "unrated"
              ? "Unrated"
              : (
                  <>
                    {key}/10 <span className="star active">★</span>
                  </>
                );
            return (
              <div key={key} className="rating-section">
                <h2 className="rating-section-title">{title}</h2>

                {viewMode === "grid" ? (
                  <div className="media-grid">
                    {bucket.map(item => renderCard(item))}
                  </div>
                ) : (
                  <RatingTape items={bucket} title={title}
                    />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* NON-GROUPED MODE */}
      {!isRatingSort && (
        <>
          {viewMode === "grid" && (
            <div className="media-grid">
              {filteredItems.map(item => renderCard(item))}
            </div>
          )}

          {viewMode === "tape" && (
            <div className="tape-wrapper">
              <button className="tape-arrow left" onClick={scrollLeft}>‹</button>

              <div className="tape-scroll" ref={scrollRef}>
                <div className="media-tape">
                  {filteredItems.map(item => renderCard(item))}
                </div>
              </div>

              <button className="tape-arrow right" onClick={scrollRight}>›</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
