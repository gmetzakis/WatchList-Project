import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FiSearch, FiUser, FiLogOut, FiUsers, FiMenu, FiX, FiCompass, FiEye, FiBookmark, FiHeart } from "react-icons/fi";
import api from "../api/axios.js";

export default function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMode, setSearchMode] = useState("titles");
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountPinned, setAccountPinned] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobileNav, setIsMobileNav] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 980px)").matches;
  });
  const [query, setQuery] = useState("");
  const [friendNotifications, setFriendNotifications] = useState({
    incomingPending: 0,
    acceptedUpdates: 0,
    total: 0,
  });
  const inputRef = useRef(null);
  const accountRef = useRef(null);
  const navRef = useRef(null);
  const menuToggleRef = useRef(null);
  const accountCloseTimeoutRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isFriendsRoute = location.pathname === "/friends";
  const friendsLinkState = !isFriendsRoute && friendNotifications.total > 0
    ? { friendNotificationSnapshot: friendNotifications }
    : null;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 980px)");
    const handleViewportChange = (event) => {
      setIsMobileNav(event.matches);
      if (event.matches) {
        setSearchOpen(false);
        setQuery("");
      }
    };

    setIsMobileNav(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleViewportChange);

    return () => {
      mediaQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        setSearchOpen(false);
        setQuery("");
      }

      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountOpen(false);
        setAccountPinned(false);
      }

      if (
        mobileMenuOpen &&
        navRef.current &&
        !navRef.current.contains(e.target) &&
        menuToggleRef.current &&
        !menuToggleRef.current.contains(e.target)
      ) {
        setMobileMenuOpen(false);
      }
    }

    if (searchOpen || accountOpen || mobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchOpen, accountOpen, mobileMenuOpen]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setQuery("");
    setAccountOpen(false);
    setAccountPinned(false);
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      if (accountCloseTimeoutRef.current) {
        clearTimeout(accountCloseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isFriendsRoute) {
      setFriendNotifications({ incomingPending: 0, acceptedUpdates: 0, total: 0 });
      api.post("/friends/notifications/read").catch(() => {
        // Best-effort call to clear server-side unread counters.
      });
    }
  }, [isFriendsRoute]);

  useEffect(() => {
    let cancelled = false;

    async function loadFriendNotifications() {
      try {
        const res = await api.get("/friends/notifications");
        if (!cancelled) {
          if (isFriendsRoute) {
            setFriendNotifications({ incomingPending: 0, acceptedUpdates: 0, total: 0 });
            return;
          }

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
  }, [location.pathname, isFriendsRoute]);

  function handleFriendsClick() {
    setAccountOpen(false);
    setAccountPinned(false);
    setMobileMenuOpen(false);

    if (isFriendsRoute) {
      window.dispatchEvent(new Event("friends:refresh"));
    }
  }

  function runHeaderSearch() {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    navigate(`/search?q=${encodeURIComponent(trimmedQuery)}&mode=${searchMode}`);
    setSearchOpen(false);
    setMobileMenuOpen(false);
    setQuery("");
  }

  function toggleSearch() {
    setSearchOpen((prev) => {
      const next = !prev;
      setQuery("");
      return next;
    });
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      runHeaderSearch();
    }
    if (e.key === "Escape") {
      setSearchOpen(false);
      setQuery("");
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

    if (isMobileNav) {
      setMobileMenuOpen(false);
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
    setMobileMenuOpen(false);
    navigate("/login", { replace: true });
  }

  return (
    <header className="cinema-header">
      <div className="cinema-header-inner">

        <Link to="/" className="cinema-logo">MyScreenbook</Link>

        <button
          ref={menuToggleRef}
          type="button"
          className={`header-menu-toggle mobile-header-toggle ${mobileMenuOpen ? "open" : ""}`}
          aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileMenuOpen}
          onClick={() => {
            setAccountOpen(false);
            setAccountPinned(false);
            setMobileMenuOpen((prev) => !prev);
          }}
        >
          {mobileMenuOpen ? <FiX /> : <FiMenu />}
        </button>

        {isMobileNav && (
          <div
            className={`account-menu-wrapper mobile-account-menu-wrapper ${accountOpen ? "open" : ""}`}
            ref={accountRef}
          >
            <button
              type="button"
              className={`mobile-account-toggle mobile-header-toggle ${accountOpen ? "open" : ""}`}
              onClick={handleAccountToggle}
              aria-label={accountOpen ? "Close account menu" : "Open account menu"}
              aria-expanded={accountOpen}
            >
              {accountOpen ? <FiX /> : <FiUser />}
              {!isFriendsRoute && friendNotifications.total > 0 && (
                <span className="account-notification-badge">{friendNotifications.total}</span>
              )}
            </button>

            <div className="account-dropdown">
              <Link to="/friends" state={friendsLinkState} className="account-dropdown-link" onClick={handleFriendsClick}>
                <FiUsers />
                <span>Friends</span>
                {!isFriendsRoute && friendNotifications.total > 0 && (
                  <span className="menu-notification-dot">{friendNotifications.total}</span>
                )}
              </Link>

              <Link to="/profile" className="account-dropdown-link" onClick={() => {
                setAccountOpen(false);
                setAccountPinned(false);
                setMobileMenuOpen(false);
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
        )}

        <nav ref={navRef} className={`cinema-nav ${mobileMenuOpen ? "open" : ""}`}>

          {isMobileNav ? (
            <Link to="/search" onClick={() => setMobileMenuOpen(false)}>
              <FiSearch className="nav-link-icon" />
              <span>Search</span>
            </Link>
          ) : (
            <div className={`search-wrapper ${searchOpen ? "open" : ""}`} ref={inputRef}>
              <FiSearch
                className="search-icon"
                onClick={toggleSearch}
              />

              {searchOpen && (
                <div className="header-search-panel">
                  <input
                    autoFocus
                    type="text"
                    className="search-input"
                    placeholder={searchMode === "people" ? "Search actor or director..." : "Search movies or series..."}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />

                  <div className="header-search-actions-row">
                    <div className="header-search-mode-switch" role="tablist" aria-label="Header search mode">
                      <button
                        type="button"
                        className={`header-search-mode-btn ${searchMode === "titles" ? "active" : ""}`}
                        onClick={() => setSearchMode("titles")}
                      >
                        Titles
                      </button>
                      <button
                        type="button"
                        className={`header-search-mode-btn ${searchMode === "people" ? "active" : ""}`}
                        onClick={() => setSearchMode("people")}
                      >
                        Actor / Director
                      </button>
                    </div>

                    <button
                      type="button"
                      className="header-search-submit"
                      onClick={runHeaderSearch}
                    >
                      Search
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <Link to="/explore" onClick={() => setMobileMenuOpen(false)}>
            <FiCompass className="nav-link-icon" />
            <span>Explore</span>
          </Link>
          <Link to="/watched" onClick={() => setMobileMenuOpen(false)}>
            <FiEye className="nav-link-icon" />
            <span>Watched</span>
          </Link>
          <Link to="/watchlist" onClick={() => setMobileMenuOpen(false)}>
            <FiBookmark className="nav-link-icon" />
            <span>Watchlist</span>
          </Link>
          <Link to="/favorites" onClick={() => setMobileMenuOpen(false)}>
            <FiHeart className="nav-link-icon" />
            <span>Favorites</span>
          </Link>

          {!isMobileNav && (
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
                {!isFriendsRoute && friendNotifications.total > 0 && (
                  <span className="account-notification-badge">{friendNotifications.total}</span>
                )}
              </button>

              <div className="account-dropdown">
                <Link to="/friends" state={friendsLinkState} className="account-dropdown-link" onClick={handleFriendsClick}>
                  <FiUsers />
                  <span>Friends</span>
                  {!isFriendsRoute && friendNotifications.total > 0 && (
                    <span className="menu-notification-dot">{friendNotifications.total}</span>
                  )}
                </Link>

                <Link to="/profile" className="account-dropdown-link" onClick={() => {
                  setAccountOpen(false);
                  setAccountPinned(false);
                  setMobileMenuOpen(false);
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
          )}
        </nav>

      </div>
    </header>
  );
}
