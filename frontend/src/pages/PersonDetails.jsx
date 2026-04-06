import { useEffect, useMemo, useState, Fragment } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Heart, Eye, EyeOff, BookmarkPlus, BookmarkMinus, X } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import api from "../api/axios";
import "../styles/person.css";
import "../styles/media-card.css";
import "../styles/rating.css";
import "../styles/embla-carousel.css";

function EmblaCarousel({ items, renderCard, itemKey }) {
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

  const plugins = useMemo(
    () => autoplayEnabled
      ? [Autoplay({ delay: 4000, stopOnInteraction: true, stopOnMouseEnter: true })]
      : [],
    [autoplayEnabled]
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: false,
      align: "start",
      slidesToScroll: 2,
      breakpoints: {
        "(min-width: 768px)": { slidesToScroll: 3 },
        "(min-width: 1024px)": { slidesToScroll: 4 },
      },
    },
    plugins
  );

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);
  useEffect(() => {
    if (!emblaApi) return;
    const update = () => {
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
    };
    update();
    emblaApi.on('select', update);
    emblaApi.on('reInit', update);
    return () => {
      emblaApi.off('select', update);
      emblaApi.off('reInit', update);
    };
  }, [emblaApi]);

  return (
    <div className="embla-carousel">
      {canScrollPrev && <button className="embla-arrow left" onClick={() => emblaApi?.scrollPrev()}>
        ‹
      </button>}

      <div className="embla-viewport" ref={emblaRef}>
        <div className="embla-container">
          {items.map((item) => (
            <div key={itemKey(item)} className="embla-slide">
              {renderCard(item)}
            </div>
          ))}
        </div>
      </div>

      {canScrollNext && <button className="embla-arrow right" onClick={() => emblaApi?.scrollNext()}>
        ›
      </button>}
    </div>
  );
}

