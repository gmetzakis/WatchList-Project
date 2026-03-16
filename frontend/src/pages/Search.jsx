import { useState, useEffect } from "react";
import api from "../api/axios";
import { useAuthStore } from "../store/authStore";
import { Link, useSearchParams } from "react-router-dom";

export default function SearchPage() {
  const user = useAuthStore((state) => state.user);

  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";   // ⭐ read from URL

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // ⭐ Auto-run search when arriving from header
  useEffect(() => {
    if (initialQuery.trim() !== "") {
      runSearch(initialQuery);
    }
  }, [initialQuery]);

  async function runSearch(q) {
    setLoading(true);
    try {
      const res = await api.get(`/tmdb/search?query=${q}`);
      setResults(res.data.results);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    runSearch(query);
  }

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
       {results
        .filter(item => item.poster_path)   // ⬅️ skip items without images
        .map((item) => (
        <div key={item.id} className="media-card">

          <Link
            to={`/media/${item.type}/${item.id}`}
            className="media-image-wrapper"
          >
            <img
              src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
              alt={item.title || item.name}
              className="media-card-img"
            />

            {/* HOVER OVERLAY */}
            <div className="hover-controls">

              {/* TITLE + YEAR — TOP LEFT */}
              <div className="hover-title">
                <span className="hover-title-text">
                  {item.title || item.name}
                </span>

                <span className="hover-year-text">
                  {(item.release_year || "").slice(0, 4)}
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