import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Heart, Eye, EyeOff, BookmarkPlus, BookmarkMinus, X } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import api from "../api/axios";
import "../styles/media-details.css";
import "../styles/media-card.css";
import "../styles/rating.css";
import "../styles/embla-carousel.css";

function EmblaCarousel({ items, renderCard, itemKey }) {
  const [autoplayEnabled, setAutoplayEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return !window.matchMedia("(max-width: 760px)").matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const handleViewportChange = (event) => {
      setAutoplayEnabled(!event.matches);
    };

    setAutoplayEnabled(!mediaQuery.matches);
    mediaQuery.addEventListener("change", handleViewportChange);

    return () => {
      mediaQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

  const plugins = useMemo(
    () => autoplayEnabled
      ? [Autoplay({ delay: 4000, stopOnInteraction: true, stopOnMouseEnter: true })]
      : [],
    [autoplayEnabled]
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: false,
      align: "start",
      slidesToScroll: 2,
      breakpoints: {
        "(min-width: 768px)": { slidesToScroll: 3 },
        "(min-width: 1024px)": { slidesToScroll: 4 },
      },
    },
    plugins
  );

  return (
    <div className="embla-carousel">
      <button className="embla-arrow left" onClick={() => emblaApi?.scrollPrev()}>
        ‹
      </button>

      <div className="embla-viewport" ref={emblaRef}>
        <div className="embla-container">
          {items.map((item) => (
            <div key={itemKey(item)} className="embla-slide">
              {renderCard(item)}
            </div>
          ))}
        </div>
      </div>

      <button className="embla-arrow right" onClick={() => emblaApi?.scrollNext()}>
        ›
      </button>
    </div>
  );
}

export default function MediaDetails() {
  const { type, tmdbId } = useParams();
  const navigate = useNavigate();

  const [media, setMedia] = useState(null);
  const [status, setStatus] = useState(null);
  const [rating, setRating] = useState(null); // ⭐ NEW
  const [loading, setLoading] = useState(true);
  const [recommendationStatus, setRecommendationStatus] = useState({});
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 760px)").matches;
  });
  const [expandedCardKey, setExpandedCardKey] = useState(null);

  const trailerKey = media?.trailer?.site === "YouTube" ? media?.trailer?.key : null;
  const director = media?.credits?.crew?.find((member) => {
    if (!member?.job) return false;
    return member.job.toLowerCase().includes("director");
  });

  useEffect(() => {
    async function load() {
      setLoading(true);
      setMedia(null);

      try {
        const details = await api.get(`/tmdb/details/${type}/${tmdbId}`);
        setMedia(details.data);
        window.scrollTo(0, 0);

        const statusRes = await api.get(`/media/${type}/${tmdbId}/status`);
        setStatus(statusRes.data.status);
        setRating(statusRes.data.rating || null); // ⭐ NEW
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tmdbId, type]);

  useEffect(() => {
    async function hydrateRecommendationStatus() {
      const recommendations = media?.recommendations?.filter((rec) => rec.poster_path) || [];
      if (recommendations.length === 0) {
        setRecommendationStatus({});
        return;
      }

      const normalizedType = media?.type === "series" ? "series" : "movie";

      const pairs = await Promise.all(
        recommendations.map(async (rec) => {
          try {
            const res = await api.get(`/media/${normalizedType}/${rec.id}/status`);
            return [
              `${normalizedType}-${rec.id}`,
              {
                status: res.data.status,
                rating: res.data.rating || null,
                is_favorite: res.data.favorite || false,
              },
            ];
          } catch {
            return [
              `${normalizedType}-${rec.id}`,
              {
                status: null,
                rating: null,
                is_favorite: false,
              },
            ];
          }
        })
      );

      setRecommendationStatus(Object.fromEntries(pairs));
    }

    hydrateRecommendationStatus();
  }, [media]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const handleViewportChange = (event) => {
      setIsMobileView(event.matches);
      if (!event.matches) {
        setExpandedCardKey(null);
      }
    };

    setIsMobileView(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleViewportChange);

    return () => {
      mediaQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

  useEffect(() => {
    setExpandedCardKey(null);
  }, [tmdbId, type]);

  function recommendationKey(recId) {
    const normalizedType = media?.type === "series" ? "series" : "movie";
    return `${normalizedType}-${recId}`;
  }

  function updateRecommendationState(recId, updates) {
    const key = recommendationKey(recId);
    setRecommendationStatus((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || { status: null, rating: null, is_favorite: false }), ...updates },
    }));
  }

  function stopCardNavigation(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function addRecommendationToWatchlist(recId) {
    const normalizedType = media?.type === "series" ? "series" : "movie";
    const recDetails = await api.get(`/tmdb/details/${normalizedType}/${recId}`);
    const ids = new Set((recDetails.data?.genres || []).map((g) => String(g.id)));
    await api.post(`/media/${recId}/watchlist`, { type: normalizedType, genres: [...ids] });
    updateRecommendationState(recId, { status: "watchlist" });
  }

  async function removeRecommendationFromWatchlist(recId) {
    const normalizedType = media?.type === "series" ? "series" : "movie";
    await api.delete(`/media/${recId}/watchlist`, { data: { type: normalizedType } });
    updateRecommendationState(recId, { status: null });
  }

  async function markRecommendationAsWatched(recId) {
    const normalizedType = media?.type === "series" ? "series" : "movie";
    const recDetails = await api.get(`/tmdb/details/${normalizedType}/${recId}`);
    const ids = new Set((recDetails.data?.genres || []).map((g) => String(g.id)));
    await api.post(`/media/${recId}/watched`, { type: normalizedType, genres: [...ids] });
    updateRecommendationState(recId, { status: "watched" });
  }

  async function removeRecommendationFromWatched(recId) {
    const normalizedType = media?.type === "series" ? "series" : "movie";
    await api.delete(`/media/${recId}/watched`, { data: { type: normalizedType } });
    updateRecommendationState(recId, { status: null, rating: null });
  }

  async function moveRecommendationToWatched(recId) {
    const normalizedType = media?.type === "series" ? "series" : "movie";
    await api.post(`/media/${recId}/watchlist-to-watched`, { type: normalizedType });
    updateRecommendationState(recId, { status: "watched" });
  }

  async function favoriteRecommendation(recId) {
    const normalizedType = media?.type === "series" ? "series" : "movie";
    await api.post(`/media/${recId}/favorite`, { type: normalizedType });
    updateRecommendationState(recId, { is_favorite: true });
  }

  async function unfavoriteRecommendation(recId) {
    const normalizedType = media?.type === "series" ? "series" : "movie";
    await api.delete(`/media/${recId}/favorite`, { data: { type: normalizedType } });
    updateRecommendationState(recId, { is_favorite: false });
  }

  async function rateRecommendation(recId, value) {
    const normalizedType = media?.type === "series" ? "series" : "movie";
    await api.post(`/media/${recId}/rating`, { type: normalizedType, rating: value });
    updateRecommendationState(recId, { rating: value });
  }

  async function addToWatchlist() {
    const ids = new Set(media.genres.map(g => String(g.id)));
    const idArray = [...ids];
    const normalizedType = media.type === "tv" ? "series" : media.type;
    await api.post(`/media/${tmdbId}/watchlist`, { type: normalizedType, genres: idArray });
    setStatus("watchlist");
  }

  async function removeFromWatchlist() {
    const normalizedType = media.type === "tv" ? "series" : media.type;
    await api.delete(`/media/${tmdbId}/watchlist`, {
      data: { type: normalizedType }
    });
    setStatus(null);
  }

  async function markAsWatched() {
    const ids = new Set(media.genres.map(g => String(g.id)));
    const idArray = [...ids];
    const normalizedType = media.type === "tv" ? "series" : media.type;
    await api.post(`/media/${tmdbId}/watched`, { type: normalizedType, genres: idArray });
    setStatus("watched");
  }

  async function removeFromWatched() {
    const normalizedType = media.type === "tv" ? "series" : media.type;
    await api.delete(`/media/${tmdbId}/watched`, {
      data: { type: normalizedType }
    });
    setStatus(null);
    setRating(null); // ⭐ reset rating
  }

  async function moveToWatched() {
    const normalizedType = media.type === "tv" ? "series" : media.type;
    await api.post(`/media/${tmdbId}/watchlist-to-watched`, {
      type: normalizedType
    });
    setStatus("watched");
  }

  // ⭐ NEW — same logic as WatchedPage
  async function handleRate(n) {
    const normalizedType = media.type === "tv" ? "series" : media.type;

    await api.post(`/media/${tmdbId}/rating`, {
      type: normalizedType,
      rating: n
    });

    setRating(n);
  }

  async function handleRemoveRating() {
    const normalizedType = media.type === "tv" ? "series" : media.type;

    await api.delete(`/media/${tmdbId}/rating`, {
      data: { type: normalizedType }
    });

    setRating(null);
  }

  if (loading) return <div className="page-container">Loading...</div>;
  if (!media) return <div className="page-container">Not found</div>;

  const castItems = media.credits?.cast?.filter((actor) => actor.profile_path).slice(0, 12) || [];
  const recommendationItems = media.recommendations?.filter((rec) => rec.poster_path) || [];

  return (
    <div className="details-container">

      <button className="details-back" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="details-layout">

        <img
          src={`https://image.tmdb.org/t/p/w500${media.poster_path}`}
          alt={media.title}
          className="details-poster"
        />

        <div className="details-info">
          <h1 className="details-title">{media.title}</h1>
          <p className="details-year">{media.release_year}</p>

          <p className="details-overview">{media.overview}</p>

          <p className="details-meta">
            {media.genres?.map(g => g.name).join(", ")}
          </p>

          <p className="details-meta">Runtime: {media.runtime} min</p>
          {director && (
            <p className="details-meta">
              Director: <Link to={`/person/${director.id}`} className="details-person-link">{director.name}</Link>
            </p>
          )}

          <div className="details-actions">

            {status === null && (
              <>
                <button className="btn btn-unfavorite" onClick={addToWatchlist}>
                  Add to Watchlist
                </button>

                <button className="btn btn-remove" onClick={markAsWatched}>
                  Mark as Watched
                </button>
              </>
            )}

            {status === "watchlist" && (
              <>
                <button className="btn btn-remove" onClick={moveToWatched}>
                  Move to Watched
                </button>

                <button className="btn btn-unfavorite" onClick={removeFromWatchlist}>
                  Remove from Watchlist
                </button>
              </>
            )}

            {status === "watched" && (
              <button className="btn btn-remove" onClick={removeFromWatched}>
                Remove from Watched
              </button>
            )}

          </div>

          {/* ⭐ NEW — Rating UI only if watched */}
          {status === "watched" && (
            <div style={{ marginTop: "50px" }}>

              <div className="rating-inline">
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button
                    key={n}
                    onClick={() => handleRate(n)}
                    style={{ fontSize: "24px" }}
                    className={rating >= n ? "star active" : "star"}
                  >
                    ★
                  </button>
                ))}

                {rating && (
                      <span style={{ fontSize: "18px" }} className="rating-label">{rating}/10</span>
                )}

              </div>

              {rating && (
                <button
                  onClick={handleRemoveRating}
                  className="btn-remove-rating"
                  style={{ marginTop: "10px" }}
                >
                  Remove rating
                </button>
              )}
            </div>
          )}

        </div>
      </div>

      {trailerKey && (
        <>
          <h2 className="details-section-title">Trailer</h2>
          <div className="details-trailer-wrap">
            <iframe
              className="details-trailer-frame"
              src={`https://www.youtube.com/embed/${trailerKey}`}
              title={`${media.title} trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </>
      )}

      <h2 className="details-section-title">Cast</h2>
      <EmblaCarousel
        items={castItems}
        itemKey={(actor) => `cast-${actor.id}`}
        renderCard={(actor) => (
          <Link to={`/person/${actor.id}`} className="details-cast-item details-cast-link">
            <img
              src={`https://image.tmdb.org/t/p/w300${actor.profile_path}`}
              className="details-cast-img"
              alt={actor.name}
              loading="lazy"
              decoding="async"
            />
            <p className="details-cast-name">{actor.name}</p>
          </Link>
        )}
      />

      <h2 className="details-section-title">Recommendations</h2>
      <EmblaCarousel
        items={recommendationItems}
        itemKey={(rec) => `rec-${rec.id}`}
        renderCard={(rec) => (
          <div key={rec.id} className={`media-card${isMobileView && expandedCardKey === `rec-${rec.id}` ? " mobile-card-expanded" : ""}`}>
            <Link
              to={`/media/${media.type}/${rec.id}`}
              className="media-image-wrapper"
              onClick={(e) => {
                if (isMobileView) {
                  const cardKey = `rec-${rec.id}`;
                  if (expandedCardKey !== cardKey) {
                    e.preventDefault();
                    setExpandedCardKey(cardKey);
                  } else {
                    e.preventDefault();
                    setExpandedCardKey(null);
                    navigate(`/media/${media.type}/${rec.id}`);
                  }
                }
              }}
            >
              <img
                src={`https://image.tmdb.org/t/p/w300${rec.poster_path}`}
                alt={rec.title || rec.name}
                className="media-card-img"
                loading="lazy"
                decoding="async"
                width="300"
                height="450"
              />

              <div className="hover-controls">
                <button
                  type="button"
                  className="mobile-card-close"
                  onClick={(e) => {
                    stopCardNavigation(e);
                    setExpandedCardKey(null);
                  }}
                  aria-label="Close expanded card"
                >
                  <X size={18} />
                </button>
                <div className="hover-title">
                  <span className="hover-title-text">{rec.title || rec.name}</span>
                  <span className="hover-year-text">
                    {(rec.release_date || rec.first_air_date || "").slice(0, 4)}
                  </span>

                  {recommendationStatus[recommendationKey(rec.id)]?.status === "watched" && (
                    <div className="rating-inline">
                      {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                        <span
                          key={n}
                          className={recommendationStatus[recommendationKey(rec.id)]?.rating >= n ? "star active" : "star"}
                          onClick={(e) => {
                            stopCardNavigation(e);
                            rateRecommendation(rec.id, n);
                          }}
                        >
                          ★
                        </span>
                      ))}
                      {recommendationStatus[recommendationKey(rec.id)]?.rating && (
                        <span className="rating-label">{recommendationStatus[recommendationKey(rec.id)]?.rating}/10</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="control-icons">
                  {recommendationStatus[recommendationKey(rec.id)]?.status === null && (
                    <>
                      <span
                        className="watched-icon"
                        onClick={(e) => {
                          stopCardNavigation(e);
                          addRecommendationToWatchlist(rec.id);
                        }}
                        title="Add to Watchlist"
                      >
                        <BookmarkPlus size={32} />
                      </span>
                      <span
                        className="watched-icon"
                        onClick={(e) => {
                          stopCardNavigation(e);
                          markRecommendationAsWatched(rec.id);
                        }}
                        title="Mark as Watched"
                      >
                        <Eye size={32} />
                      </span>
                    </>
                  )}

                  {recommendationStatus[recommendationKey(rec.id)]?.status === "watchlist" && (
                    <>
                      <span
                        className="watched-icon"
                        onClick={(e) => {
                          stopCardNavigation(e);
                          removeRecommendationFromWatchlist(rec.id);
                        }}
                        title="Remove from Watchlist"
                      >
                        <BookmarkMinus size={32} />
                      </span>
                      <span
                        className="watched-icon"
                        onClick={(e) => {
                          stopCardNavigation(e);
                          moveRecommendationToWatched(rec.id);
                        }}
                        title="Move to Watched"
                      >
                        <Eye size={32} />
                      </span>
                    </>
                  )}

                  {recommendationStatus[recommendationKey(rec.id)]?.status === "watched" && (
                    <>
                      <span
                        className={`favorite-icon ${recommendationStatus[recommendationKey(rec.id)]?.is_favorite ? "active" : ""}`}
                        onClick={(e) => {
                          stopCardNavigation(e);
                          if (recommendationStatus[recommendationKey(rec.id)]?.is_favorite) {
                            unfavoriteRecommendation(rec.id);
                          } else {
                            favoriteRecommendation(rec.id);
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
                          removeRecommendationFromWatched(rec.id);
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
        )}
      />

      {isMobileView && expandedCardKey && (
        <div
          className="mobile-card-backdrop"
          onClick={() => setExpandedCardKey(null)}
        />
      )}

    </div>
  );
}