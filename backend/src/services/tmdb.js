import axios from "axios";

const TMDB_BASE = "https://api.themoviedb.org/3";

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