export default function PersonDetailsPage() {
  const { personId } = useParams();
  const navigate = useNavigate();

  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creditStatus, setCreditStatus] = useState({});
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 760px)").matches;
  });
  const [expandedCardKey, setExpandedCardKey] = useState(null);

  useEffect(() => {
    async function loadPerson() {
      try {
        const res = await api.get(`/tmdb/person/${personId}`);
        setPerson(res.data);
      } catch (err) {
        console.error("Person details error:", err);
        setPerson(null);
      } finally {
        setLoading(false);
      }
    }

    loadPerson();
  }, [personId]);

  useEffect(() => {
    async function hydrateVisibleCreditStatus() {
      if (!person) {
        setCreditStatus({});
        return;
      }

      const visibleItems = [
        ...(person.acting_credits || []),
        ...(person.directing_credits || []),
      ].filter((item) => item.poster_path);
      if (visibleItems.length === 0) {
        setCreditStatus({});
        return;
      }

      const pairs = await Promise.all(
        visibleItems.map(async (item) => {
          const normalizedType = item.type === "tv" ? "series" : "movie";
          const key = `${normalizedType}-${item.id}`;

          try {
            const res = await api.get(`/media/${normalizedType}/${item.id}/status`);
            return [
              key,
              {
                status: res.data.status,
                rating: res.data.rating || null,
                is_favorite: res.data.favorite || false,
              },
            ];
          } catch {
            return [
              key,
              {
                status: null,
                rating: null,
                is_favorite: false,
              },
            ];
          }
        })
      );

      setCreditStatus((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    }

    hydrateVisibleCreditStatus();
  }, [person]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const handleViewportChange = (event) => {
      setIsMobileView(event.matches);
      if (!event.matches) {
        setExpandedCardKey(null);
      }
    };

    setIsMobileView(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleViewportChange);

    return () => {
      mediaQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

  if (loading) return <div className="page-container">Loading person...</div>;
  if (!person) return <div className="page-container">Person not found</div>;

  const isDirectorFirst = (person.known_for_department || "").toLowerCase() === "directing";
  const sectionOrder = isDirectorFirst
    ? ["directing", "acting"]
    : ["acting", "directing"];

  function creditKey(item) {
    const normalizedType = item.type === "tv" ? "series" : "movie";
    return `${normalizedType}-${item.id}`;
  }

  function updateCreditState(item, updates) {
    const key = creditKey(item);
    setCreditStatus((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || { status: null, rating: null, is_favorite: false }), ...updates },
    }));
  }

  function getCreditState(item) {
    return creditStatus[creditKey(item)] || { status: null, rating: null, is_favorite: false };
  }

  function stopCardNavigation(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function addCreditToWatchlist(item) {
    const normalizedType = item.type === "tv" ? "series" : "movie";
    updateCreditState(item, { status: "watchlist" });
    const details = await api.get(`/tmdb/details/${normalizedType}/${item.id}`);
    const ids = new Set((details.data?.genres || []).map((g) => String(g.id)));
    await api.post(`/media/${item.id}/watchlist`, { type: normalizedType, genres: [...ids] });
  }

  async function removeCreditFromWatchlist(item) {
    const normalizedType = item.type === "tv" ? "series" : "movie";
    updateCreditState(item, { status: null });
    await api.delete(`/media/${item.id}/watchlist`, { data: { type: normalizedType } });
  }

  async function markCreditAsWatched(item) {
    const normalizedType = item.type === "tv" ? "series" : "movie";
    updateCreditState(item, { status: "watched" });
    const details = await api.get(`/tmdb/details/${normalizedType}/${item.id}`);
    const ids = new Set((details.data?.genres || []).map((g) => String(g.id)));
    await api.post(`/media/${item.id}/watched`, { type: normalizedType, genres: [...ids] });
  }

  async function removeCreditFromWatched(item) {
    const normalizedType = item.type === "tv" ? "series" : "movie";
    updateCreditState(item, { status: null, rating: null });
    await api.delete(`/media/${item.id}/watched`, { data: { type: normalizedType } });
  }

  async function moveCreditToWatched(item) {
    const normalizedType = item.type === "tv" ? "series" : "movie";
    updateCreditState(item, { status: "watched" });
    await api.post(`/media/${item.id}/watchlist-to-watched`, { type: normalizedType });
  }

  async function favoriteCredit(item) {
    const normalizedType = item.type === "tv" ? "series" : "movie";
    updateCreditState(item, { is_favorite: true });
    await api.post(`/media/${item.id}/favorite`, { type: normalizedType });
  }

  async function unfavoriteCredit(item) {
    const normalizedType = item.type === "tv" ? "series" : "movie";
    updateCreditState(item, { is_favorite: false });
    await api.delete(`/media/${item.id}/favorite`, { data: { type: normalizedType } });
  }

  async function rateCredit(item, value) {
    const normalizedType = item.type === "tv" ? "series" : "movie";
    updateCreditState(item, { rating: value });
    await api.post(`/media/${item.id}/rating`, { type: normalizedType, rating: value });
  }

  function renderCreditsSection(sectionType) {
    const isActing = sectionType === "acting";
    const title = isActing ? "Acting Credits" : "Directing Credits";
    const credits = (isActing ? (person.acting_credits || []) : (person.directing_credits || []))
      .filter((item) => item.poster_path);

    return (
      <div key={sectionType} className="person-credits-section">
        <h2 className="details-section-title">{title}</h2>
        {credits.length === 0 ? (
          <p className="details-meta">No titles available.</p>
        ) : (
          <EmblaCarousel
            items={credits}
            itemKey={(item) => `${sectionType}-${item.type}-${item.id}-${item.job || item.character || "credit"}`}
            renderCard={(item) => (
              (() => {
                const state = getCreditState(item);
                const isExpanded = isMobileView && expandedCardKey === `${sectionType}-${creditKey(item)}`;
                const card = (
              <div
                className={`media-card${isExpanded ? " mobile-card-expanded" : ""}`}
              >
                <Link
                  to={`/media/${item.type === "tv" ? "series" : item.type}/${item.id}`}
                  className="media-image-wrapper"
                  onClick={(e) => {
                    if (isMobileView && expandedCardKey !== `${sectionType}-${creditKey(item)}`) {
                      e.preventDefault();
                      setExpandedCardKey(`${sectionType}-${creditKey(item)}`);
                    }
                  }}
                >
                  <img
                    src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
                    alt={item.title}
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
                        stopCardNavigation(e);
                        setExpandedCardKey(null);
                      }}
                      aria-label="Close expanded card"
                    >
                      <X size={18} />
                    </button>
                    <div className="hover-title">
                      <span className="hover-title-text">{item.title}</span>
                      <span className="hover-year-text">
                        {item.release_year || "-"}
                        {isActing
                          ? (item.character ? ` • ${item.character}` : "")
                          : (item.job ? ` • ${item.job}` : "")}
                      </span>

                      {state.status === "watched" && (
                        <div className="rating-inline">
                          {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                            <span
                              key={n}
                              className={state.rating >= n ? "star active" : "star"}
                              onClick={(e) => {
                                stopCardNavigation(e);
                                rateCredit(item, n);
                              }}
                            >
                              ★
                            </span>
                          ))}
                          {state.rating && (
                            <span className="rating-label">{state.rating}/10</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="control-icons">
                      {!state.status && (
                        <>
                          <span
                            className="watched-icon"
                            onClick={(e) => {
                              stopCardNavigation(e);
                              addCreditToWatchlist(item);
                            }}
                            title="Add to Watchlist"
                          >
                            <BookmarkPlus size={32} />
                          </span>
                          <span
                            className="watched-icon"
                            onClick={(e) => {
                              stopCardNavigation(e);
                              markCreditAsWatched(item);
                            }}
                            title="Mark as Watched"
                          >
                            <Eye size={32} />
                          </span>
                        </>
                      )}

                      {state.status === "watchlist" && (
                        <>
                          <span
                            className="watched-icon"
                            onClick={(e) => {
                              stopCardNavigation(e);
                              removeCreditFromWatchlist(item);
                            }}
                            title="Remove from Watchlist"
                          >
                            <BookmarkMinus size={32} />
                          </span>
                          <span
                            className="watched-icon"
                            onClick={(e) => {
                              stopCardNavigation(e);
                              moveCreditToWatched(item);
                            }}
                            title="Move to Watched"
                          >
                            <Eye size={32} />
                          </span>
                        </>
                      )}

                      {state.status === "watched" && (
                        <>
                          <span
                            className={`favorite-icon ${state.is_favorite ? "active" : ""}`}
                            onClick={(e) => {
                              stopCardNavigation(e);
                              if (state.is_favorite) {
                                unfavoriteCredit(item);
                              } else {
                                favoriteCredit(item);
                              }
                            }}
                            title="Favorite"
                          >
                            <Heart size={32} />
                          </span>
                          <span
                            className="watched-icon active"
                            onClick={(e) => {
                              stopCardNavigation(e);
                              removeCreditFromWatched(item);
                            }}
                            title="Remove from Watched"
                          >
                            <EyeOff size={32} />
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
                );
                if (isExpanded) {
                  return (
                    <>
                      <div className="media-card"><div className="media-image-wrapper"><img src={`https://image.tmdb.org/t/p/w300${item.poster_path}`} className="media-card-img" style={{opacity:0.3}} width="300" height="450" /></div></div>
                      {createPortal(card, document.body)}
                    </>
                  );
                }
                return card;
              })()
            )}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`person-details-container${isMobileView ? " is-mobile-view" : ""}`}>
      <button className="details-back" onClick={() => navigate(-1)}>
        {"← Back"}
      </button>

      <div className="person-hero">
        <img
          src={person.profile_path ? `https://image.tmdb.org/t/p/w500${person.profile_path}` : "https://via.placeholder.com/400x600?text=No+Image"}
          alt={person.name}
          className="person-profile-img"
        />

        <div className="person-bio">
          <h1 className="details-title">{person.name}</h1>
          <p className="details-meta">Department: {person.known_for_department || "Unknown"}</p>
          {person.birthday && <p className="details-meta">Born: {person.birthday}</p>}
          {person.place_of_birth && <p className="details-meta">From: {person.place_of_birth}</p>}
          {person.deathday && <p className="details-meta">Died: {person.deathday}</p>}

          <p className="details-overview person-biography-text">
            {person.biography?.trim() || "No biography available."}
          </p>
        </div>
      </div>

      {sectionOrder.map((sectionType) => renderCreditsSection(sectionType))}

      {isMobileView && expandedCardKey && (
        <div
          className="mobile-card-backdrop"
          onClick={() => setExpandedCardKey(null)}
        />
      )}
    </div>
  );
}
