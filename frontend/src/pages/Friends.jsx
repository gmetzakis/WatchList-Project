import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../api/axios.js";
import { Bookmark, BookmarkCheck, Eye, CheckCheck, Heart } from "lucide-react";

const ITEMS_PER_PAGE = 12;

const GENRE_MAP = {
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
  878: "Science Fiction",
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

function getInitials(friend) {
  const source = `${friend?.first_name || ""} ${friend?.last_name || ""}`.trim() || friend?.username || "?";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function formatDateLabel(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function normalizeGenres(rawGenres) {
  function normalizeGenreValue(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;

    const numericId = Number(raw);
    if (Number.isInteger(numericId) && GENRE_MAP[numericId]) {
      return GENRE_MAP[numericId];
    }

    return raw;
  }

  if (Array.isArray(rawGenres)) {
    return rawGenres
      .map((genre) => normalizeGenreValue(genre))
      .filter(Boolean);
  }

  if (typeof rawGenres === "string") {
    const trimmed = rawGenres.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((genre) => normalizeGenreValue(genre))
          .filter(Boolean);
      }
    } catch {
      // Fallback to comma-separated parsing.
    }

    return trimmed
      .replace(/[{}\"]/g, "")
      .split(",")
      .map((genre) => normalizeGenreValue(genre))
      .filter(Boolean);
  }

  return [];
}

function MediaShelf({
  items,
  emptyText,
  myMediaStatus,
  actionPending,
  onAddWatchlist,
  onMarkWatched,
  onToggleFavorite,
  typeFilter,
  genreFilter,
  sortBy,
  searchQuery,
  page,
  setPage,
}) {
  let filtered = items;

  if (typeFilter !== "all") filtered = filtered.filter((i) => i.type === typeFilter);
  if (genreFilter !== "all") {
    filtered = filtered.filter((i) => normalizeGenres(i.genres).includes(genreFilter));
  }
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter((i) => i.title?.toLowerCase().includes(q));
  }

  if (sortBy === "rating_desc") filtered = [...filtered].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (sortBy === "rating_asc") filtered = [...filtered].sort((a, b) => (a.rating || 0) - (b.rating || 0));
  else if (sortBy === "title_asc") filtered = [...filtered].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  else if (sortBy === "title_desc") filtered = [...filtered].sort((a, b) => (b.title || "").localeCompare(a.title || ""));
  else if (sortBy === "year_desc") filtered = [...filtered].sort((a, b) => (b.release_year || 0) - (a.release_year || 0));
  else if (sortBy === "year_asc") filtered = [...filtered].sort((a, b) => (a.release_year || 0) - (b.release_year || 0));

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  if (!filtered.length) {
    return <p className="friends-empty friends-library-empty">{emptyText}</p>;
  }

  return (
    <>
      <div className="friend-library-grid">
        {paged.map((item) => {
          const key = `${item.type}-${item.tmdb_id}`;
          const myStatus = myMediaStatus[key] || {};
          const isPending = actionPending.has(key);
          const posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : null;
          const mediaLink = `/media/${item.type}/${item.tmdb_id}`;
          const watchedLabel = formatDateLabel(item.watched_at);
          const addedLabel = formatDateLabel(item.added_at);
          const isInWatchlist = myStatus.status === "watchlist";
          const isWatched = myStatus.status === "watched";
          const isFavorite = myStatus.isFavorite;

          return (
            <div key={key} className="friend-media-card">
              <div className="friend-media-poster-wrap">
                <Link to={mediaLink} className="friend-media-poster-link">
                  {posterUrl ? (
                    <img className="friend-media-poster" src={posterUrl} alt={item.title} />
                  ) : (
                    <div className="friend-media-fallback">{item.title?.slice(0, 1) || "?"}</div>
                  )}
                </Link>
                {Number.isInteger(item.rating) && <span className="friend-media-rating">{item.rating}/10</span>}
                <div className="friend-media-overlay">
                  {!isWatched && !isInWatchlist && (
                    <button className="friend-overlay-btn" title="Add to Watchlist" disabled={isPending} onClick={() => onAddWatchlist(item)}>
                      <Bookmark size={18} />
                    </button>
                  )}
                  {isInWatchlist && (
                    <button className="friend-overlay-btn active" title="In your Watchlist" disabled>
                      <BookmarkCheck size={18} />
                    </button>
                  )}
                  {!isWatched && (
                    <button className="friend-overlay-btn" title="Mark as Watched" disabled={isPending} onClick={() => onMarkWatched(item)}>
                      <Eye size={18} />
                    </button>
                  )}
                  {isWatched && (
                    <button className="friend-overlay-btn active" title="Already Watched" disabled>
                      <CheckCheck size={18} />
                    </button>
                  )}
                  {isWatched && (
                    <button
                      className={`friend-overlay-btn${isFavorite ? " favorite" : ""}`}
                      title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                      disabled={isPending}
                      onClick={() => onToggleFavorite(item)}
                    >
                      <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
                    </button>
                  )}
                </div>
              </div>

              <div className="friend-media-copy">
                <h4 className="friend-media-title">
                  <Link to={mediaLink} className="friend-media-title-link">{item.title}</Link>
                </h4>
                <p className="friend-media-meta">
                  {item.type === "movie" ? "Movie" : "Series"}
                  {item.release_year ? ` • ${item.release_year}` : ""}
                </p>
                {watchedLabel && <p className="friend-media-submeta">Watched {watchedLabel}</p>}
                {!watchedLabel && addedLabel && <p className="friend-media-submeta">Added {addedLabel}</p>}
                {item.is_favorite && <span className="friend-media-pill">Favorite</span>}
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="friend-pagination">
          <button className="friend-page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
            ‹ Prev
          </button>
          <span className="friend-page-info">{safePage} / {totalPages}</span>
          <button className="friend-page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>
            Next ›
          </button>
        </div>
      )}
    </>
  );
}

export default function FriendsPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [removingFriend, setRemovingFriend] = useState(false);
  const [friendDetailLoading, setFriendDetailLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [friendDetailError, setFriendDetailError] = useState("");
  const [searchUsername, setSearchUsername] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [activeTab, setActiveTab] = useState("friends");
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const [selectedShelf, setSelectedShelf] = useState("watched");
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [selectedFriendDetail, setSelectedFriendDetail] = useState(null);
  const [notifications, setNotifications] = useState({
    incomingPending: 0,
    acceptedUpdates: 0,
    total: 0,
  });

  // Filter / sort / pagination for the friend library
  const [friendTypeFilter, setFriendTypeFilter] = useState("all");
  const [friendGenreFilter, setFriendGenreFilter] = useState("all");
  const [friendSortBy, setFriendSortBy] = useState("default");
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [friendPage, setFriendPage] = useState(1);

  // Current user's own media status (for action buttons)
  const [myMediaStatus, setMyMediaStatus] = useState({});
  const [actionPending, setActionPending] = useState(new Set());

  const location = useLocation();
  const routeNotificationSnapshotRef = useRef(location.state?.friendNotificationSnapshot || null);

  useEffect(() => {
    loadFriends();
  }, []);

  useEffect(() => {
    function handleFriendsRefresh() {
      loadFriends();
      if (selectedFriendId) {
        loadFriendLibrary(selectedFriendId);
      }
    }

    window.addEventListener("friends:refresh", handleFriendsRefresh);
    return () => window.removeEventListener("friends:refresh", handleFriendsRefresh);
  }, [selectedFriendId]);

  useEffect(() => {
    if (friends.length === 0) {
      setSelectedFriendId(null);
      setSelectedFriendDetail(null);
      return;
    }

    const stillExists = friends.some((friend) => friend.user_id === selectedFriendId);
    if (!stillExists) {
      setSelectedFriendId(friends[0].user_id);
      setSelectedShelf("watched");
    }
  }, [friends, selectedFriendId]);

  useEffect(() => {
    if (!selectedFriendId) return;
    loadFriendLibrary(selectedFriendId);
  }, [selectedFriendId]);

  async function loadFriends() {
    setLoading(true);
    setError("");

    try {
      const res = await api.get("/friends");
      const routeNotificationSnapshot = routeNotificationSnapshotRef.current;
      const serverNotifications = res.data?.notifications || {
        incomingPending: 0,
        acceptedUpdates: 0,
        total: 0,
      };
      const nextNotifications = serverNotifications.total > 0
        ? serverNotifications
        : (routeNotificationSnapshot && Number(routeNotificationSnapshot.total) > 0
          ? {
              incomingPending: Number(routeNotificationSnapshot.incomingPending) || 0,
              acceptedUpdates: Number(routeNotificationSnapshot.acceptedUpdates) || 0,
              total: Number(routeNotificationSnapshot.total) || 0,
            }
          : serverNotifications);

      setFriends(res.data?.friends || []);
      setIncomingRequests(res.data?.incomingRequests || []);
      setOutgoingRequests(res.data?.outgoingRequests || []);
      setNotifications(nextNotifications);
      routeNotificationSnapshotRef.current = null;
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load friends");
    } finally {
      setLoading(false);
    }
  }

  async function loadFriendLibrary(friendUserId) {
    setFriendDetailLoading(true);
    setFriendDetailError("");

    try {
      const [libraryRes, watchlistRes, watchedRes] = await Promise.all([
        api.get(`/friends/${friendUserId}/library`),
        api.get("/media/watchlist"),
        api.get("/media/watched"),
      ]);

      setSelectedFriendDetail(libraryRes.data || null);

      // Build a lookup of the current user's own media status
      const statusMap = {};
      for (const item of (watchlistRes.data.items || [])) {
        statusMap[`${item.type}-${item.tmdb_id}`] = { status: "watchlist", isFavorite: false };
      }
      for (const item of (watchedRes.data.items || [])) {
        statusMap[`${item.type}-${item.tmdb_id}`] = { status: "watched", isFavorite: !!item.is_favorite };
      }
      setMyMediaStatus(statusMap);

      // Reset filters and pagination when switching to a different friend
      setFriendTypeFilter("all");
      setFriendGenreFilter("all");
      setFriendSortBy("default");
      setFriendSearchQuery("");
      setFriendPage(1);
    } catch (err) {
      setSelectedFriendDetail(null);
      setFriendDetailError(err.response?.data?.error || "Failed to load friend library");
    } finally {
      setFriendDetailLoading(false);
    }
  }

  async function handleSendRequest(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    const username = searchUsername.trim();
    if (!username) {
      setError("Enter a username to search");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/friends/requests", { username });
      setMessage(res.data?.message || "Friend request sent");
      setSearchUsername("");
      await loadFriends();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send friend request");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestResponse(requestId, action) {
    setMessage("");
    setError("");

    try {
      const res = await api.post(`/friends/requests/${requestId}/respond`, { action });
      setMessage(res.data?.message || `Request ${action}ed`);
      await loadFriends();
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${action} request`);
    }
  }

  useEffect(() => {
    async function markNotificationsRead() {
      try {
        await api.post("/friends/notifications/read");
      } catch {
        // Best-effort call. Failing this should not block the page.
      }
    }

    markNotificationsRead();
  }, []);

  async function handleRemoveFriend(friendUserId, username) {
    setMessage("");
    setError("");

    setPendingRemoval({ friendUserId, username });
  }

  function handleCloseRemoveModal() {
    if (removingFriend) return;
    setPendingRemoval(null);
  }

  async function handleConfirmRemoveFriend() {
    if (!pendingRemoval) {
      return;
    }

    const { friendUserId, username } = pendingRemoval;
    setRemovingFriend(true);

    try {
      const res = await api.delete(`/friends/${friendUserId}`);
      setMessage(res.data?.message || `${username} removed from friends`);
      setFriends((prev) => prev.filter((friend) => friend.user_id !== friendUserId));
      setPendingRemoval(null);
      if (selectedFriendId === friendUserId) {
        setSelectedFriendDetail(null);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to remove friend");
    } finally {
      setRemovingFriend(false);
    }
  }

  async function handleCancelOutgoingRequest(requestId, username) {
    setMessage("");
    setError("");

    try {
      const res = await api.delete(`/friends/requests/${requestId}`);
      setMessage(res.data?.message || `Request to ${username} cancelled`);
      setOutgoingRequests((prev) => prev.filter((request) => request.id !== requestId));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to cancel request");
    }
  }

  // ---- My own media action handlers (add friend's items to my lists) ----

  async function handleAddToWatchlist(item) {
    const key = `${item.type}-${item.tmdb_id}`;
    if (actionPending.has(key)) return;
    setActionPending((prev) => new Set([...prev, key]));
    try {
      await api.post(`/media/${item.tmdb_id}/watchlist`, { type: item.type });
      setMyMediaStatus((prev) => ({ ...prev, [key]: { status: "watchlist", isFavorite: false } }));
    } catch {
      // silent fail
    } finally {
      setActionPending((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  }

  async function handleMarkAsWatched(item) {
    const key = `${item.type}-${item.tmdb_id}`;
    if (actionPending.has(key)) return;
    setActionPending((prev) => new Set([...prev, key]));
    try {
      await api.post(`/media/${item.tmdb_id}/watched`, { type: item.type });
      setMyMediaStatus((prev) => ({
        ...prev,
        [key]: { status: "watched", isFavorite: prev[key]?.isFavorite || false },
      }));
    } catch {
      // silent fail
    } finally {
      setActionPending((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  }

  async function handleToggleFavorite(item) {
    const key = `${item.type}-${item.tmdb_id}`;
    const currentStatus = myMediaStatus[key];
    if (actionPending.has(key) || currentStatus?.status !== "watched") return;
    setActionPending((prev) => new Set([...prev, key]));
    try {
      if (currentStatus.isFavorite) {
        await api.delete(`/media/${item.tmdb_id}/favorite`, { data: { type: item.type } });
        setMyMediaStatus((prev) => ({ ...prev, [key]: { ...prev[key], isFavorite: false } }));
      } else {
        await api.post(`/media/${item.tmdb_id}/favorite`, { type: item.type });
        setMyMediaStatus((prev) => ({ ...prev, [key]: { ...prev[key], isFavorite: true } }));
      }
    } catch {
      // silent fail
    } finally {
      setActionPending((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  }

  if (loading) {
    return <div className="friends-shell">Loading friends...</div>;
  }

  const selectedFriend = selectedFriendDetail?.friend || null;
  const libraryStats = selectedFriendDetail?.stats || {
    watchlistCount: 0,
    watchedCount: 0,
    favoritesCount: 0,
  };
  const libraryCollections = selectedFriendDetail?.library || {
    watched: [],
    favorites: [],
    watchlist: [],
  };
  const shelfConfig = [
    { key: "watched", label: "Watched", items: libraryCollections.watched, emptyText: "No watched titles yet." },
    { key: "favorites", label: "Favorites", items: libraryCollections.favorites, emptyText: "No favorites yet." },
    { key: "watchlist", label: "Watchlist", items: libraryCollections.watchlist, emptyText: "Watchlist is empty." },
  ];
  const activeShelf = shelfConfig.find((shelf) => shelf.key === selectedShelf) || shelfConfig[0];
  const effectiveSortBy =
    selectedShelf === "watchlist" && (friendSortBy === "rating_desc" || friendSortBy === "rating_asc")
      ? "default"
      : friendSortBy;
  const availableShelfGenres = Array.from(
    new Set(activeShelf.items.flatMap((item) => normalizeGenres(item.genres)))
  ).sort((left, right) => left.localeCompare(right));

  return (
    <div className="friends-shell">
      <header className="friends-hero">
        <div>
          <p className="friends-kicker">Friends</p>
          <h1 className="friends-title">Your circle, front and center.</h1>
          <p className="friends-subtitle">
            Browse your friends first, dive into their libraries, and keep requests tucked away until you need them.
          </p>
        </div>

        <div className="friends-summary-grid">
          <article className="friends-summary-card">
            <span className="friends-summary-label">Friends</span>
            <strong className="friends-summary-value">{friends.length}</strong>
          </article>
          <article className="friends-summary-card">
            <span className="friends-summary-label">Incoming</span>
            <strong className="friends-summary-value">{incomingRequests.length}</strong>
          </article>
          <article className="friends-summary-card">
            <span className="friends-summary-label">Outgoing</span>
            <strong className="friends-summary-value">{outgoingRequests.length}</strong>
          </article>
          <article className="friends-summary-card accent">
            <span className="friends-summary-label">Unread</span>
            <strong className="friends-summary-value">{notifications.total}</strong>
          </article>
        </div>
      </header>

      {error && <p className="friends-message error">{error}</p>}
      {message && <p className="friends-message success">{message}</p>}

      {notifications.total > 0 && (
        <section className="friends-notifications-panel">
          <h2 className="friends-section-title">New Notifications</h2>
          {notifications.incomingPending > 0 && (
            <p className="friends-notification-line">
              You have {notifications.incomingPending} new friend request{notifications.incomingPending > 1 ? "s" : ""}.
            </p>
          )}
          {notifications.acceptedUpdates > 0 && (
            <p className="friends-notification-line">
              {notifications.acceptedUpdates} of your friend request{notifications.acceptedUpdates > 1 ? "s have" : " has"} been accepted.
            </p>
          )}
        </section>
      )}

      <div className="friends-tabbar">
        <button
          type="button"
          className={`friends-top-tab ${activeTab === "friends" ? "active" : ""}`}
          onClick={() => setActiveTab("friends")}
        >
          Friend Libraries
        </button>
        <button
          type="button"
          className={`friends-top-tab ${activeTab === "manage" ? "active" : ""}`}
          onClick={() => setActiveTab("manage")}
        >
          Requests & Add
        </button>
      </div>

      {activeTab === "friends" ? (
        <div className="friends-explorer">
          <aside className="friends-rail">
            <div className="friends-rail-head">
              <div>
                <p className="friends-panel-kicker">Your Friends</p>
                <h2 className="friends-section-title">Choose someone to explore</h2>
              </div>
              <span className="friends-count-pill">{friends.length}</span>
            </div>

            {friends.length === 0 ? (
              <div className="friends-empty-card">
                <p className="friends-empty">You do not have any friends yet.</p>
                <button type="button" className="friends-secondary-btn" onClick={() => setActiveTab("manage")}>Go to Requests & Add</button>
              </div>
            ) : (
              <div className="friends-rail-list">
                {friends.map((friend) => {
                  const isActive = friend.user_id === selectedFriendId;

                  return (
                    <button
                      key={friend.user_id}
                      type="button"
                      className={`friends-rail-item ${isActive ? "active" : ""}`}
                      onClick={() => {
                        setSelectedFriendId(friend.user_id);
                        setSelectedShelf("watched");
                      }}
                    >
                      <span className="friends-avatar-badge">{getInitials(friend)}</span>
                      <span className="friends-rail-copy">
                        <span className="friends-rail-title">{friend.username}</span>
                        <span className="friends-rail-meta">{friend.first_name} {friend.last_name}</span>
                        <span className="friends-rail-meta">{friend.country || "No country set"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="friends-detail-panel">
            {!selectedFriendId && !friends.length && (
              <div className="friends-placeholder-panel">
                <h2 className="friends-section-title">No friend selected</h2>
                <p className="friends-empty">Once you add friends, their libraries will show up here.</p>
              </div>
            )}

            {selectedFriendId && friendDetailLoading && (
              <div className="friends-placeholder-panel">
                <h2 className="friends-section-title">Loading library...</h2>
              </div>
            )}

            {selectedFriendId && !friendDetailLoading && friendDetailError && (
              <div className="friends-placeholder-panel">
                <h2 className="friends-section-title">Could not load friend</h2>
                <p className="friends-message error">{friendDetailError}</p>
              </div>
            )}

            {selectedFriend && !friendDetailLoading && !friendDetailError && (
              <>
                <div className="friend-profile-hero">
                  <div className="friend-profile-head">
                    {selectedFriend.avatarData ? (
                      <img className="friend-profile-avatar" src={selectedFriend.avatarData} alt={selectedFriend.username} />
                    ) : (
                      <div className="friend-profile-avatar fallback">{getInitials(selectedFriend)}</div>
                    )}

                    <div className="friend-profile-copy">
                      <p className="friends-panel-kicker">Friend Spotlight</p>
                      <h2 className="friend-profile-name">{selectedFriend.first_name} {selectedFriend.last_name}</h2>
                      <p className="friend-profile-handle">@{selectedFriend.username}</p>
                      <p className="friend-profile-meta">
                        {selectedFriend.country || "No country set"}
                        {selectedFriend.year_of_birth ? ` • Born ${selectedFriend.year_of_birth}` : ""}
                      </p>
                    </div>
                  </div>

                  <button
                    className="friends-danger-btn"
                    type="button"
                    onClick={() => handleRemoveFriend(selectedFriend.user_id, selectedFriend.username)}
                  >
                    Remove Friend
                  </button>
                </div>

                <div className="friend-stats-grid">
                  <button
                    type="button"
                    className="friend-stat-card friend-stat-card--link"
                    onClick={() => { setSelectedShelf("watched"); setFriendTypeFilter("movie"); setFriendGenreFilter("all"); setFriendPage(1); }}
                  >
                    <span className="friend-stat-value">{selectedFriend.movies_watched || 0}</span>
                    <span className="friend-stat-label">Movies watched</span>
                  </button>
                  <button
                    type="button"
                    className="friend-stat-card friend-stat-card--link"
                    onClick={() => { setSelectedShelf("watched"); setFriendTypeFilter("series"); setFriendGenreFilter("all"); setFriendPage(1); }}
                  >
                    <span className="friend-stat-value">{selectedFriend.series_watched || 0}</span>
                    <span className="friend-stat-label">Series watched</span>
                  </button>
                  <button
                    type="button"
                    className="friend-stat-card friend-stat-card--link"
                    onClick={() => { setSelectedShelf("watchlist"); setFriendTypeFilter("all"); setFriendGenreFilter("all"); setFriendPage(1); }}
                  >
                    <span className="friend-stat-value">{libraryStats.watchlistCount}</span>
                    <span className="friend-stat-label">In watchlist</span>
                  </button>
                  <button
                    type="button"
                    className="friend-stat-card friend-stat-card--link"
                    onClick={() => { setSelectedShelf("favorites"); setFriendTypeFilter("all"); setFriendGenreFilter("all"); setFriendPage(1); }}
                  >
                    <span className="friend-stat-value">{libraryStats.favoritesCount}</span>
                    <span className="friend-stat-label">Favorites</span>
                  </button>
                </div>

                <div className="friend-library-tabs">
                  {shelfConfig.map((shelf) => (
                    <button
                      key={shelf.key}
                      type="button"
                      className={`friend-library-tab ${selectedShelf === shelf.key ? "active" : ""}`}
                      onClick={() => {
                        setSelectedShelf(shelf.key);
                        setFriendGenreFilter("all");
                        setFriendPage(1);
                      }}
                    >
                      {shelf.label}
                      <span>{shelf.items.length}</span>
                    </button>
                  ))}
                </div>

                <div className="friend-library-section">
                  <div className="friend-library-head">
                    <div>
                      <p className="friends-panel-kicker">Library</p>
                      <h3 className="friends-section-title">{activeShelf.label}</h3>
                    </div>
                    <span className="friends-count-pill">{activeShelf.items.length}</span>
                  </div>

                  <div className="friend-filter-bar">
                    <input
                      type="text"
                      className="friend-filter-search"
                      placeholder="Search titles…"
                      value={friendSearchQuery}
                      onChange={(e) => { setFriendSearchQuery(e.target.value); setFriendPage(1); }}
                    />
                    <select
                      className="friend-filter-select"
                      value={friendTypeFilter}
                      onChange={(e) => { setFriendTypeFilter(e.target.value); setFriendPage(1); }}
                    >
                      <option value="all">All</option>
                      <option value="movie">Movies</option>
                      <option value="series">Series</option>
                    </select>
                    <select
                      className="friend-filter-select"
                      value={friendGenreFilter}
                      onChange={(e) => { setFriendGenreFilter(e.target.value); setFriendPage(1); }}
                    >
                      <option value="all">All genres</option>
                      {availableShelfGenres.map((genre) => (
                        <option key={genre} value={genre}>{genre}</option>
                      ))}
                    </select>
                    <select
                      className="friend-filter-select"
                      value={effectiveSortBy}
                      onChange={(e) => { setFriendSortBy(e.target.value); setFriendPage(1); }}
                    >
                      <option value="default">Default</option>
                      <option value="title_asc">Title A–Z</option>
                      <option value="title_desc">Title Z–A</option>
                      {selectedShelf !== "watchlist" && <option value="rating_desc">Rating ↓</option>}
                      {selectedShelf !== "watchlist" && <option value="rating_asc">Rating ↑</option>}
                      <option value="year_asc">Year ↓</option>
                      <option value="year_desc">Year ↑</option>
                    </select>
                  </div>

                  <MediaShelf
                    items={activeShelf.items}
                    emptyText={activeShelf.emptyText}
                    myMediaStatus={myMediaStatus}
                    actionPending={actionPending}
                    onAddWatchlist={handleAddToWatchlist}
                    onMarkWatched={handleMarkAsWatched}
                    onToggleFavorite={handleToggleFavorite}
                    typeFilter={friendTypeFilter}
                    genreFilter={friendGenreFilter}
                    sortBy={effectiveSortBy}
                    searchQuery={friendSearchQuery}
                    page={friendPage}
                    setPage={setFriendPage}
                  />
                </div>
              </>
            )}
          </section>
        </div>
      ) : (
        <div className="friends-manage-grid">
          <section className="friends-manage-card">
            <p className="friends-panel-kicker">Add Friend</p>
            <h2 className="friends-section-title">Search by exact username</h2>
            <form className="friends-search-form" onSubmit={handleSendRequest}>
              <input
                type="text"
                className="friends-search-input"
                placeholder="Search by exact username"
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
              />
              <button className="friends-primary-btn" type="submit" disabled={submitting}>
                {submitting ? "Sending..." : "Send Request"}
              </button>
            </form>
          </section>

          <section className="friends-manage-card">
            <div className="friends-manage-head">
              <div>
                <p className="friends-panel-kicker">Incoming</p>
                <h2 className="friends-section-title">Requests waiting on you</h2>
              </div>
              <span className="friends-count-pill">{incomingRequests.length}</span>
            </div>
            {incomingRequests.length === 0 ? (
              <p className="friends-empty">No pending incoming requests.</p>
            ) : (
              <div className="friends-list compact-list">
                {incomingRequests.map((request) => (
                  <article key={request.id} className="friend-card manage-card">
                    <div>
                      <h3 className="friend-name">{request.username}</h3>
                      <p className="friend-meta">{request.first_name} {request.last_name}</p>
                      <p className="friend-meta">{request.country || "No country set"}</p>
                    </div>
                    <div className="friend-actions">
                      <button className="friends-primary-btn" type="button" onClick={() => handleRequestResponse(request.id, "accept")}>Accept</button>
                      <button className="friends-secondary-btn" type="button" onClick={() => handleRequestResponse(request.id, "decline")}>Decline</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="friends-manage-card wide">
            <div className="friends-manage-head">
              <div>
                <p className="friends-panel-kicker">Outgoing</p>
                <h2 className="friends-section-title">Requests you already sent</h2>
              </div>
              <span className="friends-count-pill">{outgoingRequests.length}</span>
            </div>
            {outgoingRequests.length === 0 ? (
              <p className="friends-empty">No pending outgoing requests.</p>
            ) : (
              <div className="friends-list compact-list">
                {outgoingRequests.map((request) => (
                  <article key={request.id} className="friend-card manage-card">
                    <div>
                      <h3 className="friend-name">{request.username}</h3>
                      <p className="friend-meta">Waiting for response</p>
                    </div>
                    <div className="friend-actions">
                      <button
                        className="friends-secondary-btn"
                        type="button"
                        onClick={() => handleCancelOutgoingRequest(request.id, request.username)}
                      >
                        Cancel Request
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {pendingRemoval && (
        <div className="friends-modal-overlay" onClick={handleCloseRemoveModal}>
          <div
            className="friends-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-friend-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="remove-friend-modal-title" className="friends-modal-title">Remove Friend?</h3>
            <p className="friends-modal-text">
              Are you sure you want to remove {pendingRemoval.username} from your friends?
            </p>
            <div className="friends-modal-actions">
              <button
                className="friends-secondary-btn"
                type="button"
                onClick={handleCloseRemoveModal}
                disabled={removingFriend}
              >
                Cancel
              </button>
              <button
                className="friends-danger-btn"
                type="button"
                onClick={handleConfirmRemoveFriend}
                disabled={removingFriend}
              >
                {removingFriend ? "Removing..." : "Remove Friend"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
