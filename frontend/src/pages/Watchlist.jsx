import { useEffect, useState, useRef } from "react";
import api from "../api/axios.js";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Trash, Eye, LayoutGrid, GalleryVertical } from "lucide-react";

export default function WatchlistPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const type = searchParams.get("type") || "all";

  const [viewMode, setViewMode] = useState("grid"); 
  // "grid" | "tape"

  const scrollRef = useRef(null);

  function scrollLeft() {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -600, behavior: "smooth" });
    }
  }

  function scrollRight() {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 600, behavior: "smooth" });
    }
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
      const res = await api.get("/media/watchlist", {
        params: {
          type: type !== "all" ? type : undefined
        }
      });

      setItems(res.data);
    } catch (err) {
      console.error("Watchlist load error:", err);
    } finally {
      setLoading(false);
    }
  }

  function updateType(newType) {
    const params = new URLSearchParams();
    if (newType !== "all") params.set("type", newType);
    navigate(`/watchlist?${params.toString()}`);
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
            onChange={(e) => updateType(e.target.value)}
            className="filter-select"
          >
            <option value="all">All</option>
            <option value="movie">Movies</option>
            <option value="series">Shows</option>
          </select>
        </div>
      </div>

      {items.length === 0 && (
        <p>Your watchlist is empty.</p>
      )}

      {/* GRID VIEW */}
      {viewMode === "grid" && (
        <div className="media-grid">
          {items.map(item => renderCard(item))}
        </div>
      )}

      {/* TAPE VIEW */}
      {viewMode === "tape" && (
        <div className="tape-wrapper">

          <button className="tape-arrow left" onClick={scrollLeft}>‹</button>

          <div className="tape-scroll" ref={scrollRef}>
            <div className="media-tape">
              {items.map(item => renderCard(item))}
            </div>
          </div>

          <button className="tape-arrow right" onClick={scrollRight}>›</button>

        </div>
      )}
    </div>
  );
}
