import { useEffect, useState, useRef, useMemo, Fragment } from "react";
import { createPortal } from "react-dom";
import api from "../api/axios.js";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Trash, Eye, LayoutGrid, GalleryVertical, X } from "lucide-react";
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import "../styles/filters.css";
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


export default function WatchlistPage() {
  const [items, setItems] = useState([]);
  const [availableGenres, setAvailableGenres] = useState([]);
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 760px)").matches;
  });

  const [loading, setLoading] = useState(true);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const type = searchParams.get("type") || "all";
  const sort = searchParams.get("sort") || "";
  const genre = searchParams.get("genre") || "all";
  const search = searchParams.get("search") || "";
  const page = Math.max(Number.parseInt(searchParams.get("page") || "1", 10) || 1, 1);

  const [viewMode, setViewMode] = useState("grid"); 
  // "grid" | "tape"
  const [searchQuery, setSearchQuery] = useState(search);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [expandedCardKey, setExpandedCardKey] = useState(null);

  useEffect(() => {
    if (isMobileView && expandedCardKey) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isMobileView, expandedCardKey]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [isLoadingMore, setIsLoadingMore] = useState(false);

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
    const card = (
      <div className={`media-card ${isExpanded ? "mobile-card-expanded" : ""}`}>

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

          {/* HOVER OVERLAY */}
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

            {/* TITLE + YEAR — TOP LEFT */}
            <div className="hover-title">
              <span className="hover-title-text">{item.title}</span>
              <span className="hover-year-text">{item.release_year}</span>
              {formatGenres(item.genres) && (
                <span className="hover-genres-text">{formatGenres(item.genres)}</span>
              )}
            </div>

            {/* ICONS — BOTTOM RIGHT */}
            <div className="control-icons">
              
              {/* MOVE TO WATCHED */}
              <span
                className="watched-icon"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleMoveToWatched(item);
                }}
                title="Move to watched"
              >
                <Eye size={32} />
              </span>

              {/* REMOVE FROM WATCHLIST */}
              <span
                className="watched-icon"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRemove(item);
                }}
                title="Remove from watchlist"
              >
                <Trash size={32} />
              </span>

            </div>

          </div>
        </Link>

      </div>
    );
    if (isExpanded) {
      return (
        <Fragment key={item.tmdb_id}>
          <div className="media-card"><div className="media-image-wrapper"><img src={`https://image.tmdb.org/t/p/w300${item.poster_path}`} className="media-card-img" style={{opacity:0.3}} width="300" height="450" /></div></div>
          {createPortal(card, document.body)}
        </Fragment>
      );
    }
    return <Fragment key={item.tmdb_id}>{card}</Fragment>;
  }

  useEffect(() => {
    load();
  }, [type, sort, genre, search, page, viewMode]);

  async function load() {
    setLoading(true);
    try {
      const params = {
        type: type !== "all" ? type : undefined,
        sort: sort || undefined,
        genre: genre !== "all" ? genre : undefined,
        search: search || undefined,
        page: viewMode === "tape" ? 1 : page,
        limit: PAGE_SIZE,
      };
      const itemsRes = await api.get("/media/watchlist", { params });
      const loadedItems = itemsRes.data?.items || [];
      setItems(loadedItems);
      setAvailableGenres(itemsRes.data?.genres || []);
      setPagination(itemsRes.data?.pagination || { page: 1, limit: PAGE_SIZE, total: loadedItems.length, totalPages: 1 });
    } catch (err) {
      console.error("Watchlist load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (isLoadingMore || pagination.page >= pagination.totalPages) return;
    setIsLoadingMore(true);
    try {
      const nextPage = pagination.page + 1;
      const itemsRes = await api.get("/media/watchlist", {
        params: {
          type: type !== "all" ? type : undefined,
          sort: sort || undefined,
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
      console.error("Watchlist load more error:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }

  function updateQueryWithSort(newSort, newType, newGenre, newSearch = "", newPage = 1) {
    const params = new URLSearchParams();
    if (newSort) params.set("sort", newSort);
    if (newType !== "all") params.set("type", newType);
    if (newGenre && newGenre !== "all") params.set("genre", newGenre);
    if (newSearch.trim()) params.set("search", newSearch.trim());
    if (newPage > 1) params.set("page", String(newPage));
    navigate(`/watchlist?${params.toString()}`);
  }

  function handleSortChange(e) {
    updateQueryWithSort(e.target.value, type, genre, searchQuery, 1);
  }

  function handleTypeChange(e) {
    updateQueryWithSort(sort, e.target.value, genre, searchQuery, 1);
  }

  function handleGenreChange(e) {
    updateQueryWithSort(sort, type, e.target.value, searchQuery, 1);
  }

  function handlePageChange(nextPage) {
    if (nextPage < 1 || nextPage > pagination.totalPages) {
      return;
    }

    updateQueryWithSort(sort, type, genre, searchQuery, nextPage);
  }

  function handleSearchInputChange(e) {
    const nextValue = e.target.value;
    setSearchQuery(nextValue);
    updateQueryWithSort(sort, type, genre, nextValue, 1);
  }

  function handleRemove(item) {
    setItems(prev => prev.filter(i => i.tmdb_id !== item.tmdb_id));
    api.delete(`/media/${item.tmdb_id}/watchlist`, {
      data: { type: item.type }
    }).catch((err) => {
      console.error("Remove watchlist error:", err);
      setItems(prev => [...prev, item]);
    });
  }

  function handleMoveToWatched(item) {
    setItems(prev => prev.filter(i => i.tmdb_id !== item.tmdb_id));
    api.post(`/media/${item.tmdb_id}/watchlist-to-watched`, {
      type: item.type
    }).catch((err) => {
      console.error("Move to watched error:", err);
      setItems(prev => [...prev, item]);
    });
  }

  if (loading) {
    return <div>Loading watchlist...</div>;
  }

  const filteredItems = items;
  const titlesCountLabel = `${pagination.total} total`;


  return (
    <div
      className="page-container library-page library-explore-page"
      onClick={(e) => {
        if (isMobileView && expandedCardKey && e.target === e.currentTarget) {
          setExpandedCardKey(null);
        }
      }}
    >
      <section className="library-hero-shell">
        <div className="library-page-head">
          <div>
            <p className="library-hero-kicker">Library</p>
            <h1 className="library-page-title">Watchlist</h1>
          </div>
          <div className="library-page-head-actions">
            <div className="library-type-filter-row" role="tablist" aria-label="Watchlist type filter">
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
            aria-controls="watchlist-mobile-filters"
          >
            {isMobileFiltersOpen ? "Hide Filters" : "Filters"}
          </button>
        )}

        {/* TYPE FILTER */}
        {(!isMobileView || isMobileFiltersOpen) && (
        <div id="watchlist-mobile-filters" className="filter-bar library-filter-bar">
        
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

        {viewMode === "grid" && (
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

      <section className="library-content-shell">
        {items.length === 0 && (
          <p>Your watchlist is empty.</p>
        )}

        {/* GRID VIEW */}
        {viewMode === "grid" && (
          <div className="media-grid">
            {filteredItems.map(item => renderCard(item))}
          </div>
        )}

        {/* TAPE VIEW */}
        {viewMode === "tape" && (
          <EmblaCarousel
            items={filteredItems}
            renderCard={renderCard}
            canLoadMore={pagination.page < pagination.totalPages}
            onLoadMore={loadMore}
          />
        )}
      </section>

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
