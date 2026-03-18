import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../api/axios.js";

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

function MediaShelf({ items, emptyText }) {
  if (!items.length) {
    return <p className="friends-empty friends-library-empty">{emptyText}</p>;
  }

  return (
    <div className="friend-library-grid">
      {items.map((item) => {
        const posterUrl = item.poster_path
          ? `https://image.tmdb.org/t/p/w300${item.poster_path}`
          : null;
        const mediaLink = `/media/${item.type}/${item.tmdb_id}`;
        const watchedLabel = formatDateLabel(item.watched_at);
        const addedLabel = formatDateLabel(item.added_at);

        return (
          <Link key={`${item.type}-${item.tmdb_id}`} to={mediaLink} className="friend-media-card">
            <div className="friend-media-poster-wrap">
              {posterUrl ? (
                <img className="friend-media-poster" src={posterUrl} alt={item.title} />
              ) : (
                <div className="friend-media-fallback">{item.title?.slice(0, 1) || "?"}</div>
              )}
              {Number.isInteger(item.rating) && <span className="friend-media-rating">{item.rating}/10</span>}
            </div>

            <div className="friend-media-copy">
              <h4 className="friend-media-title">{item.title}</h4>
              <p className="friend-media-meta">{item.type === "movie" ? "Movie" : "Series"}{item.release_year ? ` • ${item.release_year}` : ""}</p>
              {watchedLabel && <p className="friend-media-submeta">Watched {watchedLabel}</p>}
              {!watchedLabel && addedLabel && <p className="friend-media-submeta">Added {addedLabel}</p>}
              {item.is_favorite && <span className="friend-media-pill">Favorite</span>}
            </div>
          </Link>
        );
      })}
    </div>
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
      const res = await api.get(`/friends/${friendUserId}/library`);
      setSelectedFriendDetail(res.data || null);
    } catch (err) {
      setFriendDetail(null);
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

  if (loading) {
    return <div className="friends-shell">Loading friends...</div>;
  }

  const selectedFriend = selectedFriendDetail?.friend || null;
  const libraryStats = selectedFriendDetail?.stats || {
    watchlistCount: 0,
    watchedCount: 0,
    favoritesCount: 0,
    ratedCount: 0,
  };
  const libraryCollections = selectedFriendDetail?.library || {
    watched: [],
    favorites: [],
    watchlist: [],
    rated: [],
  };
  const shelfConfig = [
    { key: "watched", label: "Watched", items: libraryCollections.watched, emptyText: "No watched titles yet." },
    { key: "favorites", label: "Favorites", items: libraryCollections.favorites, emptyText: "No favorites yet." },
    { key: "watchlist", label: "Watchlist", items: libraryCollections.watchlist, emptyText: "Watchlist is empty." },
    { key: "rated", label: "Rated", items: libraryCollections.rated, emptyText: "No rated titles yet." },
  ];
  const activeShelf = shelfConfig.find((shelf) => shelf.key === selectedShelf) || shelfConfig[0];

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
                  <article className="friend-stat-card">
                    <span className="friend-stat-value">{selectedFriend.movies_watched || 0}</span>
                    <span className="friend-stat-label">Movies watched</span>
                  </article>
                  <article className="friend-stat-card">
                    <span className="friend-stat-value">{selectedFriend.series_watched || 0}</span>
                    <span className="friend-stat-label">Series watched</span>
                  </article>
                  <article className="friend-stat-card">
                    <span className="friend-stat-value">{libraryStats.watchlistCount}</span>
                    <span className="friend-stat-label">In watchlist</span>
                  </article>
                  <article className="friend-stat-card">
                    <span className="friend-stat-value">{libraryStats.favoritesCount}</span>
                    <span className="friend-stat-label">Favorites</span>
                  </article>
                </div>

                <div className="friend-library-tabs">
                  {shelfConfig.map((shelf) => (
                    <button
                      key={shelf.key}
                      type="button"
                      className={`friend-library-tab ${selectedShelf === shelf.key ? "active" : ""}`}
                      onClick={() => setSelectedShelf(shelf.key)}
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

                  <MediaShelf items={activeShelf.items} emptyText={activeShelf.emptyText} />
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
