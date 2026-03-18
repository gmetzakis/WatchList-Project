import { useEffect, useState, useMemo } from "react";
import api from "../api/axios.js";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Heart, Eraser, EyeOff, LayoutGrid, GalleryVertical } from "lucide-react";
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';

// Extracted EmblaCarousel component
function EmblaCarousel({ items, renderCard }) {
  // Using useMemo ensures the plugin is instantiated exactly once per carousel instance
  const plugins = useMemo(() => [
    Autoplay({ delay: 4000, stopOnInteraction: true, stopOnMouseEnter: true })
  ], []);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: false,
      align: 'start',
      slidesToScroll: 3,
      breakpoints: {
        '(min-width: 768px)': { slidesToScroll: 4 },
        '(min-width: 1024px)': { slidesToScroll: 5 }
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

export default function FavoritesPage() {
  const [items, setItems] = useState([]);
  const [availableGenres, setAvailableGenres] = useState([]);

  const [loading, setLoading] = useState(true);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sort = searchParams.get("sort") || "";
  const type = searchParams.get("type") || "all";
  const genre = searchParams.get("genre") || "all";

  const [viewMode, setViewMode] = useState("grid"); 
  // "grid" | "tape"
  const [searchQuery, setSearchQuery] = useState("");

  function normalizeGenreNames(genres) {
    if (!Array.isArray(genres)) return [];
    return genres
      .map(g => typeof g === "string" ? g : g?.name)
      .filter(Boolean);
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

              {/* INLINE RATING */}
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

            {/* ICONS — BOTTOM RIGHT */}
            <div className="control-icons">

              {/* REMOVE FROM FAVORITES */}
              <span
                className="favorite-icon active"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRemoveFavorite(item);
                }}
                title="Remove from favorites"
              >
                <Heart size={32} />
              </span>

              {/* REMOVE FROM WATCHED */}
              <span
                className="watched-icon"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRemoveWatched(item);
                }}
                title="Remove from watched"
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
        api.get("/media/favorites", {
        params: {
          sort: sort || undefined,
          type: type !== "all" ? type : undefined
        }
        }),
        api.get("/media/favorites")
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
      console.error("Favorites load error:", err);
    } finally {
      setLoading(false);
    }
  }

  function updateQuery(newSort, newType, newGenre) {
    const params = new URLSearchParams();

    if (newSort) params.set("sort", newSort);
    if (newType && newType !== "all") params.set("type", newType);
    if (newGenre && newGenre !== "all") params.set("genre", newGenre);

    navigate(`/favorites?${params.toString()}`);
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

  async function handleRemoveFavorite(item) {
    try {
      await api.delete(`/media/${item.tmdb_id}/favorite`, {
        data: { type: item.type }
      });

      setItems(prev => prev.filter(i => i.tmdb_id !== item.tmdb_id));
    } catch (err) {
      console.error("Unfavorite error:", err);
    }
  }

  async function handleRate(item, rating) {
    try {
      await api.post(`/media/${item.tmdb_id}/rating`, {
        type: item.type,
        rating
      });

      setItems(prev =>
        prev.map(i =>
          i.tmdb_id === item.tmdb_id ? { ...i, rating } : i
        )
      );
    } catch (err) {
      console.error("Rate error:", err);
    }
  }

  async function handleRemoveRating(item) {
    try {
      await api.delete(`/media/${item.tmdb_id}/rating`, {
        data: { type: item.type }
      });

      setItems(prev =>
        prev.map(i =>
          i.tmdb_id === item.tmdb_id ? { ...i, rating: null } : i
        )
      );
    } catch (err) {
      console.error("Remove rating error:", err);
    }
  }

  async function handleRemoveWatched(item) {
    try {
      await api.delete(`/media/${item.tmdb_id}/watched`, {
        data: { type: item.type }
      });

      setItems(prev => prev.filter(i => i.tmdb_id !== item.tmdb_id));
    } catch (err) {
      console.error("Remove watched error:", err);
    }
  }

  if (loading) {
    return <div>Loading favorites...</div>;
  }

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

  filteredItems.forEach(item => {
    if (!item.rating) grouped.unrated.push(item);
    else grouped[item.rating].push(item);
  });

  const orderDesc = [10,9,8,7,6,5,4,3,2,1,"unrated"];
  const orderAsc = [1,2,3,4,5,6,7,8,9,10,"unrated"];
  const activeOrder = sort === "rating_desc" ? orderDesc : orderAsc;

  return (
    <div className="page-container">
      <h1>Favorites</h1>

      {/* FILTER BAR */}
      <div className="filter-bar">

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
          <select
            value={sort}
            onChange={handleSortChange}
            className="filter-select"
          >
            <option value="">None</option>
            <option value="title_asc">Title A–Z</option>
            <option value="title_desc">Title Z–A</option>
            <option value="year_asc">Year ↓</option>
            <option value="year_desc">Year ↑</option>
            <option value="rating_desc">Rating ↓</option>
            <option value="rating_asc">Rating ↑</option>
          </select>
        </div>

        <div>
          <label className="filter-label">Type:</label>
          <select
            value={type}
            onChange={handleTypeChange}
            className="filter-select"
          >
            <option value="all">All</option>
            <option value="movie">Movies</option>
            <option value="series">Shows</option>
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

      {items.length === 0 && (
        <p>You have no favorite movies or series yet.</p>
      )}

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
    </div>
  );
}
