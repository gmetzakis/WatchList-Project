import { useEffect, useMemo, useState, Fragment } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { BookmarkMinus, BookmarkPlus, Eye, EyeOff, Heart, RotateCcw, ThumbsDown, Trash, X } from "lucide-react";
import api from "../api/axios.js";
import "../styles/home.css";
import "../styles/media-card.css";
import "../styles/embla-carousel.css";

const MAX_ITEMS_PER_SECTION = 12;

function normalizeGenres(rawGenres) {
  if (!Array.isArray(rawGenres)) return [];

  return rawGenres
    .map((genre) => {
      if (typeof genre === "string") return genre;
      if (typeof genre?.name === "string") return genre.name;
      return null;
    })
    .filter(Boolean);
}

function formatGenres(item) {
  const genres = normalizeGenres(item.genres);
  if (!genres.length) return "";
  return genres.slice(0, 3).join(" • ");
}

function toTimestamp(item, preferredKeys = []) {
  const keys = [...preferredKeys, "watched_at", "added_at", "favorited_at", "created_at", "updated_at"];

  for (const key of keys) {
    const value = item?.[key];
    if (!value) continue;
    const timestamp = new Date(value).getTime();
    if (!Number.isNaN(timestamp)) return timestamp;
  }

  const fallbackYear = Number(item?.release_year);
  if (Number.isFinite(fallbackYear)) {
    return new Date(`${fallbackYear}-01-01`).getTime();
  }

  return 0;
}

function pickLatest(items, preferredKeys = []) {
  return [...items]
    .sort((a, b) => toTimestamp(b, preferredKeys) - toTimestamp(a, preferredKeys))
    .slice(0, MAX_ITEMS_PER_SECTION);
}

function mediaKey(item) {
  return `${item.type}-${item.tmdb_id}`;
}

function stop(e) {
  e.preventDefault();
  e.stopPropagation();
}

function upsertByKey(list, item) {
  const key = mediaKey(item);
  const next = [item, ...list.filter((entry) => mediaKey(entry) !== key)];
  return pickLatest(next);
}

