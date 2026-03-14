import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function MediaDetails() {
  const { tmdbId } = useParams();
  const navigate = useNavigate();

  const [media, setMedia] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const details = await api.get(`/tmdb/details/${tmdbId}`);
        setMedia(details.data);

        const statusRes = await api.get(`/media/${tmdbId}/status`);
        setStatus(statusRes.data.status);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tmdbId]);

 async function addToWatchlist() {
    const normalizedType = media.type === "tv" ? "series" : media.type;
    await api.post(`/media/${tmdbId}/watchlist`, { type: normalizedType });
    setStatus("watchlist");
  }

  async function removeFromWatchlist() {
    const normalizedType = media.type === "tv" ? "series" : media.type;
    await api.delete(`/media/${tmdbId}/watchlist`, {
      data: { type: normalizedType }
    });
    setStatus(null);
  }

  async function markAsWatched() {
    const normalizedType = media.type === "tv" ? "series" : media.type;
    await api.post(`/media/${tmdbId}/watched`, { type: normalizedType });
    setStatus("watched");
  }

  async function removeFromWatched() {
    const normalizedType = media.type === "tv" ? "series" : media.type;
    await api.delete(`/media/${tmdbId}/watched`, {
      data: { type: normalizedType }
    });
    setStatus(null);
  }

  async function moveToWatched() {
    const normalizedType = media.type === "tv" ? "series" : media.type;
    await api.post(`/media/${tmdbId}/watchlist-to-watched`, {
      type: normalizedType
    });
    setStatus("watched");
  }

  if (loading) return <div className="page-container">Loading...</div>;
  if (!media) return <div className="page-container">Not found</div>;

  return (
    <div className="details-container">

      <button className="details-back" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="details-layout">

        <img
          src={`https://image.tmdb.org/t/p/w500${media.poster_path}`}
          alt={media.title}
          className="details-poster"
        />

        <div className="details-info">
          <h1 className="details-title">{media.title}</h1>
          <p className="details-year">{media.release_year}</p>

          <p className="details-overview">{media.overview}</p>

          <p className="details-meta">
            {media.genres?.map(g => g.name).join(", ")}
          </p>

          <p className="details-meta">Runtime: {media.runtime} min</p>

          <div className="details-actions">

            {status === null && (
              <>
                <button className="btn btn-unfavorite" onClick={addToWatchlist}>
                  Add to Watchlist
                </button>

                <button className="btn btn-remove" onClick={markAsWatched}>
                  Mark as Watched
                </button>
              </>
            )}

            {status === "watchlist" && (
              <>
                <button className="btn btn-remove" onClick={moveToWatched}>
                  Move to Watched
                </button>

                <button className="btn btn-unfavorite" onClick={removeFromWatchlist}>
                  Remove from Watchlist
                </button>
              </>
            )}

            {status === "watched" && (
              <button className="btn btn-remove" onClick={removeFromWatched}>
                Remove from Watched
              </button>
            )}

          </div>
        </div>
      </div>

      <h2 className="details-section-title">Cast</h2>
      <div className="details-cast-grid">
        {media.credits?.cast?.slice(0, 12).map(actor => (
          <div key={actor.id} className="details-cast-item">
            <img
              src={`https://image.tmdb.org/t/p/w300${actor.profile_path}`}
              className="details-cast-img"
            />
            <p className="details-cast-name">{actor.name}</p>
          </div>
        ))}
      </div>

      <h2 className="details-section-title">Recommendations</h2>
      <div className="details-recommend-grid">
        {media.recommendations?.map(rec => (
          <a key={rec.id} href={`/media/${rec.id}`} className="details-recommend-item">
            <img
              src={`https://image.tmdb.org/t/p/w500${rec.poster_path}`}
              className="details-recommend-img"
            />
            <p className="details-recommend-title">{rec.title || rec.name}</p>
          </a>
        ))}
      </div>

    </div>
  );
}