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
        {results.map((item) => (
          <Link
            key={item.id}
            to={`/media/${item.type}/${item.id}`}
            className="media-card"
          >
            <img
              src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
              alt={item.title || item.name}
              className="media-card-img"
            />

            <h3 className="media-title">{item.title || item.name}</h3>
            <p className="media-year">
              {(item.release_date || item.first_air_date || "").slice(0, 4)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}