import { useEffect, useState, useMemo } from "react";
import api from "../api/axios.js";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Trash, Eye, LayoutGrid, GalleryVertical } from "lucide-react";
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


export default function WatchlistPage() {
  const [items, setItems] = useState([]);
  const [availableGenres, setAvailableGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState("all");

  const [loading, setLoading] = useState(true);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const type = searchParams.get("type") || "all";
  const genre = searchParams.get("genre") || "all";

  const [viewMode, setViewMode] = useState("grid"); 
  // "grid" | "tape"

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
  }, [type, genre]);

  async function load() {
    try {
      const res = await api.get("/media/watchlist", {
        params: {
          type: type !== "all" ? type : undefined
        }
      });

      setItems(res.data.items);
      setAvailableGenres(res.data.genres || []);

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
    navigate(`/watchlist?${params.toString()}`);
  }

  function handleGenreChange(e) {
    setSelectedGenre(e.target.value);
    updateQuery(sort, favorites, type, e.target.value);
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

  const filteredItems = selectedGenre === "all"
    ? items
    : items.filter(item =>
        Array.isArray(item.genres) &&
        item.genres.includes(selectedGenre)
      );


  return (
    <div className="page-container">
      <h1>Watchlist</h1>

      {/* TYPE FILTER */}
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

        <div>
          <label className="filter-label">Type:</label>
          <select
            value={type}
            onChange={(e) => updateQuery(e.target.value)}
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
            value={selectedGenre}
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
        <EmblaCarousel items={filteredItems} renderCard={renderCard} />
      )}
    </div>
  );
}
