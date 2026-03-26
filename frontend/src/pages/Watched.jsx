import { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axios.js";
import { Heart, EyeOff, LayoutGrid, GalleryVertical, X } from "lucide-react";
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import "../styles/filters.css";
import "../styles/rating.css";
import "../styles/buttons.css";
import "../styles/media-grid.css";
import "../styles/media-card.css";
import "../styles/embla-carousel.css";

const TYPE_FILTERS = [
  { key: "all", label: "All titles" },
  { key: "movie", label: "Movies" },
  { key: "series", label: "Series" },
];

const PAGE_SIZE = 24;
const BUCKET_INITIAL_GRID = 8;
const BUCKET_INITIAL_TAPE = 20;

// Extracted EmblaCarousel component
function EmblaCarousel({ items, renderCard, canLoadMore = false, onLoadMore }) {
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

  const plugins = useMemo(() => autoplayEnabled
    ? [Autoplay({ delay: 4000, stopOnInteraction: true, stopOnMouseEnter: true })]
    : [], [autoplayEnabled]);

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

  const prevItemsLengthRef = useRef(items.length);
  useEffect(() => {
    if (emblaApi && items.length !== prevItemsLengthRef.current) {
      prevItemsLengthRef.current = items.length;
      emblaApi.reInit();
    }
  }, [emblaApi, items.length]);

  const [isAtEnd, setIsAtEnd] = useState(false);
  useEffect(() => {
    if (!emblaApi) return;
    const update = () => setIsAtEnd(!emblaApi.canScrollNext());
    update();
    emblaApi.on('select', update);
    emblaApi.on('reInit', update);
    return () => {
      emblaApi.off('select', update);
      emblaApi.off('reInit', update);
    };
  }, [emblaApi]);

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

      {isAtEnd && canLoadMore && onLoadMore && (
        <div className="embla-load-more-overlay">
          <button
            type="button"
            className="embla-load-more-btn"
            onClick={onLoadMore}
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}

export default function WatchedPage() {
  const [items, setItems] = useState([]);
  const [availableGenres, setAvailableGenres] = useState([]);
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 760px)").matches;
  });

  const [loading, setLoading] = useState(true);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sort = searchParams.get("sort") || "";
  const type = searchParams.get("type") || "all";
  const genre = searchParams.get("genre") || "all";
  const search = searchParams.get("search") || "";
  const page = Math.max(Number.parseInt(searchParams.get("page") || "1", 10) || 1, 1);

  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState(search);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [expandedCardKey, setExpandedCardKey] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [bucketVisible, setBucketVisible] = useState({});

  useEffect(() => {
    setSearchQuery(search);
  }, [search]);

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

  function renderCard(item) {
    const itemKey = `${item.type}-${item.tmdb_id}`;
    const isExpanded = isMobileView && expandedCardKey === itemKey;
    return (
      <div key={item.tmdb_id} className={`media-card ${isExpanded ? "mobile-card-expanded" : ""}`}>
        <Link
          to={`/media/${item.type}/${item.tmdb_id}`}
          className="media-image-wrapper"
          onClick={(e) => {
            if (isMobileView && !isExpanded) {
              e.preventDefault();
              setExpandedCardKey(itemKey);
            }
          }}
        >
          <img
            src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
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
                e.preventDefault();
                e.stopPropagation();
                setExpandedCardKey(null);
              }}
              aria-label="Close expanded card"
            >
              <X size={18} />
            </button>

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
  }, [sort, type, genre, search, page, viewMode]);

  async function load() {
    setLoading(true);
    setBucketVisible({});
    const isTapeMode = viewMode === "tape" || isMobileView;
    const isRatingMode = sort === "rating_desc" || sort === "rating_asc";
    try {
      const params = {
        sort: sort || undefined,
        type: type !== "all" ? type : undefined,
        genre: genre !== "all" ? genre : undefined,
        search: search || undefined,
      };
      if (!isRatingMode) {
        params.page = isTapeMode ? 1 : page;
        params.limit = PAGE_SIZE;
      }
      const itemsRes = await api.get("/media/watched", { params });
      const loadedItems = itemsRes.data?.items || [];
      setItems(loadedItems);
      setAvailableGenres(itemsRes.data?.genres || []);
      setPagination(
        itemsRes.data?.pagination ||
        { page: 1, limit: loadedItems.length, total: loadedItems.length, totalPages: 1 }
      );
    } catch (err) {
      console.error("Watched load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (isLoadingMore || pagination.page >= pagination.totalPages) return;
    setIsLoadingMore(true);
    try {
      const nextPage = pagination.page + 1;
      const itemsRes = await api.get("/media/watched", {
        params: {
          sort: sort || undefined,
          type: type !== "all" ? type : undefined,
          genre: genre !== "all" ? genre : undefined,
          search: search || undefined,
          page: nextPage,
          limit: PAGE_SIZE,
        }
      });
      const newItems = itemsRes.data?.items || [];
      setItems(prev => [...prev, ...newItems]);
      setPagination(
        itemsRes.data?.pagination ||
        { page: nextPage, limit: PAGE_SIZE, total: 0, totalPages: 1 }
      );
    } catch (err) {
      console.error("Watched load more error:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }

  function loadMoreBucket(key) {
    const isTape = viewMode === "tape" || isMobileView;
    const initial = isTape ? BUCKET_INITIAL_TAPE : BUCKET_INITIAL_GRID;
    setBucketVisible(prev => ({
      ...prev,
      [key]: (prev[key] ?? initial) + initial,
    }));
  }

  function updateQuery(newSort, newType, newGenre, newSearch = "", newPage = 1) {
    const params = new URLSearchParams();
    if (newSort) params.set("sort", newSort);
    if (newType && newType !== "all") params.set("type", newType);
    if (newGenre && newGenre !== "all") params.set("genre", newGenre);
    if (newSearch.trim()) params.set("search", newSearch.trim());
    if (newPage > 1) params.set("page", String(newPage));
    navigate(`/watched?${params.toString()}`);
  }

  function handleSortChange(e) {
    updateQuery(e.target.value, type, genre, searchQuery, 1);
  }

  function handleTypeChange(e) {
    updateQuery(sort, e.target.value, genre, searchQuery, 1);
  }

  function handleGenreChange(e) {
    updateQuery(sort, type, e.target.value, searchQuery, 1);
  }

  function handlePageChange(nextPage) {
    if (nextPage < 1 || nextPage > pagination.totalPages) {
      return;
    }

    updateQuery(sort, type, genre, searchQuery, nextPage);
  }

  function handleSearchInputChange(e) {
    const nextValue = e.target.value;
    setSearchQuery(nextValue);
    updateQuery(sort, type, genre, nextValue, 1);
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

  const filteredItems = items;
  const titlesCountLabel = `${pagination.total} total`;

  filteredItems.forEach(item => {
    if (!item.rating) grouped.unrated.push(item);
    else grouped[item.rating].push(item);
  });

  const orderDesc = [10,9,8,7,6,5,4,3,2,1,"unrated"];
  const orderAsc = [1,2,3,4,5,6,7,8,9,10,"unrated"];
  const activeOrder = sort === "rating_desc" ? orderDesc : orderAsc;

  return (
    <div
      className="page-container library-page watched-explore-page"
      onClick={(e) => {
        if (isMobileView && expandedCardKey && e.target === e.currentTarget) {
          setExpandedCardKey(null);
        }
      }}
    >
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

        {isMobileView && (
          <button
            type="button"
            className={`library-mobile-filter-toggle ${isMobileFiltersOpen ? "active" : ""}`}
            onClick={() => setIsMobileFiltersOpen((prev) => !prev)}
            aria-expanded={isMobileFiltersOpen}
            aria-controls="watched-mobile-filters"
          >
            {isMobileFiltersOpen ? "Hide Filters" : "Filters"}
          </button>
        )}

        {(!isMobileView || isMobileFiltersOpen) && (
        <div id="watched-mobile-filters" className="filter-bar watched-filter-bar">

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

          <input
            type="text"
            className="filter-search-input"
            placeholder="Search titles…"
            value={searchQuery}
            onChange={handleSearchInputChange}
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
        )}

        {!isRatingSort && viewMode === "grid" && !isMobileView && (
          <div className="library-pagination-row">
            <button
              type="button"
              className="library-pagination-btn"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </button>
            <span className="library-pagination-label">Page {pagination.page} of {pagination.totalPages}</span>
            <button
              type="button"
              className="library-pagination-btn"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= pagination.totalPages}
            >
              Next
            </button>
          </div>
        )}
      </section>

      <section className="watched-content-shell">
        {items.length === 0 && <p>You haven't watched anything yet.</p>}

        {/* GROUPED MODE */}
        {isRatingSort && (
          <div className="rating-groups">
            {activeOrder.map(key => {
              const bucket = grouped[key];
              if (!bucket || bucket.length === 0) return null;

              const isTape = viewMode === "tape" || isMobileView;
              const initial = isTape ? BUCKET_INITIAL_TAPE : BUCKET_INITIAL_GRID;
              const visCount = bucketVisible[key] ?? initial;
              const visibleItems = bucket.slice(0, visCount);
              const hasMore = bucket.length > visCount;

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

                {viewMode === "grid" && !isMobileView ? (
                  <>
                    <div className="media-grid">
                      {visibleItems.map(item => renderCard(item))}
                    </div>
                    {hasMore && (
                      <div className="library-pagination-row" style={{ justifyContent: "center", marginTop: "16px" }}>
                        <button
                          type="button"
                          className="library-pagination-btn"
                          onClick={() => loadMoreBucket(key)}
                        >
                          Load More
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <EmblaCarousel
                    items={visibleItems}
                    renderCard={renderCard}
                    canLoadMore={hasMore}
                    onLoadMore={() => loadMoreBucket(key)}
                  />
                )}
                </div>
              );
            })}
          </div>
        )}

        {/* NON-GROUPED MODE */}
        {!isRatingSort && (
          <>
            {viewMode === "grid" && !isMobileView && (
              <div className="media-grid">
                {filteredItems.map(item => renderCard(item))}
              </div>
            )}

            {(viewMode === "tape" || isMobileView) && (
              <EmblaCarousel
                items={filteredItems}
                renderCard={renderCard}
                canLoadMore={pagination.page < pagination.totalPages}
                onLoadMore={loadMore}
              />
            )}
          </>
        )}
      </section>

      {isMobileView && expandedCardKey && (
        <div
          className="mobile-card-backdrop"
          onClick={() => setExpandedCardKey(null)}
        />
      )}
    </div>
  );
}
