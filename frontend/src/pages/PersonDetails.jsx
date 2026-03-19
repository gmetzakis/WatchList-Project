import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Heart, Eye, EyeOff, BookmarkPlus, BookmarkMinus } from "lucide-react";
import api from "../api/axios";

function getInitialPageSize() {
  if (typeof window !== "undefined" && window.innerWidth <= 768) {
    return 12;
  }

  return 24;
}

export default function PersonDetailsPage() {
  const { personId } = useParams();
  const navigate = useNavigate();
  const pageSize = getInitialPageSize();

  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visibleActing, setVisibleActing] = useState(pageSize);
  const [visibleDirecting, setVisibleDirecting] = useState(pageSize);
  const [creditStatus, setCreditStatus] = useState({});

  useEffect(() => {
    async function loadPerson() {
      try {
        const res = await api.get(`/tmdb/person/${personId}`);
        setPerson(res.data);
        setVisibleActing(pageSize);
        setVisibleDirecting(pageSize);
      } catch (err) {
        console.error("Person details error:", err);
        setPerson(null);
      } finally {
        setLoading(false);
      }
    }

    loadPerson();
  }, [personId, pageSize]);

  useEffect(() => {
    async function hydrateVisibleCreditStatus() {
      if (!person) {
        setCreditStatus({});
        return;
      }

      const visibleActingItems = (person.acting_credits || []).slice(0, visibleActing);
      const visibleDirectingItems = (person.directing_credits || []).slice(0, visibleDirecting);
      const visibleItems = [...visibleActingItems, ...visibleDirectingItems];
      if (visibleItems.length === 0) {
        setCreditStatus({});
        return;
      }

      const pairs = await Promise.all(
        visibleItems.map(async (item) => {
          const normalizedType = item.type === "tv" ? "series" : "movie";
          const key = `${normalizedType}-${item.id}`;

          try {
            const res = await api.get(`/media/${normalizedType}/${item.id}/status`);
            return [
              key,
              {
                status: res.data.status,
                rating: res.data.rating || null,
                is_favorite: res.data.favorite || false,
              },
            ];
          } catch {
            return [
              key,
              {
                status: null,
                rating: null,
                is_favorite: false,
              },
            ];
          }
        })
      );

      setCreditStatus((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    }

    hydrateVisibleCreditStatus();
  }, [person, visibleActing, visibleDirecting]);

  if (loading) return <div className="page-container">Loading person...</div>;
  if (!person) return <div className="page-container">Person not found</div>;

  const isDirectorFirst = (person.known_for_department || "").toLowerCase() === "directing";
  const sectionOrder = isDirectorFirst
    ? ["directing", "acting"]
    : ["acting", "directing"];

  function creditKey(item) {
    const normalizedType = item.type === "tv" ? "series" : "movie";
    return `${normalizedType}-${item.id}`;
  }

  function updateCreditState(item, updates) {
    const key = creditKey(item);
    setCreditStatus((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || { status: null, rating: null, is_favorite: false }), ...updates },
    }));
  }

  function stopCardNavigation(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function addCreditToWatchlist(item) {
    const normalizedType = item.type === "tv" ? "series" : "movie";
    const details = await api.get(`/tmdb/details/${normalizedType}/${item.id}`);
    const ids = new Set((details.data?.genres || []).map((g) => String(g.id)));
    await api.post(`/media/${item.id}/watchlist`, { type: normalizedType, genres: [...ids] });
    updateCreditState(item, { status: "watchlist" });
  }

  async function removeCreditFromWatchlist(item) {
    const normalizedType = item.type === "tv" ? "series" : "movie";
    await api.delete(`/media/${item.id}/watchlist`, { data: { type: normalizedType } });
    updateCreditState(item, { status: null });
  }

  async function markCreditAsWatched(item) {
    const normalizedType = item.type === "tv" ? "series" : "movie";
    const details = await api.get(`/tmdb/details/${normalizedType}/${item.id}`);
    const ids = new Set((details.data?.genres || []).map((g) => String(g.id)));
    await api.post(`/media/${item.id}/watched`, { type: normalizedType, genres: [...ids] });
    updateCreditState(item, { status: "watched" });
  }

  async function removeCreditFromWatched(item) {
    const normalizedType = item.type === "tv" ? "series" : "movie";
    await api.delete(`/media/${item.id}/watched`, { data: { type: normalizedType } });
    updateCreditState(item, { status: null, rating: null });
  }

  async function moveCreditToWatched(item) {
    const normalizedType = item.type === "tv" ? "series" : "movie";
    await api.post(`/media/${item.id}/watchlist-to-watched`, { type: normalizedType });
    updateCreditState(item, { status: "watched" });
  }

  async function favoriteCredit(item) {
    const normalizedType = item.type === "tv" ? "series" : "movie";
    await api.post(`/media/${item.id}/favorite`, { type: normalizedType });
    updateCreditState(item, { is_favorite: true });
  }

  async function unfavoriteCredit(item) {
    const normalizedType = item.type === "tv" ? "series" : "movie";
    await api.delete(`/media/${item.id}/favorite`, { data: { type: normalizedType } });
    updateCreditState(item, { is_favorite: false });
  }

  async function rateCredit(item, value) {
    const normalizedType = item.type === "tv" ? "series" : "movie";
    await api.post(`/media/${item.id}/rating`, { type: normalizedType, rating: value });
    updateCreditState(item, { rating: value });
  }

  function renderCreditsSection(sectionType) {
    const isActing = sectionType === "acting";
    const title = isActing ? "Acting Credits" : "Directing Credits";
    const credits = isActing ? (person.acting_credits || []) : (person.directing_credits || []);
    const visibleCount = isActing ? visibleActing : visibleDirecting;
    const shownItems = credits.slice(0, visibleCount);
    const hasMore = credits.length > visibleCount;

    return (
      <div key={sectionType} className="person-credits-section">
        <h2 className="details-section-title">{title}</h2>
        <div className="media-grid">
          {shownItems.map((item) => (
            <div
              key={`${sectionType}-${item.type}-${item.id}-${item.job || item.character || "credit"}`}
              className="media-card"
            >
              <Link
                to={`/media/${item.type === "tv" ? "series" : item.type}/${item.id}`}
                className="media-image-wrapper"
              >
                <img
                  src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
                  alt={item.title}
                  className="media-card-img"
                />

                <div className="hover-controls">
                  <div className="hover-title">
                    <span className="hover-title-text">{item.title}</span>
                    <span className="hover-year-text">
                      {item.release_year || "-"}
                      {isActing
                        ? (item.character ? ` • ${item.character}` : "")
                        : (item.job ? ` • ${item.job}` : "")}
                    </span>

                    {creditStatus[creditKey(item)]?.status === "watched" && (
                      <div className="rating-inline">
                        {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                          <span
                            key={n}
                            className={creditStatus[creditKey(item)]?.rating >= n ? "star active" : "star"}
                            onClick={(e) => {
                              stopCardNavigation(e);
                              rateCredit(item, n);
                            }}
                          >
                            ★
                          </span>
                        ))}
                        {creditStatus[creditKey(item)]?.rating && (
                          <span className="rating-label">{creditStatus[creditKey(item)]?.rating}/10</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="control-icons">
                    {creditStatus[creditKey(item)]?.status === null && (
                      <>
                        <span
                          className="watched-icon"
                          onClick={(e) => {
                            stopCardNavigation(e);
                            addCreditToWatchlist(item);
                          }}
                          title="Add to Watchlist"
                        >
                          <BookmarkPlus size={32} />
                        </span>
                        <span
                          className="watched-icon"
                          onClick={(e) => {
                            stopCardNavigation(e);
                            markCreditAsWatched(item);
                          }}
                          title="Mark as Watched"
                        >
                          <Eye size={32} />
                        </span>
                      </>
                    )}

                    {creditStatus[creditKey(item)]?.status === "watchlist" && (
                      <>
                        <span
                          className="watched-icon"
                          onClick={(e) => {
                            stopCardNavigation(e);
                            removeCreditFromWatchlist(item);
                          }}
                          title="Remove from Watchlist"
                        >
                          <BookmarkMinus size={32} />
                        </span>
                        <span
                          className="watched-icon"
                          onClick={(e) => {
                            stopCardNavigation(e);
                            moveCreditToWatched(item);
                          }}
                          title="Move to Watched"
                        >
                          <Eye size={32} />
                        </span>
                      </>
                    )}

                    {creditStatus[creditKey(item)]?.status === "watched" && (
                      <>
                        <span
                          className={`favorite-icon ${creditStatus[creditKey(item)]?.is_favorite ? "active" : ""}`}
                          onClick={(e) => {
                            stopCardNavigation(e);
                            if (creditStatus[creditKey(item)]?.is_favorite) {
                              unfavoriteCredit(item);
                            } else {
                              favoriteCredit(item);
                            }
                          }}
                          title="Favorite"
                        >
                          <Heart size={32} />
                        </span>
                        <span
                          className="watched-icon active"
                          onClick={(e) => {
                            stopCardNavigation(e);
                            removeCreditFromWatched(item);
                          }}
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

        {hasMore && (
          <button
            type="button"
            className="person-load-more-btn"
            onClick={() => {
              if (isActing) {
                setVisibleActing((prev) => prev + pageSize);
              } else {
                setVisibleDirecting((prev) => prev + pageSize);
              }
            }}
          >
            Load more ({credits.length - visibleCount} remaining)
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="person-details-container">
      <button className="details-back" onClick={() => navigate(-1)}>
        {"<- Back"}
      </button>

      <div className="person-hero">
        <img
          src={person.profile_path ? `https://image.tmdb.org/t/p/w500${person.profile_path}` : "https://via.placeholder.com/400x600?text=No+Image"}
          alt={person.name}
          className="person-profile-img"
        />

        <div className="person-bio">
          <h1 className="details-title">{person.name}</h1>
          <p className="details-meta">Department: {person.known_for_department || "Unknown"}</p>
          {person.birthday && <p className="details-meta">Born: {person.birthday}</p>}
          {person.place_of_birth && <p className="details-meta">From: {person.place_of_birth}</p>}
          {person.deathday && <p className="details-meta">Died: {person.deathday}</p>}

          <p className="details-overview person-biography-text">
            {person.biography?.trim() || "No biography available."}
          </p>
        </div>
      </div>

      {sectionOrder.map((sectionType) => renderCreditsSection(sectionType))}
    </div>
  );
}
