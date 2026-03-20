import { useEffect, useState, useMemo } from "react";
import api from "../api/axios.js";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Trash, Eye, LayoutGrid, GalleryVertical } from "lucide-react";
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';

const TYPE_FILTERS = [
  { key: "all", label: "All titles" },
  { key: "movie", label: "Movies" },
  { key: "series", label: "Series" },
];

// Extracted EmblaCarousel component
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

  const [viewMode, setViewMode] = useState("grid"); 
  // "grid" | "tape"
  const [searchQuery, setSearchQuery] = useState("");

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

          {/* HOVER OVERLAY */}
          <div className="hover-controls">

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
  }

  useEffect(() => {
    load();
  }, [type]);

  async function load() {
    try {
      const [itemsRes, genresRes] = await Promise.all([
        api.get("/media/watchlist", {
        params: {
          type: type !== "all" ? type : undefined
        }
        }),
        api.get("/media/watchlist")
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
      console.error("Watchlist load error:", err);
    } finally {
      setLoading(false);
    }
  }

  function updateQuery(newType, newGenre) {
    const params = new URLSearchParams();
    if (newType !== "all") params.set("type", newType);
    if (newGenre && newGenre !== "all") params.set("genre", newGenre);
    if (sort) params.set("sort", sort);
    navigate(`/watchlist?${params.toString()}`);
  }

  function updateQueryWithSort(newSort, newType, newGenre) {
    const params = new URLSearchParams();
    if (newSort) params.set("sort", newSort);
    if (newType !== "all") params.set("type", newType);
    if (newGenre && newGenre !== "all") params.set("genre", newGenre);
    navigate(`/watchlist?${params.toString()}`);
  }

  function handleSortChange(e) {
    updateQueryWithSort(e.target.value, type, genre);
  }

  function handleTypeChange(e) {
    updateQueryWithSort(sort, e.target.value, genre);
  }

  function handleGenreChange(e) {
    updateQueryWithSort(sort, type, e.target.value);
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
      await api.delete(`/media/${item.tmdb_id}/watchlist`, {
        data: { type: item.type }
      });

      setItems(prev => prev.filter(i => i.tmdb_id !== item.tmdb_id));
    } catch (err) {
      console.error("Remove watchlist error:", err);
    }
  }

  async function handleMoveToWatched(item) {
    try {
      await api.post(`/media/${item.tmdb_id}/watchlist-to-watched`, {
        type: item.type
      });

      setItems(prev => prev.filter(i => i.tmdb_id !== item.tmdb_id));
    } catch (err) {
      console.error("Move to watched error:", err);
    }
  }

  if (loading) {
    return <div>Loading watchlist...</div>;
  }

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


  return (
    <div className="page-container library-page library-explore-page">
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

        {/* TYPE FILTER */}
        <div className="filter-bar library-filter-bar">
        
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

      <section className="library-content-shell">
        {items.length === 0 && (
          <p>Your watchlist is empty.</p>
        )}

        {/* GRID VIEW */}
        {viewMode === "grid" && !isMobileView && (
          <div className="media-grid">
            {filteredItems.map(item => renderCard(item))}
          </div>
        )}

        {/* TAPE VIEW */}
        {(viewMode === "tape" || isMobileView) && (
          <EmblaCarousel items={filteredItems} renderCard={renderCard} />
        )}
      </section>
    </div>
  );
}
