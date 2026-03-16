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
    genres: data.genres,
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
    genres: item.genre_ids,
    release_year: (item.release_date || item.first_air_date)?.slice(0, 4)
  }));
}

export async function fetchTMDBDetails(type, tmdbId) {
  const tmdbType = type === "series" ? "tv" : "movie";

  const url = `${TMDB_BASE}/${tmdbType}/${tmdbId}?api_key=${API_KEY}&language=en-US&append_to_response=credits,images,recommendations`;

  try {
    const { data } = await fetchWithRetry(url, {
      timeout: 5000, // optional but recommended
    });

    if (tmdbType === "movie") {
      return { ...normalizeMovie(data), type: "movie" };
    } else {
      return { ...normalizeTV(data), type: "series" };
    }

  } catch (err) {
    console.error("TMDB Details Error:", err.message);
    throw new Error("Media not found");
  }
}

async function fetchWithRetry(url, options = {}, retries = 3, delay = 300) {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url, options);
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(res => setTimeout(res, delay));
    }
  }
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
