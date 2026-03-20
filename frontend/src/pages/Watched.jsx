import { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios.js";
import { Heart, EyeOff, LayoutGrid, GalleryVertical } from "lucide-react";
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';

const TYPE_FILTERS = [
  { key: "all", label: "All titles" },
  { key: "movie", label: "Movies" },
  { key: "series", label: "Series" },
];

// Extracted EmblaCarousel component
function EmblaCarousel({ items, renderCard }) {
  // Using useMemo ensures the plugin is instantiated exactly once per carousel instance
  // This prevents shared-plugin crashes, and prevents infinite initialization loops.
  const plugins = useMemo(() => [
    Autoplay({ delay: 4000, stopOnInteraction: true, stopOnMouseEnter: true })
  ], []);

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

  return (
    <div className="embla-carousel">
      <button className="embla-arrow left" onClick={scrollPrev}>‹</button>

      <div className="embla-viewport" ref={emblaRef}>
        <div className="embla-container">
          {items.map((item) => (
            <div key={item.tmdb_id} className="embla-slide">
              {renderCard(item)}
            </div>
          ))}
        </div>
      </div>

      <button className="embla-arrow right" onClick={scrollNext}>›</button>
    </div>
  );
}

export default function WatchedPage() {
  const [items, setItems] = useState([]);
  const [availableGenres, setAvailableGenres] = useState([]);

  const [loading, setLoading] = useState(true);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sort = searchParams.get("sort") || "";
  const type = searchParams.get("type") || "all";
  const genre = searchParams.get("genre") || "all";

  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");

  function normalizeGenreNames(genres) {
    if (!Array.isArray(genres)) return [];
    return genres
      .map(g => typeof g === "string" ? g : g?.name)
      .filter(Boolean);
  }

  function formatGenres(genres) {
    const names = normalizeGenreNames(genres);
    return names.length ? names.slice(0, 3).join(" • ") : "";
  }

  async function hydrateItemGenres(sourceItems) {
    return Promise.all(
      sourceItems.map(async (item) => {
        const existingGenres = normalizeGenreNames(item.genres);
        if (existingGenres.length > 0) {
          return { ...item, genres: existingGenres };
        }

        try {
          const detailsRes = await api.get(`/tmdb/details/${item.type}/${item.tmdb_id}`);
          const detailedGenres = normalizeGenreNames(detailsRes.data?.genres);
          return { ...item, genres: detailedGenres };
        } catch {
          return { ...item, genres: [] };
        }
      })
    );
  }

  function renderCard(item) {
    return (
      <div key={item.tmdb_id} className="media-card">
        <Link
          to={`/media/${item.type}/${item.tmdb_id}`}
          className="media-image-wrapper"
        >
          <img
            src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
            className="media-card-img"
          />

          <div className="hover-controls">
            <div className="hover-title">
              <span className="hover-title-text">{item.title}</span>
              <span className="hover-year-text">{item.release_year}</span>
              {formatGenres(item.genres) && (
                <span className="hover-genres-text">{formatGenres(item.genres)}</span>
              )}

              <div className="rating-inline">
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <span
                    key={n}
                    className={item.rating >= n ? "star active" : "star"}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRate(item, n);
                    }}
                  >
                    ★
                  </span>
                ))}
                {item.rating && (
                  <span className="rating-label">{item.rating}/10</span>
                )}
              </div>
            </div>

            <div className="control-icons">
              <span
                className={`favorite-icon ${item.is_favorite ? "active" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  item.is_favorite ? handleUnfavorite(item) : handleFavorite(item);
                }}
              >
                <Heart size={32} />
              </span>

              <span
                className="watched-icon active"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRemove(item);
                }}
              >
                <EyeOff size={32} />
              </span>
            </div>
          </div>
        </Link>
      </div>
    );
  }

  useEffect(() => {
    load();
  }, [sort, type]);

  async function load() {
    try {
      const [itemsRes, genresRes] = await Promise.all([
        api.get("/media/watched", {
        params: {
          sort: sort || undefined,
          type: type !== "all" ? type : undefined
        }
        }),
        api.get("/media/watched")
      ]);

      const hydratedItems = await hydrateItemGenres(itemsRes.data.items || []);

      const mergedGenres = Array.from(
        new Set([
          ...(genresRes.data.genres || []),
          ...hydratedItems.flatMap(item => normalizeGenreNames(item.genres))
        ])
      ).sort((a, b) => a.localeCompare(b));

      setItems(hydratedItems);
      setAvailableGenres(mergedGenres);

    } catch (err) {
      console.error("Watched load error:", err);
    } finally {
      setLoading(false);
    }
  }

  function updateQuery(newSort, newType, newGenre) {
    const params = new URLSearchParams();
    if (newSort) params.set("sort", newSort);
    if (newType && newType !== "all") params.set("type", newType);
    if (newGenre && newGenre !== "all") params.set("genre", newGenre);
    navigate(`/watched?${params.toString()}`);
  }

  function handleSortChange(e) {
    updateQuery(e.target.value, type, genre);
  }

  function handleTypeChange(e) {
    updateQuery(sort, e.target.value, genre);
  }

  function handleGenreChange(e) {
    updateQuery(sort, type, e.target.value);
  }

  function applySortToItems(itemsToSort) {
    if (sort === "title_asc") {
      return itemsToSort.slice().sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }
    if (sort === "title_desc") {
      return itemsToSort.slice().sort((a, b) => (b.title || "").localeCompare(a.title || ""));
    }
    if (sort === "year_asc") {
      return itemsToSort.slice().sort((a, b) => (a.release_year || 0) - (b.release_year || 0));
    }
    if (sort === "year_desc") {
      return itemsToSort.slice().sort((a, b) => (b.release_year || 0) - (a.release_year || 0));
    }
    return itemsToSort;
  }

  async function handleRemove(item) {
    try {
      await api.delete(`/media/${item.tmdb_id}/watched`, {
        data: { type: item.type }
      });
      setItems(prev => prev.filter(i => i.tmdb_id !== item.tmdb_id));
    } catch (err) {}
  }

  async function handleRate(item, rating) {
    try {
      await api.post(`/media/${item.tmdb_id}/rating`, {
        type: item.type,
        rating
      });
      setItems(prev =>
        prev.map(i => i.tmdb_id === item.tmdb_id ? { ...i, rating } : i)
      );
    } catch (err) {}
  }

  async function handleFavorite(item) {
    try {
      await api.post(`/media/${item.tmdb_id}/favorite`, {
        type: item.type
      });
      setItems(prev =>
        prev.map(i => i.tmdb_id === item.tmdb_id ? { ...i, is_favorite: true } : i)
      );
    } catch (err) {}
  }

  async function handleUnfavorite(item) {
    try {
      await api.delete(`/media/${item.tmdb_id}/favorite`, {
        data: { type: item.type }
      });
      setItems(prev =>
        prev.map(i => i.tmdb_id === item.tmdb_id ? { ...i, is_favorite: false } : i)
      );
    } catch (err) {}
  }

  if (loading) return <div>Loading watched history...</div>;

  const isRatingSort = sort === "rating_desc" || sort === "rating_asc";

  // Group items by rating
  const grouped = {
    1: [], 2: [], 3: [], 4: [], 5: [],
    6: [], 7: [], 8: [], 9: [], 10: [],
    unrated: []
  };

  let filteredItems = genre === "all"
  ? items
  : items.filter(item =>
      Array.isArray(item.genres) &&
      item.genres.includes(genre)
    );

  filteredItems = filteredItems.filter(item =>
    !searchQuery.trim() ||
    item.title?.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  filteredItems = applySortToItems(filteredItems);
  const titlesCountLabel = `${filteredItems.length} title${filteredItems.length === 1 ? "" : "s"}`;

  filteredItems.forEach(item => {
    if (!item.rating) grouped.unrated.push(item);
    else grouped[item.rating].push(item);
  });

  const orderDesc = [10,9,8,7,6,5,4,3,2,1,"unrated"];
  const orderAsc = [1,2,3,4,5,6,7,8,9,10,"unrated"];
  const activeOrder = sort === "rating_desc" ? orderDesc : orderAsc;

  return (
    <div className="page-container library-page watched-explore-page">
      <section className="watched-hero-shell">
        <div className="library-page-head">
          <div>
            <p className="watched-hero-kicker">Library</p>
            <h1 className="library-page-title">Watched</h1>
          </div>
          <div className="library-page-head-actions">
            <div className="library-type-filter-row" role="tablist" aria-label="Watched type filter">
              {TYPE_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={`library-type-filter-chip ${type === filter.key ? "active" : ""}`}
                  onClick={() => handleTypeChange({ target: { value: filter.key } })}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <span className="library-page-count">{titlesCountLabel}</span>
          </div>
        </div>

        <div className="filter-bar watched-filter-bar">

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

          <input
            type="text"
            className="filter-search-input"
            placeholder="Search titles…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div>
            <label className="filter-label">Sort:</label>
            <select value={sort} onChange={handleSortChange} className="filter-select">
              <option value="">None</option>
              <option value="title_asc">Title A–Z</option>
              <option value="title_desc">Title Z–A</option>
              <option value="year_asc">Released: Oldest First</option>
              <option value="year_desc">Released: Newest First</option>
              <option value="rating_desc">Rating Descending</option>
              <option value="rating_asc">Rating Ascending</option>
            </select>
          </div>

          <div>
            <label className="filter-label">Genre:</label>
            <select
              value={genre}
              onChange={handleGenreChange}
              className="filter-select"
            >
              <option value="all">All</option>
              {availableGenres.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="watched-content-shell">
        {items.length === 0 && <p>You haven't watched anything yet.</p>}

        {/* GROUPED MODE */}
        {isRatingSort && (
          <div className="rating-groups">
            {activeOrder.map(key => {
              const bucket = grouped[key];
              if (!bucket || bucket.length === 0) return null;

            const title = key === "unrated"
              ? "Unrated"
              : (
                  <>
                    {key}/10 <span className="star active">★</span>
                  </>
                );
              return (
                <div key={key} className="rating-section">
                  <h2 className="rating-section-title">{title}</h2>

                {viewMode === "grid" ? (
                  <div className="media-grid">
                    {bucket.map(item => renderCard(item))}
                  </div>
                ) : (
                  <EmblaCarousel items={bucket} renderCard={renderCard} />
                )}
                </div>
              );
            })}
          </div>
        )}

        {/* NON-GROUPED MODE */}
        {!isRatingSort && (
          <>
            {viewMode === "grid" && (
              <div className="media-grid">
                {filteredItems.map(item => renderCard(item))}
              </div>
            )}

            {viewMode === "tape" && (
              <EmblaCarousel items={filteredItems} renderCard={renderCard} />
            )}
          </>
        )}
      </section>
    </div>
  );
}
