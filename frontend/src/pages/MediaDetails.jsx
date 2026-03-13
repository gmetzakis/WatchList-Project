import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";

export default function MediaDetails() {
  const { tmdbId } = useParams(); // TMDb ID
  const [media, setMedia] = useState(null);
  const [status, setStatus] = useState(null); // "watchlist" | "watched" | null
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Load TMDb details
        const details = await api.get(`/tmdb/details/${tmdbId}`);
        setMedia(details.data);

        // Load user status
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

  // --- ACTIONS ---

  async function addToWatchlist() {
    console.log(`TO GAMWID EINAI ${media.id}`)
    await api.post(`/media/${media.id}/watchlist`, {
      type: media.type
    });
    setStatus("watchlist");
  }

  async function removeFromWatchlist() {
    await api.delete(`/media/${media.id}/watchlist`, {
      data: { type: media.type }
    });
    setStatus(null);
  }

  async function markAsWatched() {
    await api.post(`/media/${media.id}/watched`, {
      type: media.type
    });
    setStatus("watched");
  }

  async function removeFromWatched() {
    await api.delete(`/media/${media.id}/watched`, {
      data: { type: media.type }
    });
    setStatus(null);
  }

  async function moveToWatched() {
    await api.post(`/media/${media.id}/watchlist-to-watched`, {
      type: media.type
    });
    setStatus("watched");
  }

  if (loading) return <p className="text-white p-6">Loading...</p>;
  if (!media) return <p className="text-white p-6">Not found</p>;

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* HEADER SECTION */}
      <div className="flex gap-6">
        <img
          src={`https://image.tmdb.org/t/p/w500${media.poster_path}`}
          alt={media.title}
          className="w-64 rounded"
        />

        <div>
          <h1 className="text-3xl font-bold">{media.title}</h1>
          <p className="text-neutral-400">{media.release_year}</p>
          <p className="mt-4 max-w-xl">{media.overview}</p>

          <p className="mt-4 text-sm text-neutral-400">
            {media.genres?.map(g => g.name).join(", ")}
          </p>

          <p className="mt-2 text-sm text-neutral-400">
            Runtime: {media.runtime} min
          </p>

          {/* --- BUTTONS --- */}
          <div className="mt-6 flex gap-4">

            {status === null && (
              <>
                <button
                  onClick={addToWatchlist}
                  className="px-4 py-2 bg-blue-600 rounded"
                >
                  Add to Watchlist
                </button>

                <button
                  onClick={markAsWatched}
                  className="px-4 py-2 bg-green-600 rounded"
                >
                  Mark as Watched
                </button>
              </>
            )}

            {status === "watchlist" && (
              <>
                <button
                  onClick={moveToWatched}
                  className="px-4 py-2 bg-green-600 rounded"
                >
                  Move to Watched
                </button>

                <button
                  onClick={removeFromWatchlist}
                  className="px-4 py-2 bg-red-600 rounded"
                >
                  Remove from Watchlist
                </button>
              </>
            )}

            {status === "watched" && (
              <>
                <button
                  onClick={removeFromWatched}
                  className="px-4 py-2 bg-red-600 rounded"
                >
                  Remove from Watched
                </button>
              </>
            )}

          </div>
        </div>
      </div>

      {/* CAST */}
      <h2 className="text-2xl mt-10 mb-4">Cast</h2>
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-4">
        {media.credits?.cast?.slice(0, 12).map(actor => (
          <div key={actor.id} className="text-center">
            <img
              src={`https://image.tmdb.org/t/p/w300${actor.profile_path}`}
              className="rounded mb-2"
            />
            <p className="text-sm">{actor.name}</p>
          </div>
        ))}
      </div>

      {/* RECOMMENDATIONS */}
      <h2 className="text-2xl mt-10 mb-4">Recommendations</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {media.recommendations?.map(rec => (
          <a key={rec.id} href={`/media/${rec.id}`} className="block">
            <img
              src={`https://image.tmdb.org/t/p/w500${rec.poster_path}`}
              className="rounded"
            />
            <p className="mt-2 text-sm text-center">{rec.title || rec.name}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
