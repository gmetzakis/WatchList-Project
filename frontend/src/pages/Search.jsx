import { useState, useEffect } from "react";
import api from "../api/axios";
import { Link, useSearchParams } from "react-router-dom";
import { Heart, Eye, EyeOff, Bookmark, BookmarkMinus, BookmarkPlus } from "lucide-react";

const TMDB_GENRE_MAP = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialMode = searchParams.get("mode") === "people" ? "people" : "titles";

  const [query, setQuery] = useState(initialQuery);
  const [searchMode, setSearchMode] = useState(initialMode);
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
  async function runSearch(q, mode = searchMode) {
    setLoading(true);
    setResults([]);
    try {
      const endpoint = mode === "people" ? "/tmdb/search/people" : "/tmdb/search";
      const res = await api.get(`${endpoint}?query=${encodeURIComponent(q)}`);

      if (mode === "people") {
        const peopleResults = (res.data.results || []).map((person) => ({
          ...person,
          _key: `person-${person.id}`,
        }));

        setResults(peopleResults);
        return;
      }

      const withPosters = (res.data.results || [])
        .filter((r) => (r.type === "movie" || r.type === "tv") && r.poster_path)
        .map((item, index) => ({
          ...item,
          _key: `${item.type}-${item.id}-${item.person_id || "na"}-${item.role || "title"}-${index}`,
        }));

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
      runSearch(initialQuery, initialMode);
    }
  }, [initialQuery, initialMode]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    runSearch(query, searchMode);
  }

  function handleModeChange(nextMode) {
    if (nextMode === searchMode) return;

    setSearchMode(nextMode);

    if (query.trim()) {
      runSearch(query, nextMode);
    } else {
      setResults([]);
    }
  }

  // ---------------------------
  // HELPERS
  // ---------------------------
  function stop(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function updateItem(itemKey, updates) {
    setResults(prev =>
      prev.map(item =>
        item._key === itemKey ? { ...item, ...updates } : item
      )
    );
  }

  function formatGenres(genres) {
    if (!Array.isArray(genres)) return "";

    const names = genres
      .map((genre) => {
        if (typeof genre === "string") return genre;
        if (typeof genre === "number") return TMDB_GENRE_MAP[genre] || null;
        if (typeof genre?.id === "number") return TMDB_GENRE_MAP[genre.id] || genre?.name || null;
        return genre?.name || null;
      })
      .filter(Boolean);

    return names.length ? names.slice(0, 3).join(" • ") : "";
  }

  // ---------------------------
  // ACTIONS (corrected)
  // ---------------------------
  async function addToWatchlist(item) {
    const type = item.type === "tv" ? "series" : item.type;
    await api.post(`/media/${item.id}/watchlist`, { type: type, genres: item.genres });
    updateItem(item._key, { status: "watchlist" });
  }

  async function removeFromWatchlist(item) {
    const type = item.type === "tv" ? "series" : item.type;
    await api.delete(`/media/${item.id}/watchlist`, { data: { type } });
    updateItem(item._key, { status: null });
  }

  async function markAsWatched(item) {
    const type = item.type === "tv" ? "series" : item.type;
    await api.post(`/media/${item.id}/watched`, { type: type, genres: item.genres });
    updateItem(item._key, { status: "watched" });
  }

  async function removeFromWatched(item) {
    const type = item.type === "tv" ? "series" : item.type;
    await api.delete(`/media/${item.id}/watched`, { data: { type } });
    updateItem(item._key, { status: null, rating: null });
  }

  async function moveToWatched(item) {
    const type = item.type === "tv" ? "series" : item.type;
    await api.post(`/media/${item.id}/watchlist-to-watched`, { type });
    updateItem(item._key, { status: "watched" });
  }

  async function handleRate(item, n) {
    const type = item.type === "tv" ? "series" : item.type;
    await api.post(`/media/${item.id}/rating`, { type, rating: n });
    updateItem(item._key, { rating: n });
  }

  async function handleFavorite(item) {
    const type = item.type === "tv" ? "series" : item.type;
    await api.post(`/media/${item.id}/favorite`, { type });
    updateItem(item._key, { is_favorite: true });
  }

  async function handleUnfavorite(item) {
    const type = item.type === "tv" ? "series" : item.type;
    await api.delete(`/media/${item.id}/favorite`, { data: { type } });
    updateItem(item._key, { is_favorite: false });
  }

  // ---------------------------
  // RENDER
  // ---------------------------
  return (
    <div className="page-container">

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder={searchMode === "people" ? "Search actor or director..." : "Search movies or series..."}
          className="searchpage-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="search-mode-switch" role="tablist" aria-label="Search mode">
          <button
            type="button"
            className={`search-mode-btn ${searchMode === "titles" ? "active" : ""}`}
            onClick={() => handleModeChange("titles")}
          >
            Titles
          </button>
          <button
            type="button"
            className={`search-mode-btn ${searchMode === "people" ? "active" : ""}`}
            onClick={() => handleModeChange("people")}
          >
            Actor / Director
          </button>
        </div>

        <button className="search-btn" type="submit">
          Search
        </button>
      </form>

      {loading && <p>Searching...</p>}

      {searchMode === "people" ? (
        <div className="people-grid">
          {results.map((person) => (
            <Link key={person._key} to={`/person/${person.id}`} className="person-result-card">
              <img
                src={`https://image.tmdb.org/t/p/w300${person.profile_path}`}
                alt={person.name}
                className="person-result-img"
              />
              <div className="person-result-body">
                <p className="person-result-name">{person.name}</p>
                <p className="person-result-department">{person.known_for_department || "Known For"}</p>
                {Array.isArray(person.known_for) && person.known_for.length > 0 && (
                  <p className="person-result-knownfor">{person.known_for.join(" • ")}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="media-grid">
          {results.map((item) => (
            <div key={item._key} className="media-card">

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
                      {item.release_year || (item.release_date || item.first_air_date || "").slice(0, 4)}
                    </span>
                    {formatGenres(item.genres) && (
                      <span className="hover-genres-text">{formatGenres(item.genres)}</span>
                    )}

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
      )}

    </div>
  );
}
