import { useEffect, useState } from "react";
import api from "../api/axios.js";

export default function FriendsPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [searchUsername, setSearchUsername] = useState("");
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [notifications, setNotifications] = useState({
    incomingPending: 0,
    acceptedUpdates: 0,
    total: 0,
  });

  useEffect(() => {
    loadFriends();
  }, []);

  async function loadFriends() {
    setLoading(true);
    setError("");

    try {
      const res = await api.get("/friends");
      setFriends(res.data?.friends || []);
      setIncomingRequests(res.data?.incomingRequests || []);
      setOutgoingRequests(res.data?.outgoingRequests || []);
      setNotifications(res.data?.notifications || {
        incomingPending: 0,
        acceptedUpdates: 0,
        total: 0,
      });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load friends");
    } finally {
      setLoading(false);
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
        setNotifications({ incomingPending: 0, acceptedUpdates: 0, total: 0 });
      } catch {
        // Best-effort call. Failing this should not block the page.
      }
    }

    markNotificationsRead();
  }, []);

  async function handleRemoveFriend(friendUserId, username) {
    setMessage("");
    setError("");

    try {
      const res = await api.delete(`/friends/${friendUserId}`);
      setMessage(res.data?.message || `${username} removed from friends`);
      setFriends((prev) => prev.filter((friend) => friend.user_id !== friendUserId));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to remove friend");
    }
  }

  if (loading) {
    return <div className="friends-shell">Loading friends...</div>;
  }

  return (
    <div className="friends-shell">
      <h1 className="friends-title">Friends</h1>

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

      <section className="friends-section">
        <h2 className="friends-section-title">Add Friend</h2>
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

      <section className="friends-section">
        <h2 className="friends-section-title">Incoming Requests</h2>
        {incomingRequests.length === 0 ? (
          <p className="friends-empty">No pending incoming requests.</p>
        ) : (
          <div className="friends-list">
            {incomingRequests.map((request) => (
              <article key={request.id} className="friend-card">
                <div>
                  <h3 className="friend-name">{request.username}</h3>
                  <p className="friend-meta">{request.first_name} {request.last_name}</p>
                  <p className="friend-meta">{request.country || "No country set"}</p>
                </div>
                <div className="friend-actions">
                  <button className="friends-primary-btn" type="button" onClick={() => handleRequestResponse(request.id, "accept")}>
                    Accept
                  </button>
                  <button className="friends-secondary-btn" type="button" onClick={() => handleRequestResponse(request.id, "decline")}>
                    Decline
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="friends-section">
        <h2 className="friends-section-title">Outgoing Requests</h2>
        {outgoingRequests.length === 0 ? (
          <p className="friends-empty">No pending outgoing requests.</p>
        ) : (
          <div className="friends-list">
            {outgoingRequests.map((request) => (
              <article key={request.id} className="friend-card compact">
                <div>
                  <h3 className="friend-name">{request.username}</h3>
                  <p className="friend-meta">Waiting for response</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="friends-section">
        <h2 className="friends-section-title">Your Friends</h2>
        {friends.length === 0 ? (
          <p className="friends-empty">You do not have any friends yet.</p>
        ) : (
          <div className="friends-list">
            {friends.map((friend) => (
              <article key={friend.user_id} className="friend-card">
                <div>
                  <h3 className="friend-name">{friend.username}</h3>
                  <p className="friend-meta">{friend.first_name} {friend.last_name}</p>
                  <p className="friend-meta">{friend.country || "No country set"}</p>
                </div>
                <div className="friend-actions">
                  <button
                    className="friends-danger-btn"
                    type="button"
                    onClick={() => handleRemoveFriend(friend.user_id, friend.username)}
                  >
                    Remove Friend
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
