import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiSearch } from "react-icons/fi";

export default function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e) {
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    }
    if (searchOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchOpen]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && query.trim() !== "") {
      navigate(`/search?q=${query}`);
      setSearchOpen(false);
      setQuery("");
    }
    if (e.key === "Escape") {
      setSearchOpen(false);
    }
  }

  return (
    <header className="cinema-header">
      <div className="cinema-header-inner">

        <div className="cinema-logo">MyScreenbook</div>

        <nav className="cinema-nav">

          <div className={`search-wrapper ${searchOpen ? "open" : ""}`} ref={inputRef}>
            <FiSearch
              className="search-icon"
              onClick={() => setSearchOpen(prev => !prev)}
            />

            {searchOpen && (
              <input
                autoFocus
                type="text"
                className="search-input"
                placeholder="Search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            )}
          </div>

          <Link to="/watched">Watched</Link>
          <Link to="/watchlist">Watchlist</Link>
          <Link to="/favorites">Favorites</Link>
        </nav>

      </div>
    </header>
  );
}
