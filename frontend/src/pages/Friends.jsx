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

  if (loading) {
    return <div className="friends-shell">Loading friends...</div>;
  }

  return (
    <div className="friends-shell">
      <h1 className="friends-title">Friends</h1>

      {error && <p className="friends-message error">{error}</p>}
      {message && <p className="friends-message success">{message}</p>}

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
              <article key={friend.user_id} className="friend-card compact">
                <div>
                  <h3 className="friend-name">{friend.username}</h3>
                  <p className="friend-meta">{friend.first_name} {friend.last_name}</p>
                  <p className="friend-meta">{friend.country || "No country set"}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