function flattenRecommendationSections(recommendationSections) {
  return Array.from(
    new Map(
      recommendationSections
        .flatMap((section) => section.items || [])
        .map((item) => [`${item.type}-${item.tmdb_id}`, item])
    ).values()
  ).slice(0, MAX_ITEMS_PER_SECTION);
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
      {canScrollPrev && <button className="embla-arrow left" onClick={() => emblaApi?.scrollPrev()}>
        ‹
      </button>}

      <div className="embla-viewport" ref={emblaRef}>
        <div className="embla-container">
          {items.map((item) => (
            <div key={`${item.type}-${item.tmdb_id}`} className="embla-slide">
              {renderCard(item)}
            </div>
          ))}
        </div>
      </div>

      {canScrollNext && <button className="embla-arrow right" onClick={() => emblaApi?.scrollNext()}>
        ›
      </button>}
    </div>
  );
}

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [watchedItems, setWatchedItems] = useState([]);
  const [watchlistItems, setWatchlistItems] = useState([]);
  const [favoritesItems, setFavoritesItems] = useState([]);
  const [recommendationItems, setRecommendationItems] = useState([]);
  const [myMediaStatus, setMyMediaStatus] = useState({});
  const [actionPending, setActionPending] = useState(new Set());
  const [firstName, setFirstName] = useState("");
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 760px)").matches;
  });
  const [expandedCardKey, setExpandedCardKey] = useState(null);
  const [isRefreshingHomeRecommendations, setIsRefreshingHomeRecommendations] = useState(false);

  useEffect(() => {
    if (isMobileView && expandedCardKey) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isMobileView, expandedCardKey]);

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

  const sections = useMemo(
    () => [
      { key: "watched", title: "Recently Watched", items: watchedItems },
      { key: "watchlist", title: "Watchlist", items: watchlistItems },
      { key: "favorites", title: "Favorites", items: favoritesItems },
      { key: "recommendations", title: "Recommendations", items: recommendationItems },
    ],
    [watchedItems, watchlistItems, favoritesItems, recommendationItems]
  );

  async function withPending(item, fn) {
    const key = mediaKey(item);
    if (actionPending.has(key)) return;

    setActionPending((prev) => new Set([...prev, key]));
    try {
      await fn();
    } finally {
      setActionPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  function snapshotHomeLists() {
    return {
      watchedItems,
      watchlistItems,
      favoritesItems,
      recommendationItems,
    };
  }

  function restoreHomeLists(snapshot) {
    setWatchedItems(snapshot.watchedItems);
    setWatchlistItems(snapshot.watchlistItems);
    setFavoritesItems(snapshot.favoritesItems);
    setRecommendationItems(snapshot.recommendationItems);
  }

  function updateItemAcrossLists(itemKey, updater) {
    const patch = (list) => list.map((entry) => (mediaKey(entry) === itemKey ? updater(entry) : entry));
    setWatchedItems((prev) => patch(prev));
    setWatchlistItems((prev) => patch(prev));
    setFavoritesItems((prev) => patch(prev));
    setRecommendationItems((prev) => patch(prev));
  }

  async function handleRate(item, rating) {
    await withPending(item, async () => {
      const snapshot = snapshotHomeLists();
      await api.post(`/media/${item.tmdb_id}/rating`, { type: item.type, rating });
      const key = mediaKey(item);

      setMyMediaStatus((prev) => ({
        ...prev,
        [key]: {
          ...(prev[key] || {}),
          status: "watched",
          rating,
          is_favorite: prev[key]?.is_favorite || false,
        },
      }));

      updateItemAcrossLists(key, (entry) => ({ ...entry, rating }));
    }).catch?.(() => {});
  }

  async function handleFavorite(item) {
    const key = mediaKey(item);
    const snapshot = snapshotHomeLists();
    setMyMediaStatus((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), status: "watched", is_favorite: true },
    }));
    const favoriteItem = { ...item, is_favorite: true };
    setFavoritesItems((prev) => upsertByKey(prev, favoriteItem));
    updateItemAcrossLists(key, (entry) => ({ ...entry, is_favorite: true }));

    await withPending(item, async () => {
      try {
        await api.post(`/media/${item.tmdb_id}/favorite`, { type: item.type });
      } catch (err) {
        restoreHomeLists(snapshot);
        setMyMediaStatus((prev) => ({
          ...prev,
          [key]: { ...(prev[key] || {}), status: "watched", is_favorite: false },
        }));
        throw err;
      }
    });
  }

  async function handleUnfavorite(item) {
    const key = mediaKey(item);
    const snapshot = snapshotHomeLists();
    setMyMediaStatus((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), status: "watched", is_favorite: false },
    }));
    setFavoritesItems((prev) => prev.filter((entry) => mediaKey(entry) !== key));
    updateItemAcrossLists(key, (entry) => ({ ...entry, is_favorite: false }));

    await withPending(item, async () => {
      try {
        await api.delete(`/media/${item.tmdb_id}/favorite`, { data: { type: item.type } });
      } catch (err) {
        restoreHomeLists(snapshot);
        setMyMediaStatus((prev) => ({
          ...prev,
          [key]: { ...(prev[key] || {}), status: "watched", is_favorite: true },
        }));
        throw err;
      }
    });
  }

  async function handleRemoveFromWatched(item) {
    const key = mediaKey(item);
    const snapshot = snapshotHomeLists();
    setMyMediaStatus((prev) => ({
      ...prev,
      [key]: { status: null, rating: null, is_favorite: false },
    }));
    setWatchedItems((prev) => prev.filter((entry) => mediaKey(entry) !== key));
    setFavoritesItems((prev) => prev.filter((entry) => mediaKey(entry) !== key));
    updateItemAcrossLists(key, (entry) => ({ ...entry, rating: null, is_favorite: false }));

    await withPending(item, async () => {
      try {
        await api.delete(`/media/${item.tmdb_id}/watched`, { data: { type: item.type } });
      } catch (err) {
        restoreHomeLists(snapshot);
        setMyMediaStatus((prev) => ({
          ...prev,
          [key]: {
            status: "watched",
            rating: item.rating || null,
            is_favorite: item.is_favorite || false,
          },
        }));
        throw err;
      }
    });
  }

  async function handleRemoveFromWatchlist(item) {
    await withPending(item, async () => {
      await api.delete(`/media/${item.tmdb_id}/watchlist`, { data: { type: item.type } });
      const key = mediaKey(item);

      setMyMediaStatus((prev) => ({
        ...prev,
        [key]: { ...(prev[key] || {}), status: null },
      }));

      setWatchlistItems((prev) => prev.filter((entry) => mediaKey(entry) !== key));
    });
  }

  async function handleMarkAsWatched(item) {
    await withPending(item, async () => {
      await api.post(`/media/${item.tmdb_id}/watched`, { type: item.type });
      const key = mediaKey(item);

      setMyMediaStatus((prev) => ({
        ...prev,
        [key]: { status: "watched", rating: prev[key]?.rating || null, is_favorite: prev[key]?.is_favorite || false },
      }));

      setWatchlistItems((prev) => prev.filter((entry) => mediaKey(entry) !== key));
      setWatchedItems((prev) => upsertByKey(prev, { ...item, rating: item.rating || null }));
    });
  }

  async function handleMoveToWatched(item) {
    await withPending(item, async () => {
      await api.post(`/media/${item.tmdb_id}/watchlist-to-watched`, { type: item.type });
      const key = mediaKey(item);

      setMyMediaStatus((prev) => ({
        ...prev,
        [key]: { status: "watched", rating: prev[key]?.rating || null, is_favorite: prev[key]?.is_favorite || false },
      }));

      setWatchlistItems((prev) => prev.filter((entry) => mediaKey(entry) !== key));
      setWatchedItems((prev) => upsertByKey(prev, { ...item, rating: item.rating || null }));
    });
  }

  async function handleAddToWatchlist(item) {
    await withPending(item, async () => {
      await api.post(`/media/${item.tmdb_id}/watchlist`, { type: item.type });
      const key = mediaKey(item);

      setMyMediaStatus((prev) => ({
        ...prev,
        [key]: { ...(prev[key] || {}), status: "watchlist" },
      }));

      setWatchlistItems((prev) => upsertByKey(prev, item));
    });
  }

  async function refreshHomeRecommendations() {
    try {
      const response = await api.get("/explore/recommendations", { params: { type: "all" } });
      const recommendationSections = Array.isArray(response.data?.sections) ? response.data.sections : [];
      setRecommendationItems(flattenRecommendationSections(recommendationSections));
    } catch {
      // Keep current items if refresh fails.
    }
  }

  async function handleDiscardRecommendation(item) {
    const key = mediaKey(item);

    await withPending(item, async () => {
      if (isMobileView) {
        setExpandedCardKey(null);
      }

      setRecommendationItems((prev) => prev.filter((entry) => mediaKey(entry) !== key));

      try {
        await api.post(`/explore/recommendations/${item.tmdb_id}/discard`, { type: item.type });
      } finally {
        await refreshHomeRecommendations();
      }
    });
  }

  async function handleRefreshHomeRecommendationsCarousel() {
    if (isRefreshingHomeRecommendations || recommendationItems.length === 0) {
      return;
    }

    if (isMobileView) {
      setExpandedCardKey(null);
    }

    setIsRefreshingHomeRecommendations(true);
    try {
      await api.post("/explore/recommendations/discard-bulk", {
        items: recommendationItems.map((item) => ({ tmdbId: item.tmdb_id, type: item.type })),
      });

      await refreshHomeRecommendations();
    } catch {
      // Keep existing cards if refresh fails.
    } finally {
      setIsRefreshingHomeRecommendations(false);
    }
  }

  function renderCard(item, sectionKey) {
    const itemKey = mediaKey(item);
    const cardIdentifier = `${sectionKey}-${itemKey}`;
    const isExpanded = isMobileView && expandedCardKey === cardIdentifier;
    const currentStatus =
      sectionKey === "watched"
        ? { status: "watched", rating: item.rating || null, is_favorite: !!item.is_favorite }
        : sectionKey === "watchlist"
        ? { status: "watchlist", rating: null, is_favorite: false }
        : sectionKey === "favorites"
        ? { status: "watched", rating: item.rating || null, is_favorite: true }
        : myMediaStatus[itemKey] || { status: null, rating: null, is_favorite: false };
    const isPending = actionPending.has(itemKey);
    const detailsPath = `/media/${item.type}/${item.tmdb_id}`;

    const card = (
      <article className={`media-card home-media-card ${isExpanded ? "mobile-card-expanded" : ""}`}>
        <Link
          to={detailsPath}
          className="media-image-wrapper"
          onClick={(e) => {
            if (isMobileView && !isExpanded) {
              e.preventDefault();
              setExpandedCardKey(cardIdentifier);
            }
          }}
        >
          {item.poster_path ? (
            <img
              src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
              alt={item.title}
              className="media-card-img"
              width="300"
              height="450"
              decoding="async"
            />
          ) : (
            <div className="home-card-fallback">{item.title?.slice(0, 1) || "?"}</div>
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
              <span className="hover-year-text">{item.release_year || "—"}</span>
              {formatGenres(item) && <span className="hover-genres-text">{formatGenres(item)}</span>}

              {(sectionKey === "watched" || sectionKey === "favorites" || currentStatus.status === "watched") && (
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
            </div>

            <div className="control-icons">
              {sectionKey === "watched" && (
                <>
                  <span
                    className={`favorite-icon ${currentStatus.is_favorite ? "active" : ""} ${isPending ? "disabled" : ""}`}
                    onClick={(e) => {
                      stop(e);
                      currentStatus.is_favorite ? handleUnfavorite(item) : handleFavorite(item);
                    }}
                  >
                    <Heart size={32} />
                  </span>

                  <span
                    className={`watched-icon active ${isPending ? "disabled" : ""}`}
                    onClick={(e) => {
                      stop(e);
                      handleRemoveFromWatched(item);
                    }}
                  >
                    <EyeOff size={32} />
                  </span>
                </>
              )}

              {sectionKey === "watchlist" && (
                <>
                  <span
                    className={`watched-icon ${isPending ? "disabled" : ""}`}
                    onClick={(e) => {
                      stop(e);
                      handleMoveToWatched(item);
                    }}
                    title="Move to watched"
                  >
                    <Eye size={32} />
                  </span>

                  <span
                    className={`watched-icon ${isPending ? "disabled" : ""}`}
                    onClick={(e) => {
                      stop(e);
                      handleRemoveFromWatchlist(item);
                    }}
                    title="Remove from watchlist"
                  >
                    <Trash size={32} />
                  </span>
                </>
              )}

              {sectionKey === "favorites" && (
                <>
                  <span
                    className={`favorite-icon active ${isPending ? "disabled" : ""}`}
                    onClick={(e) => {
                      stop(e);
                      handleUnfavorite(item);
                    }}
                    title="Remove from favorites"
                  >
                    <Heart size={32} />
                  </span>

                  <span
                    className={`watched-icon ${isPending ? "disabled" : ""}`}
                    onClick={(e) => {
                      stop(e);
                      handleRemoveFromWatched(item);
                    }}
                    title="Remove from watched"
                  >
                    <EyeOff size={32} />
                  </span>
                </>
              )}

              {sectionKey === "recommendations" && (
                <>
                  {currentStatus.status === null && (
                    <>
                      <span
                        className={`watched-icon ${isPending ? "disabled" : ""}`}
                        onClick={(e) => {
                          stop(e);
                          handleDiscardRecommendation(item);
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
                </>
              )}
            </div>
          </div>
        </Link>
      </article>
    );
    if (isExpanded) {
      return (
        <Fragment key={itemKey}>
          <article className="media-card home-media-card"><div className="media-image-wrapper">{item.poster_path ? <img src={`https://image.tmdb.org/t/p/w300${item.poster_path}`} className="media-card-img" style={{opacity:0.3}} width="300" height="450" /> : <div className="home-card-fallback" style={{opacity:0.3}}>{item.title?.slice(0,1)||"?"}</div>}</div></article>
          {createPortal(card, document.body)}
        </Fragment>
      );
    }
    return <Fragment key={itemKey}>{card}</Fragment>;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadHomeSections() {
      setLoading(true);
      setError("");

      try {
        const [watchedRes, watchlistRes, favoritesRes] = await Promise.allSettled([
          api.get("/media/watched"),
          api.get("/media/watchlist"),
          api.get("/media/favorites"),
        ]);

        if (cancelled) return;

        const watchedRaw = watchedRes.status === "fulfilled" ? watchedRes.value.data?.items || [] : [];
        const watchlistRaw = watchlistRes.status === "fulfilled" ? watchlistRes.value.data?.items || [] : [];
        const favoritesRaw = favoritesRes.status === "fulfilled" ? favoritesRes.value.data?.items || [] : [];

        const watchedLatest = pickLatest(watchedRaw, ["watched_at"]);
        const watchlistLatest = pickLatest(watchlistRaw, ["added_at"]);
        const favoritesLatest = pickLatest(favoritesRaw, ["favorited_at"]);

        const nextStatus = {};

        watchlistRaw.forEach((item) => {
          nextStatus[mediaKey(item)] = { status: "watchlist", rating: null, is_favorite: false };
        });

        watchedRaw.forEach((item) => {
          nextStatus[mediaKey(item)] = {
            status: "watched",
            rating: Number.isInteger(item.rating) ? item.rating : null,
            is_favorite: !!item.is_favorite,
          };
        });

        favoritesRaw.forEach((item) => {
          const key = mediaKey(item);
          nextStatus[key] = {
            status: "watched",
            rating: Number.isInteger(item.rating) ? item.rating : nextStatus[key]?.rating || null,
            is_favorite: true,
          };
        });

        setWatchedItems(watchedLatest);
        setWatchlistItems(watchlistLatest);
        setFavoritesItems(favoritesLatest);
        setMyMediaStatus(nextStatus);

        if (
          watchedRes.status !== "fulfilled" &&
          watchlistRes.status !== "fulfilled" &&
          favoritesRes.status !== "fulfilled"
        ) {
          setError("Could not load Home feed right now.");
        }

        setLoading(false);

        Promise.allSettled([
          api.get("/explore/recommendations", { params: { type: "all" } }),
          api.get("/profile"),
        ]).then(([recommendationsRes, profileRes]) => {
          if (cancelled) return;

          if (recommendationsRes.status === "fulfilled") {
            const recommendationSections = recommendationsRes.value.data?.sections || [];
            setRecommendationItems(flattenRecommendationSections(recommendationSections));
          }

          if (profileRes.status === "fulfilled") {
            const fetchedFirstName = profileRes.value?.data?.profile?.first_name || "";
            setFirstName(fetchedFirstName);
          }
        });
      } catch {
        if (!cancelled) {
          setError("Could not load Home feed right now.");
          setLoading(false);
        }
      }
    }

    loadHomeSections();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="home-shell"
      onClick={(e) => {
        if (isMobileView && expandedCardKey && e.target === e.currentTarget) {
          setExpandedCardKey(null);
        }
      }}
    >
      <section className="home-hero-shell">
        <p className="home-kicker">Home</p>
        <h1 className="home-title">{firstName ? `Welcome ${firstName}` : "Welcome"}</h1>
      </section>

      {loading && (
        <section className="home-state-shell">
          <p>Loading your home feed...</p>
        </section>
      )}

      {!loading && error && (
        <section className="home-state-shell">
          <p>{error}</p>
        </section>
      )}

      {!loading && !error && (
        <div className="home-sections">
          {sections.map((section) => (
            <section key={section.key} className="home-section-shell">
              <div className="home-section-head">
                <h2 className="home-section-title">{section.title}</h2>

                {section.key === "recommendations" && (
                  <button
                    type="button"
                    className="section-refresh-btn"
                    onClick={handleRefreshHomeRecommendationsCarousel}
                    disabled={isRefreshingHomeRecommendations || section.items.length === 0}
                    title="Refresh this carousel"
                  >
                    <RotateCcw size={16} />
                    <span>{isRefreshingHomeRecommendations ? "Refreshing..." : "Refresh"}</span>
                  </button>
                )}
              </div>

              {section.items.length === 0 ? (
                <p className="home-empty">No titles yet.</p>
              ) : (
                <EmblaCarousel
                  items={section.items}
                  renderCard={(item) => renderCard(item, section.key)}
                />
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
