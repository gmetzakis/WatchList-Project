import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios.js";
import "../styles/explore.css";

const FILTERS = [
  { key: "all", label: "All titles" },
  { key: "movie", label: "Movies" },
  { key: "series", label: "Series" },
];

function formatGeneratedAt(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSectionReason(item) {
  if (!Array.isArray(item.reason_context) || item.reason_context.length === 0) {
    return "Recommended from your activity graph";
  }

  return item.reason_context.join(" • ");
}

export default function ExplorePage() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [details, setDetails] = useState("");
  const [payload, setPayload] = useState({
    generatedAt: null,
    syncSummary: null,
    sections: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function loadRecommendations() {
      setLoading(true);
      setError("");
      setDetails("");

      try {
        const res = await api.get("/explore/recommendations", {
          params: { type: typeFilter },
        });

        if (!cancelled) {
          setPayload({
            generatedAt: res.data?.generatedAt || null,
            syncSummary: res.data?.syncSummary || null,
            sections: Array.isArray(res.data?.sections) ? res.data.sections : [],
          });
        }
      } catch (err) {
        if (!cancelled) {
          setPayload({ generatedAt: null, syncSummary: null, sections: [] });
          setError(err.response?.data?.error || "Failed to load Explore recommendations");
          setDetails(err.response?.data?.details || "");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRecommendations();

    return () => {
      cancelled = true;
    };
  }, [typeFilter]);

  const generatedAtLabel = formatGeneratedAt(payload.generatedAt);

  return (
    <div className="explore-shell">
      <section className="explore-hero">
        <div className="explore-hero-copy">
          <p className="explore-kicker">Explore</p>
          <h1 className="explore-title">Graph-powered recommendations</h1>
          <p className="explore-subtitle">
            Explore blends your watch history, favorites, genres, and accepted friendships into a separate recommendation layer powered by Neo4j.
          </p>
        </div>

        <div className="explore-summary-panel">
          <div className="explore-filter-row" role="tablist" aria-label="Explore recommendation type filter">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`explore-filter-chip ${typeFilter === filter.key ? "active" : ""}`}
                onClick={() => setTypeFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="explore-summary-grid">
            <div className="explore-summary-card">
              <span className="explore-summary-label">Generated</span>
              <strong className="explore-summary-value">{generatedAtLabel || "Pending"}</strong>
            </div>
            <div className="explore-summary-card">
              <span className="explore-summary-label">Sections</span>
              <strong className="explore-summary-value">{payload.sections.length}</strong>
            </div>
            <div className="explore-summary-card">
              <span className="explore-summary-label">Graph sync</span>
              <strong className="explore-summary-value">{payload.syncSummary?.interactions || 0} signals</strong>
            </div>
          </div>
        </div>
      </section>

      {loading && (
        <section className="explore-state-card">
          <h2 className="explore-state-title">Building your graph...</h2>
          <p className="explore-state-copy">Syncing Postgres watch data into Neo4j and ranking recommendation candidates.</p>
        </section>
      )}

      {!loading && error && (
        <section className="explore-state-card error">
          <h2 className="explore-state-title">Explore is not ready yet</h2>
          <p className="explore-state-copy">{error}</p>
          {details && <p className="explore-state-copy subtle">{details}</p>}
        </section>
      )}

      {!loading && !error && payload.sections.length === 0 && (
        <section className="explore-state-card">
          <h2 className="explore-state-title">No recommendations yet</h2>
          <p className="explore-state-copy">
            Add a few watched titles, favorites, or friends first, then Explore will have enough graph data to rank suggestions.
          </p>
        </section>
      )}

      {!loading && !error && payload.sections.length > 0 && (
        <div className="explore-sections">
          {payload.sections.map((section) => (
            <section key={section.key} className="explore-section">
              <div className="explore-section-head">
                <div>
                  <p className="explore-section-kicker">Recommendation rail</p>
                  <h2 className="explore-section-title">{section.title}</h2>
                  <p className="explore-section-copy">{section.description}</p>
                </div>
                <span className="explore-section-count">{section.items.length}</span>
              </div>

              <div className="explore-grid">
                {section.items.map((item) => {
                  const mediaLink = `/media/${item.type}/${item.tmdb_id}`;
                  const posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null;

                  return (
                    <article key={`${section.key}-${item.type}-${item.tmdb_id}`} className="explore-card">
                      <Link to={mediaLink} className="explore-card-poster-link">
                        {posterUrl ? (
                          <img className="explore-card-poster" src={posterUrl} alt={item.title} />
                        ) : (
                          <div className="explore-card-fallback">{item.title?.slice(0, 1) || "?"}</div>
                        )}
                      </Link>

                      <div className="explore-card-body">
                        <div className="explore-card-topline">
                          <span className="explore-card-type">{item.type === "movie" ? "Movie" : "Series"}</span>
                          <span className="explore-card-score">{item.score.toFixed(1)}</span>
                        </div>
                        <h3 className="explore-card-title">
                          <Link to={mediaLink} className="explore-card-title-link">{item.title}</Link>
                        </h3>
                        <p className="explore-card-meta">{item.release_year || "Unknown year"}</p>
                        <p className="explore-card-reason">{formatSectionReason(item)}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
