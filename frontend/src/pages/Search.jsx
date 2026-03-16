import { useState, useEffect } from "react";
import api from "../api/axios";
import { Link, useSearchParams } from "react-router-dom";
import { Heart, Eye, EyeOff, Bookmark, BookmarkMinus, BookmarkPlus } from "lucide-react";

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // ---------------------------
  // FETCH STATUS FOR EACH ITEM
  // ---------------------------
  async function fetchStatus(item) {
    try {
      const type = item.type === "tv" ? "series" : item.type;
      const res = await api.get(`/media/${type}/${item.id}/status`);

      return {
        ...item,
        status: res.data.status,
        rating: res.data.rating || null,
        is_favorite: res.data.favorite || false
      };
    } catch (err) {
      console.error("Status fetch error:", err);
      return { ...item, status: null, rating: null, is_favorite: false };
    }
  }

  // ---------------------------
  // SEARCH + STATUS MERGE
  // ---------------------------
  async function runSearch(q) {
    setLoading(true);
    try {
      const res = await api.get(`/tmdb/search?query=${q}`);

      const withPosters = res.data.results.filter(r => r.poster_path);

      const withStatus = await Promise.all(
        withPosters.map(item => fetchStatus(item))
      );

      setResults(withStatus);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialQuery.trim() !== "") {
      runSearch(initialQuery);
    }
  }, [initialQuery]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    runSearch(query);
  }

  // ---------------------------
  // HELPERS
  // ---------------------------
  function stop(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function updateItem(id, updates) {
    setResults(prev =>
      prev.map(item =>
        item.id === id ? { ...item, ...updates } : item
      )
    );
  }

  // ---------------------------
  // ACTIONS (corrected)
  // ---------------------------
  async function addToWatchlist(item) {
    const type = item.type === "tv" ? "series" : item.type;
    await api.post(`/media/${item.id}/watchlist`, { type: type, genres: item.genres });
    updateItem(item.id, { status: "watchlist" });
  }

  async function removeFromWatchlist(item) {
    const type = item.type === "tv" ? "series" : item.type;
    await api.delete(`/media/${item.id}/watchlist`, { data: { type } });
    updateItem(item.id, { status: null });
  }

  async function markAsWatched(item) {
    const type = item.type === "tv" ? "series" : item.type;
    await api.post(`/media/${item.id}/watched`, { type: type, genres: item.genres });
    updateItem(item.id, { status: "watched" });
  }

  async function removeFromWatched(item) {
    const type = item.type === "tv" ? "series" : item.type;
    await api.delete(`/media/${item.id}/watched`, { data: { type } });
    updateItem(item.id, { status: null, rating: null });
  }

  async function moveToWatched(item) {
    const type = item.type === "tv" ? "series" : item.type;
    await api.post(`/media/${item.id}/watchlist-to-watched`, { type });
    updateItem(item.id, { status: "watched" });
  }

  async function handleRate(item, n) {
    const type = item.type === "tv" ? "series" : item.type;
    await api.post(`/media/${item.id}/rating`, { type, rating: n });
    updateItem(item.id, { rating: n });
  }

  async function handleFavorite(item) {
    const type = item.type === "tv" ? "series" : item.type;
    await api.post(`/media/${item.id}/favorite`, { type });
    updateItem(item.id, { is_favorite: true });
  }

  async function handleUnfavorite(item) {
    const type = item.type === "tv" ? "series" : item.type;
    await api.delete(`/media/${item.id}/favorite`, { data: { type } });
    updateItem(item.id, { is_favorite: false });
  }

  // ---------------------------
  // RENDER
  // ---------------------------
  return (
    <div className="page-container">

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search movies or series..."
          className="searchpage-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <button className="search-btn" type="submit">
          Search
        </button>
      </form>

      {loading && <p>Searching...</p>}

      <div className="media-grid">
        {results.map((item) => (
          <div key={item.id} className="media-card">

            <Link
              to={`/media/${item.type === "tv" ? "series" : item.type}/${item.id}`}
              className="media-image-wrapper"
            >
              <img
                src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
                alt={item.title || item.name}
                className="media-card-img"
              />

              <div className="hover-controls">

                {/* TITLE + YEAR */}
                <div className="hover-title">
                  <span className="hover-title-text">
                    {item.title || item.name}
                  </span>
                  <span className="hover-year-text">
                    {(item.release_date || item.first_air_date || "").slice(0, 4)}
                  </span>

                  {/* RATING (only if watched) */}
                  {item.status === "watched" && (
                    <div className="rating-inline">
                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <span
                          key={n}
                          className={item.rating >= n ? "star active" : "star"}
                          onClick={(e) => { stop(e); handleRate(item, n); }}
                        >
                          ★
                        </span>
                      ))}

                      {item.rating && (
                        <span className="rating-label">{item.rating}/10</span>
                      )}
                    </div>
                  )}
                </div>

                {/* ICONS — bottom left */}
                <div className="control-icons">

                  {/* IF NOT WATCHED & NOT WATCHLIST */}
                  {item.status === null && (
                    <>
                      <span
                        className="watched-icon"
                        onClick={(e) => { stop(e); addToWatchlist(item); }}
                        title="Add to Watchlist"
                      >
                        <BookmarkPlus size={32} />
                      </span>

                      <span
                        className="watched-icon"
                        onClick={(e) => { stop(e); markAsWatched(item); }}
                        title="Mark as Watched"
                      >
                        <Eye size={32} />
                      </span>
                    </>
                  )}

                  {/* IF IN WATCHLIST */}
                  {item.status === "watchlist" && (
                    <>
                      <span
                        className="watched-icon"
                        onClick={(e) => { stop(e); removeFromWatchlist(item); }}
                        title="Remove from Watchlist"
                      >
                        <BookmarkMinus size={32} />
                      </span>

                      <span
                        className="watched-icon"
                        onClick={(e) => { stop(e); moveToWatched(item); }}
                        title="Move to Watched"
                      >
                        <Eye size={32} />
                      </span>
                    </>
                  )}

                  {/* IF WATCHED */}
                  {item.status === "watched" && (
                    <>
                      <span
                        className={`favorite-icon ${item.is_favorite ? "active" : ""}`}
                        onClick={(e) => {
                          stop(e);
                          item.is_favorite
                            ? handleUnfavorite(item)
                            : handleFavorite(item);
                        }}
                        title="Favorite"
                      >
                        <Heart size={32} />
                      </span>

                      <span
                        className="watched-icon active"
                        onClick={(e) => { stop(e); removeFromWatched(item); }}
                        title="Remove from Watched"
                      >
                        <EyeOff size={32} />
                      </span>
                    </>
                  )}

                </div>
              </div>
            </Link>

          </div>
        ))}
      </div>

    </div>
  );
}
