import { useEffect, useState, useMemo, Fragment } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { LayoutGrid, GalleryVertical, Heart, Eye, EyeOff, BookmarkPlus, BookmarkMinus, X, ThumbsDown, RotateCcw } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import api from "../api/axios.js";
import "../styles/explore.css";
import "../styles/media-card.css";
import "../styles/embla-carousel.css";

const FILTERS = [
  { key: "all", label: "All titles" },
  { key: "movie", label: "Movies" },
  { key: "series", label: "Series" },
];

function formatSectionReason(item) {
  if (!Array.isArray(item.reason_context) || item.reason_context.length === 0) {
    return "Recommended from your activity graph";
  }

  return item.reason_context.join(" • ");
}

function formatGenres(item) {
  if (!Array.isArray(item.genres) || item.genres.length === 0) {
    return "";
  }

  return item.genres.slice(0, 3).join(" • ");
}

async function fetchExploreSections(typeFilter) {
  const res = await api.get("/explore/recommendations", {
    params: { type: typeFilter },
  });

  const sections = Array.isArray(res.data?.sections) ? res.data.sections : [];

  return sections.map((section) => ({
    ...section,
    items: (Array.isArray(section.items) ? section.items : []).map((item) => ({
      ...item,
      genres: Array.isArray(item.genres)
        ? item.genres.map((genre) => (typeof genre === "string" ? genre : genre?.name)).filter(Boolean)
        : [],
    })),
  }));
}

function EmblaCarousel({ items, renderCard }) {
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

  const plugins = useMemo(() => {
    if (!autoplayEnabled) {
      return [];
    }

    return [Autoplay({ delay: 4000, stopOnInteraction: true, stopOnMouseEnter: true })];
  }, [autoplayEnabled]);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: false,
      align: 'start',
      slidesToScroll: 2,
      breakpoints: {
        '(min-width: 768px)': { slidesToScroll: 3 },
        '(min-width: 1024px)': { slidesToScroll: 4 }
      }
    },
    plugins
  );

  const scrollPrev = () => {
    if (emblaApi) emblaApi.scrollPrev();
  };
  const scrollNext = () => {
    if (emblaApi) emblaApi.scrollNext();
  };

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);
  useEffect(() => {
    if (!emblaApi) return;
    const update = () => {
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
    };
    update();
    emblaApi.on('select', update);
    emblaApi.on('reInit', update);
    return () => {
      emblaApi.off('select', update);
      emblaApi.off('reInit', update);
    };
  }, [emblaApi]);

  return (
    <div className="embla-carousel">
      {canScrollPrev && <button className="embla-arrow left" onClick={scrollPrev}>‹</button>}

      <div className="embla-viewport" ref={emblaRef}>
        <div className="embla-container">
          {items.map((item) => (
            <div key={`${item.type}-${item.tmdb_id}`} className="embla-slide">
              {renderCard(item)}
            </div>
          ))}
        </div>
      </div>

      {canScrollNext && <button className="embla-arrow right" onClick={scrollNext}>›</button>}
    </div>
  );
}

