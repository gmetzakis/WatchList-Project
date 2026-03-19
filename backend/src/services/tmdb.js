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

export async function discoverTMDBByGenres(type, genreIds = []) {
  const endpoint = type === "series" ? "tv" : "movie";
  const filteredGenreIds = Array.from(
    new Set(
      genreIds
        .map((genreId) => Number(genreId))
        .filter((genreId) => Number.isInteger(genreId))
    )
  );

  if (filteredGenreIds.length === 0) {
    return [];
  }

  const url = `${TMDB_BASE}/discover/${endpoint}?api_key=${API_KEY}&language=en-US&include_adult=false&sort_by=popularity.desc&page=1&vote_count.gte=50&with_genres=${filteredGenreIds.join(",")}`;
  const { data } = await fetchWithRetry(url, { timeout: 5000 });

  return (data.results || []).map((item) => ({
    id: item.id,
    type,
    title: item.title || item.name,
    poster_path: item.poster_path,
    release_year: (item.release_date || item.first_air_date)?.slice(0, 4) || null,
    vote_average: item.vote_average || 0,
    genre_ids: item.genre_ids || [],
  }));
}

export async function searchTMDBByPerson(query) {
  const personSearchUrl = `${TMDB_BASE}/search/person?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=1`;
  const { data } = await axios.get(personSearchUrl);

  return (data.results || [])
    .filter((person) => person.profile_path)
    .map((person) => ({
      id: person.id,
      type: "person",
      name: person.name,
      profile_path: person.profile_path,
      known_for_department: person.known_for_department || null,
      known_for: (person.known_for || [])
        .filter((item) => item.media_type === "movie" || item.media_type === "tv")
        .slice(0, 3)
        .map((item) => item.title || item.name)
    }))
    .slice(0, 30);
}

export async function fetchTMDBPersonDetails(personId) {
  const url = `${TMDB_BASE}/person/${personId}?api_key=${API_KEY}&language=en-US&append_to_response=combined_credits,images`;
  const { data } = await fetchWithRetry(url, { timeout: 5000 });

  const actingCreditsRaw = (data.combined_credits?.cast || [])
    .filter((item) => (item.media_type === "movie" || item.media_type === "tv") && item.poster_path)
    .map((item) => ({
      id: item.id,
      type: item.media_type,
      title: item.title || item.name,
      poster_path: item.poster_path,
      character: item.character || null,
      release_year: (item.release_date || item.first_air_date || "").slice(0, 4),
      release_date: item.release_date || item.first_air_date || ""
    }));

  const directingCreditsRaw = (data.combined_credits?.crew || [])
    .filter((item) => (item.media_type === "movie" || item.media_type === "tv") && item.poster_path)
    .filter((item) => item.job === "Director")
    .map((item) => ({
      id: item.id,
      type: item.media_type,
      title: item.title || item.name,
      poster_path: item.poster_path,
      job: item.job || null,
      release_year: (item.release_date || item.first_air_date || "").slice(0, 4),
      release_date: item.release_date || item.first_air_date || ""
    }));

  const actingByMedia = new Map();
  for (const credit of actingCreditsRaw) {
    const key = `${credit.type}-${credit.id}`;
    const existing = actingByMedia.get(key);
    if (!existing) {
      actingByMedia.set(key, credit);
      continue;
    }

    const existingDate = existing.release_date || "";
    const currentDate = credit.release_date || "";
    if (currentDate > existingDate) {
      actingByMedia.set(key, credit);
    }
  }

  const directingByMedia = new Map();
  for (const credit of directingCreditsRaw) {
    const key = `${credit.type}-${credit.id}`;
    const existing = directingByMedia.get(key);
    if (!existing) {
      directingByMedia.set(key, credit);
      continue;
    }

    const existingDate = existing.release_date || "";
    const currentDate = credit.release_date || "";
    if (currentDate > existingDate) {
      directingByMedia.set(key, credit);
    }
  }

  return {
    id: data.id,
    name: data.name,
    biography: data.biography,
    profile_path: data.profile_path,
    birthday: data.birthday,
    deathday: data.deathday,
    known_for_department: data.known_for_department,
    place_of_birth: data.place_of_birth,
    acting_credits: Array.from(actingByMedia.values())
      .sort((a, b) => (b.release_date || "").localeCompare(a.release_date || ""))
      .map(({ release_date, ...rest }) => rest),
    directing_credits: Array.from(directingByMedia.values())
      .sort((a, b) => (b.release_date || "").localeCompare(a.release_date || ""))
      .map(({ release_date, ...rest }) => rest)
  };
}

export async function fetchTMDBDetails(type, tmdbId) {
  const tmdbType = type === "series" ? "tv" : "movie";

  const url = `${TMDB_BASE}/${tmdbType}/${tmdbId}?api_key=${API_KEY}&language=en-US&append_to_response=credits,images,recommendations,videos`;

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
    recommendations: data.recommendations?.results,
    trailer: pickPreferredTrailer(data.videos?.results)
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
    recommendations: data.recommendations?.results,
    trailer: pickPreferredTrailer(data.videos?.results)
  };
}

function pickPreferredTrailer(videos = []) {
  if (!Array.isArray(videos) || videos.length === 0) return null;

  const youtubeVideos = videos.filter((video) => video?.site === "YouTube" && video?.key);
  if (youtubeVideos.length === 0) return null;

  const officialTrailer = youtubeVideos.find(
    (video) => video.type === "Trailer" && video.official === true
  );
  const trailer = officialTrailer || youtubeVideos.find((video) => video.type === "Trailer") || youtubeVideos[0];

  return {
    key: trailer.key,
    name: trailer.name,
    site: trailer.site,
    type: trailer.type,
    official: trailer.official,
    published_at: trailer.published_at
  };
}
