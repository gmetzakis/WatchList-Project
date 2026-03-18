import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiSearch, FiUser, FiLogOut, FiUsers } from "react-icons/fi";
import api from "../api/axios.js";

export default function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountPinned, setAccountPinned] = useState(false);
  const [query, setQuery] = useState("");
  const [friendNotifications, setFriendNotifications] = useState({
    incomingPending: 0,
    acceptedUpdates: 0,
    total: 0,
  });
  const inputRef = useRef(null);
  const accountRef = useRef(null);
  const accountCloseTimeoutRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function handleClickOutside(e) {
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        setSearchOpen(false);
      }

      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountOpen(false);
        setAccountPinned(false);
      }
    }

    if (searchOpen || accountOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchOpen, accountOpen]);

  useEffect(() => {
    return () => {
      if (accountCloseTimeoutRef.current) {
        clearTimeout(accountCloseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFriendNotifications() {
      try {
        const res = await api.get("/friends/notifications");
        if (!cancelled) {
          setFriendNotifications(res.data?.notifications || {
            incomingPending: 0,
            acceptedUpdates: 0,
            total: 0,
          });
        }
      } catch {
        if (!cancelled) {
          setFriendNotifications({ incomingPending: 0, acceptedUpdates: 0, total: 0 });
        }
      }
    }

    loadFriendNotifications();
    const intervalId = setInterval(loadFriendNotifications, 30000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [location.pathname]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && query.trim() !== "") {
      navigate(`/search?q=${query}`);
      setSearchOpen(false);
      setQuery("");
    }
    if (e.key === "Escape") {
      setSearchOpen(false);
      setAccountOpen(false);
      setAccountPinned(false);
    }
  }

  function handleAccountMouseEnter() {
    if (accountCloseTimeoutRef.current) {
      clearTimeout(accountCloseTimeoutRef.current);
      accountCloseTimeoutRef.current = null;
    }

    setAccountOpen(true);
  }

  function handleAccountMouseLeave() {
    if (accountPinned) {
      return;
    }

    accountCloseTimeoutRef.current = setTimeout(() => {
      setAccountOpen(false);
      accountCloseTimeoutRef.current = null;
    }, 180);
  }

  function handleAccountToggle() {
    if (accountCloseTimeoutRef.current) {
      clearTimeout(accountCloseTimeoutRef.current);
      accountCloseTimeoutRef.current = null;
    }

    if (accountPinned) {
      setAccountPinned(false);
      setAccountOpen(false);
      return;
    }

    setAccountPinned(true);
    setAccountOpen(true);
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("auth-storage");
    setAccountOpen(false);
    setAccountPinned(false);
    navigate("/login", { replace: true });
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

          <div
            className={`account-menu-wrapper ${accountOpen ? "open" : ""}`}
            ref={accountRef}
            onMouseEnter={handleAccountMouseEnter}
            onMouseLeave={handleAccountMouseLeave}
          >
            <button
              type="button"
              className="account-toggle-btn"
              onClick={handleAccountToggle}
              aria-label="Open account menu"
              aria-expanded={accountOpen}
            >
              <FiUser />
              {friendNotifications.total > 0 && (
                <span className="account-notification-badge">{friendNotifications.total}</span>
              )}
            </button>

            <div className="account-dropdown">
              <Link to="/friends" className="account-dropdown-link" onClick={() => {
                setAccountOpen(false);
                setAccountPinned(false);
              }}>
                <FiUsers />
                <span>Friends</span>
                {friendNotifications.total > 0 && (
                  <span className="menu-notification-dot">{friendNotifications.total}</span>
                )}
              </Link>

              <Link to="/profile" className="account-dropdown-link" onClick={() => {
                setAccountOpen(false);
                setAccountPinned(false);
              }}>
                <FiUser />
                <span>Profile</span>
              </Link>

              <button type="button" className="account-dropdown-action" onClick={handleLogout}>
                <FiLogOut />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </nav>

      </div>
    </header>
  );
}
