import axios from "axios";

const TMDB_BASE = "https://api.themoviedb.org/3";
const API_KEY = process.env.TMDB_API_KEY

export async function fetchTMDBMedia(tmdbId, type) {
  const endpoint = type === "movie" ? "movie" : "tv";

  const url = `${TMDB_BASE}/${endpoint}/${tmdbId}?api_key=${process.env.TMDB_API_KEY}&language=en-US`;

  const { data } = await axios.get(url);

  return {
    tmdb_id: data.id,
    type,
    title: type === "movie" ? data.title : data.name,
    poster_path: data.poster_path,
    release_year: (type === "movie" ? data.release_date : data.first_air_date)?.slice(0, 4)
  };
}

export async function searchTMDB(query) {
  const url = `${TMDB_BASE}/search/multi?api_key=${process.env.TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(query)}`;

  const { data } = await axios.get(url);

  return data.results.map(item => ({
    id: item.id,
    type: item.media_type,
    title: item.title || item.name,
    poster_path: item.poster_path,
    release_year: (item.release_date || item.first_air_date)?.slice(0, 4)
  }));
}

export async function fetchTMDBDetails(tmdbId) {
  console.log(`Given id is ${tmdbId}`)
  const movieUrl = `${TMDB_BASE}/movie/${tmdbId}?api_key=${API_KEY}&language=en-US&append_to_response=credits,images,recommendations`;
  const tvUrl = `${TMDB_BASE}/tv/${tmdbId}?api_key=${API_KEY}&language=en-US&append_to_response=credits,images,recommendations`;

  try {
    const { data } = await axios.get(movieUrl);
    return { ...normalizeMovie(data), type: "movie" };
  } catch {}

  try {
    const { data } = await axios.get(tvUrl);
    return { ...normalizeTV(data), type: "tv" };
  } catch {}

  throw new Error("Media not found");
}

function normalizeMovie(data) {
  return {
    id: data.id,
    title: data.title,
    overview: data.overview,
    poster_path: data.poster_path,
    backdrop_path: data.backdrop_path,
    release_year: data.release_date?.slice(0, 4),
    genres: data.genres,
    runtime: data.runtime,
    credits: data.credits,
    images: data.images,
    recommendations: data.recommendations?.results
  };
}

function normalizeTV(data) {
  return {
    id: data.id,
    title: data.name,
    overview: data.overview,
    poster_path: data.poster_path,
    backdrop_path: data.backdrop_path,
    release_year: data.first_air_date?.slice(0, 4),
    genres: data.genres,
    runtime: data.episode_run_time?.[0],
    credits: data.credits,
    images: data.images,
    recommendations: data.recommendations?.results
  };
}
