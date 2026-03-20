import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { BookmarkMinus, BookmarkPlus, Eye, EyeOff, Heart, Trash } from "lucide-react";
import api from "../api/axios.js";
import "../styles/home.css";
import "../styles/media-card.css";

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

function EmblaCarousel({ items, renderCard }) {
  const plugins = useMemo(
    () => [Autoplay({ delay: 4000, stopOnInteraction: true, stopOnMouseEnter: true })],
    []
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
            <div key={`${item.type}-${item.tmdb_id}`} className="embla-slide">
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

  function updateItemAcrossLists(itemKey, updater) {
    const patch = (list) => list.map((entry) => (mediaKey(entry) === itemKey ? updater(entry) : entry));
    setWatchedItems((prev) => patch(prev));
    setWatchlistItems((prev) => patch(prev));
    setFavoritesItems((prev) => patch(prev));
    setRecommendationItems((prev) => patch(prev));
  }

  async function handleRate(item, rating) {
    await withPending(item, async () => {
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
    });
  }

  async function handleFavorite(item) {
    await withPending(item, async () => {
      await api.post(`/media/${item.tmdb_id}/favorite`, { type: item.type });
      const key = mediaKey(item);

      setMyMediaStatus((prev) => ({
        ...prev,
        [key]: { ...(prev[key] || {}), status: "watched", is_favorite: true },
      }));

      const favoriteItem = { ...item, is_favorite: true };
      setFavoritesItems((prev) => upsertByKey(prev, favoriteItem));
      updateItemAcrossLists(key, (entry) => ({ ...entry, is_favorite: true }));
    });
  }

  async function handleUnfavorite(item) {
    await withPending(item, async () => {
      await api.delete(`/media/${item.tmdb_id}/favorite`, { data: { type: item.type } });
      const key = mediaKey(item);

      setMyMediaStatus((prev) => ({
        ...prev,
        [key]: { ...(prev[key] || {}), status: "watched", is_favorite: false },
      }));

      setFavoritesItems((prev) => prev.filter((entry) => mediaKey(entry) !== key));
      updateItemAcrossLists(key, (entry) => ({ ...entry, is_favorite: false }));
    });
  }

  async function handleRemoveFromWatched(item) {
    await withPending(item, async () => {
      await api.delete(`/media/${item.tmdb_id}/watched`, { data: { type: item.type } });
      const key = mediaKey(item);

      setMyMediaStatus((prev) => ({
        ...prev,
        [key]: { status: null, rating: null, is_favorite: false },
      }));

      setWatchedItems((prev) => prev.filter((entry) => mediaKey(entry) !== key));
      setFavoritesItems((prev) => prev.filter((entry) => mediaKey(entry) !== key));
      updateItemAcrossLists(key, (entry) => ({ ...entry, rating: null, is_favorite: false }));
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

  function renderCard(item, sectionKey) {
    const itemKey = mediaKey(item);
    const currentStatus =
      sectionKey === "watched"
        ? { status: "watched", rating: item.rating || null, is_favorite: !!item.is_favorite }
        : sectionKey === "watchlist"
        ? { status: "watchlist", rating: null, is_favorite: false }
        : sectionKey === "favorites"
        ? { status: "watched", rating: item.rating || null, is_favorite: true }
        : myMediaStatus[itemKey] || { status: null, rating: null, is_favorite: false };
    const isPending = actionPending.has(itemKey);

    return (
      <article className="media-card home-media-card" key={itemKey}>
        <Link to={`/media/${item.type}/${item.tmdb_id}`} className="media-image-wrapper">
          {item.poster_path ? (
            <img src={`https://image.tmdb.org/t/p/w300${item.poster_path}`} alt={item.title} className="media-card-img" />
          ) : (
            <div className="home-card-fallback">{item.title?.slice(0, 1) || "?"}</div>
          )}

          <div className="hover-controls">
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
  }

  useEffect(() => {
    let cancelled = false;

    async function loadHomeSections() {
      setLoading(true);
      setError("");

      try {
        const [watchedRes, watchlistRes, favoritesRes, recommendationsRes, profileRes] = await Promise.allSettled([
          api.get("/media/watched"),
          api.get("/media/watchlist"),
          api.get("/media/favorites"),
          api.get("/explore/recommendations", { params: { type: "all" } }),
          api.get("/profile"),
        ]);

        if (cancelled) return;

        if (profileRes.status === "fulfilled") {
          const fetchedFirstName = profileRes.value?.data?.profile?.first_name || "";
          setFirstName(fetchedFirstName);
        }

        const watchedRaw = watchedRes.status === "fulfilled" ? watchedRes.value.data?.items || [] : [];
        const watchlistRaw = watchlistRes.status === "fulfilled" ? watchlistRes.value.data?.items || [] : [];
        const favoritesRaw = favoritesRes.status === "fulfilled" ? favoritesRes.value.data?.items || [] : [];
        const recommendationSections =
          recommendationsRes.status === "fulfilled" ? recommendationsRes.value.data?.sections || [] : [];

        const watchedLatest = pickLatest(watchedRaw, ["watched_at"]);
        const watchlistLatest = pickLatest(watchlistRaw, ["added_at"]);
        const favoritesLatest = pickLatest(favoritesRaw, ["favorited_at"]);

        const recommendations = Array.from(
          new Map(
            recommendationSections
              .flatMap((section) => section.items || [])
              .map((item) => [`${item.type}-${item.tmdb_id}`, item])
          ).values()
        ).slice(0, MAX_ITEMS_PER_SECTION);

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
        setRecommendationItems(recommendations);
        setMyMediaStatus(nextStatus);
      } catch {
        if (!cancelled) setError("Could not load Home feed right now.");
      } finally {
        if (!cancelled) {
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
    <div className="home-shell">
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
    </div>
  );
}
