import api from "./axios.js"; // το axios instance σου

export function fetchWatchlist() {
  return api.get("/media/watchlist");
}

export function fetchWatched(sort, favorites) {
  return api.get("/media/watched", {
    params: { sort, favorites }
  });
}

export function removeFromWatchlist(tmdbId, type) {
  return api.delete(`/media/${tmdbId}/watchlist`, {
    data: { type }
  });
}

export function moveToWatched(tmdbId, type) {
  return api.post(`/media/${tmdbId}/watchlist-to-watched`, { type });
}

export function removeFromWatched(tmdbId, type) {
  return api.delete(`/media/${tmdbId}/watched`, {
    data: { type }
  });
}