export default function ExplorePage() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewMode, setViewMode] = useState("tape");
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 760px)").matches;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [details, setDetails] = useState("");
  const [myMediaStatus, setMyMediaStatus] = useState({});
  const [actionPending, setActionPending] = useState(new Set());
  const [expandedCardKey, setExpandedCardKey] = useState(null);

  useEffect(() => {
    if (isMobileView && expandedCardKey) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isMobileView, expandedCardKey]);
  const [refreshingSections, setRefreshingSections] = useState(new Set());
  const [payload, setPayload] = useState({
    sections: [],
  });

  function mediaKey(item) {
    return `${item.type}-${item.tmdb_id}`;
  }

  function stop(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const handleViewportChange = (event) => {
      setIsMobileView(event.matches);
    };

    setIsMobileView(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleViewportChange);

    return () => {
      mediaQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

  useEffect(() => {
    if (isMobileView && viewMode !== "tape") {
      setViewMode("tape");
    }
  }, [isMobileView, viewMode]);

  useEffect(() => {
    if (!isMobileView) {
      setExpandedCardKey(null);
    }
  }, [isMobileView]);

  useEffect(() => {
    let cancelled = false;

    async function loadMyMediaStatus() {
      try {
        const [watchlistRes, watchedRes] = await Promise.all([
          api.get("/media/watchlist"),
          api.get("/media/watched"),
        ]);

        if (cancelled) {
          return;
        }

        const nextStatus = {};

        (watchlistRes.data?.items || []).forEach((item) => {
          nextStatus[`${item.type}-${item.tmdb_id}`] = {
            status: "watchlist",
            rating: null,
            is_favorite: false,
          };
        });

        (watchedRes.data?.items || []).forEach((item) => {
          nextStatus[`${item.type}-${item.tmdb_id}`] = {
            status: "watched",
            rating: item.rating || null,
            is_favorite: Boolean(item.is_favorite),
          };
        });

        setMyMediaStatus(nextStatus);
      } catch {
        // Keep Explore usable even if status hydration fails.
      }
    }

    loadMyMediaStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAddToWatchlist(item) {
    const key = mediaKey(item);
    if (actionPending.has(key)) {
      return;
    }

    setMyMediaStatus((prev) => ({
      ...prev,
      [key]: { status: "watchlist", rating: null, is_favorite: false },
    }));
    setActionPending((prev) => new Set([...prev, key]));
    try {
      await api.post(`/media/${item.tmdb_id}/watchlist`, { type: item.type });
    } catch {
      setMyMediaStatus((prev) => ({
        ...prev,
        [key]: { status: null, rating: null, is_favorite: false },
      }));
    } finally {
      setActionPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleMarkAsWatched(item) {
    const key = mediaKey(item);
    if (actionPending.has(key)) {
      return;
    }

    const previous = myMediaStatus[key];
    setMyMediaStatus((prev) => ({
      ...prev,
      [key]: {
        status: "watched",
        rating: prev[key]?.rating || null,
        is_favorite: prev[key]?.is_favorite || false,
      },
    }));
    setActionPending((prev) => new Set([...prev, key]));
    try {
      await api.post(`/media/${item.tmdb_id}/watched`, { type: item.type });
    } catch {
      setMyMediaStatus((prev) => ({
        ...prev,
        [key]: previous || { status: null, rating: null, is_favorite: false },
      }));
    } finally {
      setActionPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleRemoveFromWatchlist(item) {
    const key = mediaKey(item);

    if (actionPending.has(key)) {
      return;
    }

    const previous = myMediaStatus[key];
    setMyMediaStatus((prev) => ({
      ...prev,
      [key]: { status: null, rating: null, is_favorite: false },
    }));
    setActionPending((prev) => new Set([...prev, key]));
    try {
      await api.delete(`/media/${item.tmdb_id}/watchlist`, { data: { type: item.type } });
    } catch {
      setMyMediaStatus((prev) => ({
        ...prev,
        [key]: previous,
      }));
    } finally {
      setActionPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleMoveToWatched(item) {
    const key = mediaKey(item);

    if (actionPending.has(key)) {
      return;
    }

    const previous = myMediaStatus[key];
    setMyMediaStatus((prev) => ({
      ...prev,
      [key]: {
        status: "watched",
        rating: prev[key]?.rating || null,
        is_favorite: prev[key]?.is_favorite || false,
      },
    }));
    setActionPending((prev) => new Set([...prev, key]));
    try {
      await api.post(`/media/${item.tmdb_id}/watchlist-to-watched`, { type: item.type });
    } catch {
      setMyMediaStatus((prev) => ({
        ...prev,
        [key]: previous,
      }));
    } finally {
      setActionPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleRemoveFromWatched(item) {
    const key = mediaKey(item);

    if (actionPending.has(key)) {
      return;
    }

    const previous = myMediaStatus[key];
    setMyMediaStatus((prev) => ({
      ...prev,
      [key]: { status: null, rating: null, is_favorite: false },
    }));
    setActionPending((prev) => new Set([...prev, key]));
    try {
      await api.delete(`/media/${item.tmdb_id}/watched`, { data: { type: item.type } });
    } catch {
      setMyMediaStatus((prev) => ({
        ...prev,
        [key]: previous,
      }));
    } finally {
      setActionPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleRate(item, rating) {
    const key = mediaKey(item);

    if (actionPending.has(key)) {
      return;
    }

    const previous = myMediaStatus[key];
    setMyMediaStatus((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        status: "watched",
        rating,
        is_favorite: prev[key]?.is_favorite || false,
      },
    }));
    setActionPending((prev) => new Set([...prev, key]));
    try {
      await api.post(`/media/${item.tmdb_id}/rating`, { type: item.type, rating });
    } catch {
      setMyMediaStatus((prev) => ({
        ...prev,
        [key]: previous,
      }));
    } finally {
      setActionPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleFavorite(item) {
    const key = mediaKey(item);
    const currentStatus = myMediaStatus[key];

    if (actionPending.has(key) || currentStatus?.status !== "watched") {
      return;
    }

    setMyMediaStatus((prev) => ({
      ...prev,
      [key]: { ...prev[key], is_favorite: true },
    }));
    setActionPending((prev) => new Set([...prev, key]));
    try {
      await api.post(`/media/${item.tmdb_id}/favorite`, { type: item.type });
    } catch {
      setMyMediaStatus((prev) => ({
        ...prev,
        [key]: { ...prev[key], is_favorite: false },
      }));
    } finally {
      setActionPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleUnfavorite(item) {
    const key = mediaKey(item);
    const currentStatus = myMediaStatus[key];

    if (actionPending.has(key) || currentStatus?.status !== "watched") {
      return;
    }

    setMyMediaStatus((prev) => ({
      ...prev,
      [key]: { ...prev[key], is_favorite: false },
    }));
    setActionPending((prev) => new Set([...prev, key]));
    try {
      await api.delete(`/media/${item.tmdb_id}/favorite`, { data: { type: item.type } });
    } catch {
      setMyMediaStatus((prev) => ({
        ...prev,
        [key]: { ...prev[key], is_favorite: true },
      }));
    } finally {
      setActionPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleDiscardRecommendation(item, sectionKey) {
    const key = mediaKey(item);

    if (actionPending.has(key)) {
      return;
    }

    if (isMobileView) {
      setExpandedCardKey(null);
    }

    setPayload((prev) => ({
      ...prev,
      sections: prev.sections
        .map((section) => {
          if (section.key !== sectionKey) {
            return section;
          }

          return {
            ...section,
            items: (section.items || []).filter((candidate) => mediaKey(candidate) !== key),
          };
        })
        .filter((section) => (section.items || []).length > 0),
    }));

    setActionPending((prev) => new Set([...prev, key]));
    try {
      await api.post(`/explore/recommendations/${item.tmdb_id}/discard`, { type: item.type });
      const nextSections = await fetchExploreSections(typeFilter);
      setPayload({ sections: nextSections });
    } catch {
      // Keep optimistic remove if silent refresh fails.
    } finally {
      setActionPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleRefreshSection(section) {
    const sectionKey = section?.key;
    const sectionItems = Array.isArray(section?.items) ? section.items : [];

    if (!sectionKey || sectionKey === "friendTrending" || sectionItems.length === 0 || refreshingSections.has(sectionKey)) {
      return;
    }

    if (isMobileView) {
      setExpandedCardKey(null);
    }

    setRefreshingSections((prev) => new Set([...prev, sectionKey]));
    try {
      await api.post("/explore/recommendations/discard-bulk", {
        items: sectionItems.map((item) => ({ tmdbId: item.tmdb_id, type: item.type })),
      });

      const nextSections = await fetchExploreSections(typeFilter);
      setPayload({ sections: nextSections });
    } catch {
      // Keep existing cards if bulk refresh fails.
    } finally {
      setRefreshingSections((prev) => {
        const next = new Set(prev);
        next.delete(sectionKey);
        return next;
      });
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadRecommendations() {
      setLoading(true);
      setError("");
      setDetails("");

      try {
        const hydratedSections = await fetchExploreSections(typeFilter);

        if (!cancelled) {
          setPayload({
            sections: hydratedSections,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setPayload({ sections: [] });
          setError(err.response?.data?.error || "Failed to load Explore recommendations");
          setDetails(err.response?.data?.details || "");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [typeFilter]);

  function renderCard(item, sectionKey, mode = "grid") {
    const mediaLink = `/media/${item.type}/${item.tmdb_id}`;
    const posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null;
    const key = mediaKey(item);
    const cardIdentifier = `${sectionKey}-${key}`;
    const currentStatus = myMediaStatus[key] || { status: null, rating: null, is_favorite: false };
    const isPending = actionPending.has(key);
    const genresLabel = formatGenres(item);
    const isFavoriteSeedSection = sectionKey === "fromYourFavorites";
    const isGenreSection = sectionKey === "genreSignals";
    const isFriendSection = sectionKey === "friendTrending";
    const friendLabel = Array.isArray(item.reason_context) && item.reason_context.length > 0 ? item.reason_context[0] : "Friend pick";
    const isExpanded = isMobileView && expandedCardKey === cardIdentifier;

    const card = (
      <article className={`media-card explore-media-card ${mode === "tape" ? "carousel-card" : ""} ${isExpanded ? "mobile-card-expanded" : ""}`}>
        <Link
          to={mediaLink}
          className="media-image-wrapper"
          onClick={(e) => {
            if (isMobileView && !isExpanded) {
              e.preventDefault();
              setExpandedCardKey(cardIdentifier);
            }
          }}
        >
          {posterUrl ? (
            <img
              className="media-card-img"
              src={posterUrl}
              alt={item.title}
              loading="lazy"
              decoding="async"
              width="300"
              height="450"
            />
          ) : (
            <div className="explore-card-fallback">{item.title?.slice(0, 1) || "?"}</div>
          )}

          <div className="hover-controls">
            <button
              type="button"
              className="mobile-card-close"
              onClick={(e) => {
                stop(e);
                setExpandedCardKey(null);
              }}
              aria-label="Close expanded card"
            >
              <X size={18} />
            </button>

            <div className="hover-title">
              <span className="hover-title-text">{item.title}</span>
              <span className="hover-year-text">{item.release_year || "Unknown year"}</span>
              {genresLabel && <span className="explore-hover-genres">{genresLabel}</span>}
              {currentStatus.status === "watched" && (
                <div className="rating-inline">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <span
                      key={n}
                      className={currentStatus.rating >= n ? "star active" : "star"}
                      onClick={(e) => {
                        stop(e);
                        handleRate(item, n);
                      }}
                    >
                      ★
                    </span>
                  ))}

                  {currentStatus.rating && <span className="rating-label">{currentStatus.rating}/10</span>}
                </div>
              )}
              {!isFavoriteSeedSection && !isGenreSection && !isFriendSection && (
                <span className="explore-hover-reason">{formatSectionReason(item)}</span>
              )}
              {isFriendSection && <span className="explore-hover-score">{friendLabel}</span>}
            </div>

            <div className="control-icons explore-control-icons">
              {currentStatus.status === null && (
                <>
                  <span
                    className={`watched-icon ${isPending ? "disabled" : ""}`}
                    onClick={(e) => {
                      stop(e);
                      handleDiscardRecommendation(item, sectionKey);
                    }}
                    title="Not interested"
                  >
                    <ThumbsDown size={34} />
                  </span>

                  <span
                    className={`watched-icon ${isPending ? "disabled" : ""}`}
                    onClick={(e) => {
                      stop(e);
                      handleAddToWatchlist(item);
                    }}
                    title="Add to Watchlist"
                  >
                    <BookmarkPlus size={34} />
                  </span>

                  <span
                    className={`watched-icon ${isPending ? "disabled" : ""}`}
                    onClick={(e) => {
                      stop(e);
                      handleMarkAsWatched(item);
                    }}
                    title="Mark as Watched"
                  >
                    <Eye size={34} />
                  </span>
                </>
              )}

              {currentStatus.status === "watchlist" && (
                <>
                  <span
                    className={`watched-icon ${isPending ? "disabled" : ""}`}
                    onClick={(e) => {
                      stop(e);
                      handleRemoveFromWatchlist(item);
                    }}
                    title="Remove from Watchlist"
                  >
                    <BookmarkMinus size={34} />
                  </span>

                  <span
                    className={`watched-icon ${isPending ? "disabled" : ""}`}
                    onClick={(e) => {
                      stop(e);
                      handleMoveToWatched(item);
                    }}
                    title="Move to Watched"
                  >
                    <Eye size={34} />
                  </span>
                </>
              )}

              {currentStatus.status === "watched" && (
                <>
                  <span
                    className={`favorite-icon ${currentStatus.is_favorite ? "active" : ""} ${isPending ? "disabled" : ""}`}
                    onClick={(e) => {
                      stop(e);
                      currentStatus.is_favorite ? handleUnfavorite(item) : handleFavorite(item);
                    }}
                    title="Favorite"
                  >
                    <Heart size={34} />
                  </span>

                  <span
                    className={`watched-icon active ${isPending ? "disabled" : ""}`}
                    onClick={(e) => {
                      stop(e);
                      handleRemoveFromWatched(item);
                    }}
                    title="Remove from Watched"
                  >
                    <EyeOff size={34} />
                  </span>
                </>
              )}
            </div>
          </div>
        </Link>
      </article>
    );
    if (isExpanded) {
      return (
        <Fragment key={key}>
          <article className="media-card explore-media-card"><div className="media-image-wrapper">{item.poster_path ? <img src={`https://image.tmdb.org/t/p/w300${item.poster_path}`} className="media-card-img" style={{opacity:0.3}} width="300" height="450" /> : <div className="explore-card-fallback" style={{opacity:0.3}}>{item.title?.slice(0,1)||"?"}</div>}</div></article>
          {createPortal(card, document.body)}
        </Fragment>
      );
    }
    return <Fragment key={key}>{card}</Fragment>;
  }

  return (
    <div
      className="explore-shell"
      onClick={(e) => {
        if (isMobileView && expandedCardKey && e.target === e.currentTarget) {
          setExpandedCardKey(null);
        }
      }}
    >
      <section className="explore-hero">
        <div className="explore-hero-copy">
          <div className="explore-hero-layout">
            <div className="explore-hero-text">
              <p className="explore-kicker">Explore</p>
              <h1 className="explore-title">Explore New Movies and Series</h1>
              <p className="explore-subtitle">
                A personalized page built for you, bringing together fresh picks based on your taste, favorites, and activity.
              </p>
            </div>

            <div className="explore-filter-row" role="tablist" aria-label="Explore recommendation type filter">
              {FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={`explore-filter-chip ${typeFilter === filter.key ? "active" : ""}`}
                  onClick={() => setTypeFilter(filter.key)}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {!isMobileView && (
              <div className="view-toggle-container">
                <div
                  className={`view-toggle-box ${viewMode === "grid" ? "active" : ""}`}
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid size={22} />
                </div>

                <div
                  className={`view-toggle-box ${viewMode === "tape" ? "active" : ""}`}
                  onClick={() => setViewMode("tape")}
                >
                  <GalleryVertical size={22} />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {loading && (
        <section className="explore-state-card">
          <h2 className="explore-state-title">Finding picks for you...</h2>
          <p className="explore-state-copy">Hang tight, we're looking through your activity to find titles you'll actually enjoy.</p>
        </section>
      )}

      {!loading && error && (
        <section className="explore-state-card error">
          <h2 className="explore-state-title">Explore is not ready yet</h2>
          <p className="explore-state-copy">{error}</p>
          {details && <p className="explore-state-copy subtle">{details}</p>}
        </section>
      )}

      {!loading && !error && payload.sections.length === 0 && (
        <section className="explore-state-card">
          <h2 className="explore-state-title">No recommendations yet</h2>
          <p className="explore-state-copy">
            Add a few watched titles, favorites, or friends first, then Explore will have enough graph data to rank suggestions.
          </p>
        </section>
      )}

      {!loading && !error && payload.sections.length > 0 && (
        <div className="explore-sections">
          {payload.sections.map((section) => (
            <section key={section.key} className="explore-section">
              <div className="explore-section-head">
                <div>
                  <h2 className="explore-section-title">{section.title}</h2>
                </div>

                {section.key !== "friendTrending" && (
                  <button
                    type="button"
                    className="section-refresh-btn"
                    onClick={() => handleRefreshSection(section)}
                    disabled={refreshingSections.has(section.key) || section.items.length === 0}
                    title="Refresh this carousel"
                  >
                    <RotateCcw size={16} />
                    <span>{refreshingSections.has(section.key) ? "Refreshing..." : "Refresh"}</span>
                  </button>
                )}
              </div>

              {viewMode === "grid" && !isMobileView && (
                <div className="explore-grid">
                  {section.items.map((item) => renderCard(item, section.key, "grid"))}
                </div>
              )}

              {(viewMode === "tape" || isMobileView) && (
                <EmblaCarousel items={section.items} renderCard={(item) => renderCard(item, section.key, "tape")} />
              )}
            </section>
          ))}
        </div>
      )}

      {isMobileView && expandedCardKey && (
        <div
          className="mobile-card-backdrop"
          style={{position: "fixed", inset: 0, zIndex: 9998, background: "transparent"}}
          onClick={() => setExpandedCardKey(null)}
        />
      )}
    </div>
  );
}
