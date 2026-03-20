import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
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
  const [sections, setSections] = useState([]);
  const [firstName, setFirstName] = useState("");

  function renderCard(item) {
    return (
      <article className="media-card home-media-card" key={`${item.type}-${item.tmdb_id}`}>
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
              {Number.isInteger(item.rating) && <span className="rating-label">{item.rating}/10</span>}
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

        const watchedItems = watchedRes.status === "fulfilled" ? watchedRes.value.data?.items || [] : [];
        const watchlistItems = watchlistRes.status === "fulfilled" ? watchlistRes.value.data?.items || [] : [];
        const favoritesItems = favoritesRes.status === "fulfilled" ? favoritesRes.value.data?.items || [] : [];
        const recommendationSections =
          recommendationsRes.status === "fulfilled" ? recommendationsRes.value.data?.sections || [] : [];

        const watchedLatest = pickLatest(watchedItems, ["watched_at"]);
        const watchlistLatest = pickLatest(watchlistItems, ["added_at"]);
        const favoritesLatest = pickLatest(favoritesItems, ["favorited_at"]);

        const recommendations = Array.from(
          new Map(
            recommendationSections
              .flatMap((section) => section.items || [])
              .map((item) => [`${item.type}-${item.tmdb_id}`, item])
          ).values()
        ).slice(0, MAX_ITEMS_PER_SECTION);

        setSections([
          { key: "watched", title: "Recently Watched", items: watchedLatest },
          { key: "watchlist", title: "Watchlist", items: watchlistLatest },
          { key: "favorites", title: "Favorites", items: favoritesLatest },
          { key: "recommendations", title: "Recommendations", items: recommendations },
        ]);
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
                <span className="home-section-count">{section.items.length}</span>
              </div>

              {section.items.length === 0 ? (
                <p className="home-empty">No titles yet.</p>
              ) : (
                <EmblaCarousel items={section.items} renderCard={renderCard} />
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
