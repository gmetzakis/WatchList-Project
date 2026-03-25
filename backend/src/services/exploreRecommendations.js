import { addDiscardedRecommendation, getDiscardedRecommendationsByUser, getRecommendationSnapshot } from "../models/exploreModel.js";
import { runNeo4jSession, isNeo4jConfigured } from "./neo4j.js";
import { discoverTMDBByGenres, discoverTMDBPopular, fetchTMDBDetails } from "./tmdb.js";
import { findOrCreateMedia } from "../models/mediaModel.js";
import { getUserFavorites, getUserWatchlist, getUserWatched } from "../models/userMediaModel.js";
import { getProfileByUserId } from "../models/userProfileModel.js";

const EXPLORE_CACHE_TTL_MS = 5 * 60 * 1000;
const exploreRecommendationCache = new Map();
let graphBootstrapped = false;

function getExploreCacheKey(userId, type) {
  return `${userId}:${type}`;
}

function cloneRecommendationPayload(payload) {
  return {
    ...payload,
    syncSummary: payload?.syncSummary ? { ...payload.syncSummary } : undefined,
    sections: Array.isArray(payload?.sections)
      ? payload.sections.map((section) => ({
          ...section,
          items: Array.isArray(section.items) ? section.items.map((item) => ({ ...item })) : [],
        }))
      : [],
  };
}

function getCachedExploreRecommendations(userId, type) {
  const cacheKey = getExploreCacheKey(userId, type);
  const cacheEntry = exploreRecommendationCache.get(cacheKey);
  if (!cacheEntry) {
    return null;
  }

  if (cacheEntry.expiresAt <= Date.now()) {
    exploreRecommendationCache.delete(cacheKey);
    return null;
  }

  return cloneRecommendationPayload(cacheEntry.payload);
}

function setCachedExploreRecommendations(userId, type, payload) {
  const cacheKey = getExploreCacheKey(userId, type);
  exploreRecommendationCache.set(cacheKey, {
    payload: cloneRecommendationPayload(payload),
    expiresAt: Date.now() + EXPLORE_CACHE_TTL_MS,
  });
}

function invalidateExploreRecommendationsForUser(userId) {
  for (const key of exploreRecommendationCache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      exploreRecommendationCache.delete(key);
    }
  }
}

export { invalidateExploreRecommendationsForUser };

function markGraphBootstrapped() {
  graphBootstrapped = true;
}

function markGraphDirty() {
  graphBootstrapped = false;
}

const GENRE_MAP = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

function toDisplayName(user) {
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username || `User ${user.user_id}`;
}

function normalizeGenreValue(value) {
  if (!value && value !== 0) {
    return null;
  }

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return null;
    }

    if (typeof value.name === "string" && value.name.trim()) {
      return value.name.trim();
    }

    if (typeof value.id === "number" && GENRE_MAP[value.id]) {
      return GENRE_MAP[value.id];
    }

    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const numericId = Number(raw);
  if (Number.isInteger(numericId) && GENRE_MAP[numericId]) {
    return GENRE_MAP[numericId];
  }

  return raw;
}

function extractGenreIds(rawGenres) {
  if (!rawGenres && rawGenres !== 0) {
    return [];
  }

  if (Array.isArray(rawGenres)) {
    return Array.from(new Set(rawGenres.flatMap((entry) => extractGenreIds(entry))));
  }

  if (typeof rawGenres === "object") {
    if (typeof rawGenres.id === "number" && GENRE_MAP[rawGenres.id]) {
      return [rawGenres.id];
    }

    if (typeof rawGenres.name === "string") {
      const matchedEntry = Object.entries(GENRE_MAP).find(([, name]) => name === rawGenres.name.trim());
      return matchedEntry ? [Number(matchedEntry[0])] : [];
    }

    return [];
  }

  const raw = String(rawGenres).trim();
  if (!raw) {
    return [];
  }

  const numericIds = Array.from(raw.matchAll(/\d+/g))
    .map((match) => Number(match[0]))
    .filter((genreId) => Number.isInteger(genreId) && GENRE_MAP[genreId]);

  return Array.from(new Set(numericIds));
}

function normalizeGenres(rawGenres) {
  const genreIds = extractGenreIds(rawGenres);
  if (genreIds.length > 0) {
    return genreIds.map((genreId) => GENRE_MAP[genreId]);
  }

  if (!rawGenres) {
    return [];
  }

  if (Array.isArray(rawGenres)) {
    return Array.from(new Set(rawGenres.map(normalizeGenreValue).filter(Boolean)));
  }

  if (typeof rawGenres === "string") {
    const trimmed = rawGenres.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return Array.from(new Set(parsed.map(normalizeGenreValue).filter(Boolean)));
      }
    } catch {
      // Fallback to comma-separated parsing.
    }

    return Array.from(
      new Set(
        trimmed
          .replace(/[{}\[\]"]/g, "")
          .split(",")
          .map(normalizeGenreValue)
          .filter(Boolean)
      )
    );
  }

  return [];
}

function toRecommendationContextItem(item) {
  return {
    tmdb_id: Number(item.tmdb_id),
    type: item.type,
    title: item.title,
    poster_path: item.poster_path,
    release_year: item.release_year ? Number(item.release_year) : null,
    rating: Number.isFinite(Number(item.rating)) ? Number(item.rating) : null,
    is_favorite: Boolean(item.is_favorite),
    genres: normalizeGenres(item.genres),
    watched_at: item.watched_at || null,
    created_at: item.created_at || item.added_at || null,
  };
}

async function buildUserExploreContext(userId, type) {
  const [watchlistRaw, watchedRaw, favoritesRaw, discardedRaw] = await Promise.all([
    getUserWatchlist(userId, type),
    getUserWatched(userId, undefined, undefined, type),
    getUserFavorites(userId, undefined, type),
    getDiscardedRecommendationsByUser(userId, type),
  ]);

  const watchlist = watchlistRaw.map(toRecommendationContextItem);
  const watched = watchedRaw.map(toRecommendationContextItem);
  const favorites = favoritesRaw.map(toRecommendationContextItem);
  const discarded = discardedRaw.map((item) => ({
    tmdb_id: Number(item.tmdb_id),
    type: item.type,
    created_at: item.created_at || null,
  }));

  const seenKeys = new Set();
  for (const collection of [watchlist, watched, favorites, discarded]) {
    for (const item of collection) {
      seenKeys.add(`${item.type}-${item.tmdb_id}`);
    }
  }

  return { watchlist, watched, favorites, discarded, seenKeys };
}

function getTopSeedTitlesFromContext(context) {
  return context.watched
    .map((interaction) => {
      const rating = Number.isFinite(Number(interaction.rating)) ? Number(interaction.rating) : 0;
      const recencyTimestamp = interaction.watched_at || interaction.created_at || null;
      const recencyWeight = recencyTimestamp ? new Date(recencyTimestamp).getTime() / 1e13 : 0;

      return {
        tmdbId: Number(interaction.tmdb_id),
        type: interaction.type,
        title: interaction.title,
        score: (interaction.is_favorite ? 6 : 0) + rating + recencyWeight,
      };
    })
    .sort((left, right) => right.score - left.score)
    .filter((seed, index, seeds) => index === seeds.findIndex((entry) => entry.tmdbId === seed.tmdbId && entry.type === seed.type))
    .slice(0, 5);
}

function getTopGenresFromContext(context) {
  const genreWeights = new Map();

  for (const interaction of context.watched) {
    const genreIds = extractGenreIds(interaction.genres);
    const rating = Number.isFinite(Number(interaction.rating)) ? Number(interaction.rating) : 0;
    const weight = (interaction.is_favorite ? 4 : 1) + Math.max(rating - 6, 0);

    for (const genreId of genreIds) {
      genreWeights.set(genreId, (genreWeights.get(genreId) || 0) + weight);
    }
  }

  return Array.from(genreWeights.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([genreId, weight]) => ({
      genreId,
      name: GENRE_MAP[genreId],
      weight,
    }));
}

function buildSnapshotPayload(snapshot) {
  const titleMap = new Map();

  for (const interaction of snapshot.interactions) {
    const key = `${interaction.type}-${interaction.tmdb_id}`;
    const nextGenres = normalizeGenres(interaction.media_genres || interaction.user_genres);

    if (!titleMap.has(key)) {
      titleMap.set(key, {
        tmdbId: Number(interaction.tmdb_id),
        type: interaction.type,
        title: interaction.title,
        posterPath: interaction.poster_path,
        releaseYear: interaction.release_year ? Number(interaction.release_year) : null,
        genres: nextGenres,
      });
      continue;
    }

    const existingTitle = titleMap.get(key);
    titleMap.set(key, {
      ...existingTitle,
      title: existingTitle.title || interaction.title,
      posterPath: existingTitle.posterPath || interaction.poster_path,
      releaseYear: existingTitle.releaseYear || (interaction.release_year ? Number(interaction.release_year) : null),
      genres: Array.from(new Set([...(existingTitle.genres || []), ...nextGenres])),
    });
  }

  return {
    users: snapshot.users.map((user) => ({
      id: Number(user.user_id),
      username: user.username,
      displayName: toDisplayName(user),
      country: user.country || null,
      yearOfBirth: user.year_of_birth ? Number(user.year_of_birth) : null,
    })),
    friendships: snapshot.friendships.map((friendship) => ({
      userId: Number(friendship.user_id),
      friendId: Number(friendship.friend_id),
    })),
    titles: Array.from(titleMap.values()),
    watchlisted: snapshot.interactions
      .filter((interaction) => interaction.status === "watchlist")
      .map((interaction) => ({
        userId: Number(interaction.user_id),
        tmdbId: Number(interaction.tmdb_id),
        type: interaction.type,
        createdAt: interaction.created_at ? new Date(interaction.created_at).toISOString() : null,
      })),
    watched: snapshot.interactions
      .filter((interaction) => interaction.status === "watched")
      .map((interaction) => ({
        userId: Number(interaction.user_id),
        tmdbId: Number(interaction.tmdb_id),
        type: interaction.type,
        rating: Number.isFinite(Number(interaction.rating)) ? Number(interaction.rating) : null,
        watchedAt: interaction.watched_at ? new Date(interaction.watched_at).toISOString() : null,
        createdAt: interaction.created_at ? new Date(interaction.created_at).toISOString() : null,
      })),
    favorited: snapshot.interactions
      .filter((interaction) => interaction.status === "watched" && interaction.is_favorite)
      .map((interaction) => ({
        userId: Number(interaction.user_id),
        tmdbId: Number(interaction.tmdb_id),
        type: interaction.type,
      })),
    disliked: (snapshot.discarded || []).map((interaction) => ({
      userId: Number(interaction.user_id),
      tmdbId: Number(interaction.tmdb_id),
      type: interaction.type,
      createdAt: interaction.created_at ? new Date(interaction.created_at).toISOString() : null,
    })),
  };
}

function getSeenTitleKeys(payload, userId) {
  const seenKeys = new Set();

  for (const collection of [payload.watchlisted, payload.watched, payload.favorited, payload.disliked]) {
    for (const item of collection) {
      if (item.userId === userId) {
        seenKeys.add(`${item.type}-${item.tmdbId}`);
      }
    }
  }

  return seenKeys;
}

function getUserInteractions(snapshot, userId, type) {
  return snapshot.interactions.filter((interaction) => {
    if (Number(interaction.user_id) !== userId) {
      return false;
    }

    if (type !== "all" && interaction.type !== type) {
      return false;
    }

    return interaction.status === "watched";
  });
}

function getTopSeedTitles(snapshot, userId, type) {
  const interactions = getUserInteractions(snapshot, userId, type);

  return interactions
    .map((interaction) => {
      const rating = Number.isFinite(Number(interaction.rating)) ? Number(interaction.rating) : 0;
      const recencyTimestamp = interaction.watched_at || interaction.created_at || null;
      const recencyWeight = recencyTimestamp ? new Date(recencyTimestamp).getTime() / 1e13 : 0;

      return {
        tmdbId: Number(interaction.tmdb_id),
        type: interaction.type,
        title: interaction.title,
        score: (interaction.is_favorite ? 6 : 0) + rating + recencyWeight,
      };
    })
    .sort((left, right) => right.score - left.score)
    .filter((seed, index, seeds) => index === seeds.findIndex((entry) => entry.tmdbId === seed.tmdbId && entry.type === seed.type))
    .slice(0, 5);
}

function getTopGenres(snapshot, userId, type) {
  const genreWeights = new Map();

  for (const interaction of getUserInteractions(snapshot, userId, type)) {
    const genreIds = extractGenreIds(interaction.media_genres || interaction.user_genres);
    const rating = Number.isFinite(Number(interaction.rating)) ? Number(interaction.rating) : 0;
    const weight = (interaction.is_favorite ? 4 : 1) + Math.max(rating - 6, 0);

    for (const genreId of genreIds) {
      genreWeights.set(genreId, (genreWeights.get(genreId) || 0) + weight);
    }
  }

  return Array.from(genreWeights.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([genreId, weight]) => ({
      genreId,
      name: GENRE_MAP[genreId],
      weight,
    }));
}

function mapTmdbCandidate(candidate, score, reasonContext) {
  return {
    tmdb_id: candidate.id,
    type: candidate.type,
    title: candidate.title,
    poster_path: candidate.poster_path,
    release_year: candidate.release_year || null,
    score,
    genres: normalizeGenres(candidate.genres || candidate.genre_ids),
    reason_context: reasonContext,
  };
}

async function buildPopularFallbackItems({ seenKeys, type, limit = 12, pageStart = 1, reasonContext = ["Fresh picks"] }) {
  const discoverTypes = type === "all" ? ["movie", "series"] : [type];
  const candidates = [];

  for (const discoverType of discoverTypes) {
    try {
      const popularItems = await discoverTMDBPopular(discoverType, pageStart, 2);
      popularItems.forEach((item, index) => {
        const key = `${item.type}-${item.id}`;
        if (seenKeys.has(key) || !item.poster_path) {
          return;
        }

        candidates.push(
          mapTmdbCandidate(
            item,
            Math.max(100 - index, 1) + (item.vote_average || 0),
            reasonContext
          )
        );
      });
    } catch (error) {
      console.error("Explore popular fallback error:", error.message);
    }
  }

  return candidates.slice(0, limit);
}

function dedupeSectionItems(sections) {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item, index, items) => {
        const key = `${item.type}-${item.tmdb_id}`;
        return index === items.findIndex((entry) => `${entry.type}-${entry.tmdb_id}` === key);
      }),
    }))
    .filter((section) => section.items.length > 0);
}

async function buildFavoriteSeedSection(context, type) {
  const seenKeys = context.seenKeys;
  const candidateMap = new Map();
  const seeds = getTopSeedTitlesFromContext(context).filter((seed) => seed.score >= 8);

  for (const seed of seeds) {
    try {
      const details = await fetchTMDBDetails(seed.type, seed.tmdbId);
      const recommendations = Array.isArray(details.recommendations) ? details.recommendations : [];

      recommendations.slice(0, 12).forEach((candidate, index) => {
        const candidateType = seed.type;
        const candidateKey = `${candidateType}-${candidate.id}`;

        if (seenKeys.has(candidateKey)) {
          return;
        }

        if (type !== "all" && candidateType !== type) {
          return;
        }

        const existing = candidateMap.get(candidateKey) || {
          candidate: {
            id: candidate.id,
            type: candidateType,
            title: candidate.title || candidate.name,
            poster_path: candidate.poster_path,
            release_year: (candidate.release_date || candidate.first_air_date || "").slice(0, 4) || null,
          },
          score: 0,
          reasonContext: new Set(),
        };

        existing.score += seed.score + Math.max(12 - index, 1);
        existing.reasonContext.add(seed.title);
        candidateMap.set(candidateKey, existing);
      });
    } catch (error) {
      console.error("Explore favorite-seed fallback error:", error.message);
    }
  }

  const computedItems = Array.from(candidateMap.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, 12)
    .map((entry) => mapTmdbCandidate(entry.candidate, entry.score, Array.from(entry.reasonContext).slice(0, 3)));

  const items = computedItems.length > 0
    ? computedItems
    : await buildPopularFallbackItems({
        seenKeys,
        type,
        pageStart: 1,
        reasonContext: ["Because you loved these", "Fresh picks"],
      });

  return {
    key: "fromYourFavorites",
    title: "Because You Loved These",
    description: "TMDB recommendations expanded from your favorite and highest-rated picks.",
    items,
  };
}

async function buildGenreDiscoverSection(context, type) {
  const seenKeys = context.seenKeys;
  const candidateMap = new Map();
  const topGenres = getTopGenresFromContext(context);

  for (const genre of topGenres) {
    const discoverTypes = type === "all" ? ["movie", "series"] : [type];

    for (const discoverType of discoverTypes) {
      try {
        const candidates = await discoverTMDBByGenres(discoverType, [genre.genreId]);

        candidates.slice(0, 12).forEach((candidate, index) => {
          const candidateKey = `${candidate.type}-${candidate.id}`;
          if (seenKeys.has(candidateKey)) {
            return;
          }

          const existing = candidateMap.get(candidateKey) || {
            candidate,
            score: 0,
            reasonContext: new Set(),
          };

          existing.score += genre.weight + Math.max(10 - index, 1) + (candidate.vote_average || 0) / 2;
          existing.reasonContext.add(genre.name);
          candidateMap.set(candidateKey, existing);
        });
      } catch (error) {
        console.error("Explore genre-discover fallback error:", error.message);
      }
    }
  }

  const computedItems = Array.from(candidateMap.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, 12)
    .map((entry) => mapTmdbCandidate(entry.candidate, entry.score, Array.from(entry.reasonContext).slice(0, 3)));

  const items = computedItems.length > 0
    ? computedItems
    : await buildPopularFallbackItems({
        seenKeys,
        type,
        pageStart: 3,
        reasonContext: ["Built from your top genres", "Fresh picks"],
      });

  return {
    key: "genreSignals",
    title: "Built From Your Top Genres",
    description: "Fresh titles from TMDB based on the genres you keep rating and favoriting the most.",
    items,
  };
}

async function ensureGraphSchema(session) {
  await session.run(`CREATE CONSTRAINT explore_user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE`);
  await session.run(`CREATE CONSTRAINT explore_title_identity IF NOT EXISTS FOR (t:Title) REQUIRE (t.tmdbId, t.type) IS UNIQUE`);
  await session.run(`CREATE CONSTRAINT explore_genre_name IF NOT EXISTS FOR (g:Genre) REQUIRE g.name IS UNIQUE`);
}

async function getUserNodePayload(userId) {
  const profile = await getProfileByUserId(userId);

  return {
    id: Number(userId),
    username: profile?.username || `user-${userId}`,
    displayName: toDisplayName({
      user_id: userId,
      username: profile?.username || null,
      first_name: profile?.first_name || null,
      last_name: profile?.last_name || null,
    }),
    country: profile?.country || null,
    yearOfBirth: profile?.year_of_birth ? Number(profile.year_of_birth) : null,
  };
}

function getTitleNodePayload(media) {
  return {
    tmdbId: Number(media.tmdb_id),
    type: media.type,
    title: media.title,
    posterPath: media.poster_path,
    releaseYear: media.release_year ? Number(media.release_year) : null,
    genres: normalizeGenres(media.genres),
  };
}

async function upsertUserNode(session, userId) {
  const user = await getUserNodePayload(userId);

  await session.run(
    `MERGE (u:User {id: $id})
     SET u.username = $username,
         u.displayName = $displayName,
         u.country = $country,
         u.yearOfBirth = $yearOfBirth`,
    user
  );
}

async function upsertTitleNode(session, media) {
  const title = getTitleNodePayload(media);

  await session.run(
    `MERGE (t:Title {tmdbId: $tmdbId, type: $type})
     SET t.title = $title,
         t.posterPath = $posterPath,
         t.releaseYear = $releaseYear,
         t.genres = $genres`,
    title
  );

  await session.run(
    `MATCH (t:Title {tmdbId: $tmdbId, type: $type})
     OPTIONAL MATCH (t)-[r:IN_GENRE]->(:Genre)
     DELETE r`,
    { tmdbId: title.tmdbId, type: title.type }
  );

  await session.run(
    `UNWIND $genres AS genreName
     MATCH (t:Title {tmdbId: $tmdbId, type: $type})
     MERGE (g:Genre {name: genreName})
     MERGE (t)-[:IN_GENRE]->(g)`,
    { tmdbId: title.tmdbId, type: title.type, genres: title.genres }
  );
}

async function runIncrementalGraphWrite(callback) {
  if (!isNeo4jConfigured()) {
    return;
  }

  try {
    await runNeo4jSession("write", async (session) => {
      await ensureGraphSchema(session);
      await callback(session);
    });
  } catch (error) {
    markGraphDirty();
    console.error("Incremental Explore graph update error:", error.message);
  }
}

async function syncGraph(payload) {
  await runNeo4jSession("write", async (session) => {
    await ensureGraphSchema(session);

    await session.run(`MATCH (:User)-[r:WATCHED|WATCHLISTED|FAVORITED|DISLIKED|FRIENDS_WITH]->() DELETE r`);

    await session.run(
      `UNWIND $users AS user
       MERGE (u:User {id: user.id})
       SET u.username = user.username,
           u.displayName = user.displayName,
           u.country = user.country,
           u.yearOfBirth = user.yearOfBirth`,
      { users: payload.users }
    );

    await session.run(
      `UNWIND $titles AS title
       MERGE (t:Title {tmdbId: title.tmdbId, type: title.type})
       SET t.title = title.title,
           t.posterPath = title.posterPath,
           t.releaseYear = title.releaseYear,
           t.genres = coalesce(title.genres, [])`,
      { titles: payload.titles }
    );

    await session.run(
      `UNWIND $titles AS title
       MATCH (t:Title {tmdbId: title.tmdbId, type: title.type})
       FOREACH (genreName IN title.genres |
         MERGE (g:Genre {name: genreName})
         MERGE (t)-[:IN_GENRE]->(g)
       )`,
      { titles: payload.titles }
    );

    await session.run(
      `UNWIND $friendships AS friendship
       MATCH (a:User {id: friendship.userId})
       MATCH (b:User {id: friendship.friendId})
       MERGE (a)-[:FRIENDS_WITH]->(b)
       MERGE (b)-[:FRIENDS_WITH]->(a)`,
      { friendships: payload.friendships }
    );

    await session.run(
      `UNWIND $watchlisted AS interaction
       MATCH (u:User {id: interaction.userId})
       MATCH (t:Title {tmdbId: interaction.tmdbId, type: interaction.type})
       MERGE (u)-[r:WATCHLISTED]->(t)
       SET r.createdAt = interaction.createdAt`,
      { watchlisted: payload.watchlisted }
    );

    await session.run(
      `UNWIND $watched AS interaction
       MATCH (u:User {id: interaction.userId})
       MATCH (t:Title {tmdbId: interaction.tmdbId, type: interaction.type})
       MERGE (u)-[r:WATCHED]->(t)
       SET r.rating = interaction.rating,
           r.watchedAt = interaction.watchedAt,
           r.createdAt = interaction.createdAt`,
      { watched: payload.watched }
    );

    await session.run(
      `UNWIND $favorited AS interaction
       MATCH (u:User {id: interaction.userId})
       MATCH (t:Title {tmdbId: interaction.tmdbId, type: interaction.type})
       MERGE (u)-[:FAVORITED]->(t)`,
      { favorited: payload.favorited }
    );

    await session.run(
      `UNWIND $disliked AS interaction
       MATCH (u:User {id: interaction.userId})
       MATCH (t:Title {tmdbId: interaction.tmdbId, type: interaction.type})
       MERGE (u)-[r:DISLIKED]->(t)
       SET r.createdAt = interaction.createdAt`,
      { disliked: payload.disliked }
    );
  });

  markGraphBootstrapped();
}

export async function syncExploreGraphOnWatchlistAdded(userId, media) {
  invalidateExploreRecommendationsForUser(userId);

  await runIncrementalGraphWrite(async (session) => {
    await upsertUserNode(session, userId);
    await upsertTitleNode(session, media);

    await session.run(
      `MATCH (u:User {id: $userId})
       MATCH (t:Title {tmdbId: $tmdbId, type: $type})
       OPTIONAL MATCH (u)-[watched:WATCHED]->(t)
       DELETE watched
       WITH u, t
       OPTIONAL MATCH (u)-[favorite:FAVORITED]->(t)
       DELETE favorite
       WITH u, t
       MERGE (u)-[r:WATCHLISTED]->(t)
       SET r.createdAt = datetime($createdAt)`,
      {
        userId,
        tmdbId: Number(media.tmdb_id),
        type: media.type,
        createdAt: new Date().toISOString(),
      }
    );
  });
}

export async function syncExploreGraphOnWatchlistRemoved(userId, media) {
  invalidateExploreRecommendationsForUser(userId);

  await runIncrementalGraphWrite(async (session) => {
    await session.run(
      `MATCH (u:User {id: $userId})-[r:WATCHLISTED]->(t:Title {tmdbId: $tmdbId, type: $type})
       DELETE r`,
      { userId, tmdbId: Number(media.tmdb_id), type: media.type }
    );
  });
}

export async function syncExploreGraphOnWatchedAdded(userId, media, options = {}) {
  invalidateExploreRecommendationsForUser(userId);

  await runIncrementalGraphWrite(async (session) => {
    await upsertUserNode(session, userId);
    await upsertTitleNode(session, media);

    await session.run(
      `MATCH (u:User {id: $userId})
       MATCH (t:Title {tmdbId: $tmdbId, type: $type})
       OPTIONAL MATCH (u)-[watchlist:WATCHLISTED]->(t)
       DELETE watchlist
       WITH u, t
       MERGE (u)-[r:WATCHED]->(t)
       SET r.rating = $rating,
           r.watchedAt = datetime($watchedAt),
           r.createdAt = datetime($createdAt)`,
      {
        userId,
        tmdbId: Number(media.tmdb_id),
        type: media.type,
        rating: Number.isFinite(Number(options.rating)) ? Number(options.rating) : null,
        watchedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }
    );

    if (options.isFavorite) {
      await session.run(
        `MATCH (u:User {id: $userId})
         MATCH (t:Title {tmdbId: $tmdbId, type: $type})
         MERGE (u)-[:FAVORITED]->(t)`,
        { userId, tmdbId: Number(media.tmdb_id), type: media.type }
      );
    } else {
      await session.run(
        `MATCH (u:User {id: $userId})-[r:FAVORITED]->(t:Title {tmdbId: $tmdbId, type: $type})
         DELETE r`,
        { userId, tmdbId: Number(media.tmdb_id), type: media.type }
      );
    }
  });
}

export async function syncExploreGraphOnWatchedRemoved(userId, media) {
  invalidateExploreRecommendationsForUser(userId);

  await runIncrementalGraphWrite(async (session) => {
    await session.run(
      `MATCH (u:User {id: $userId})-[r:WATCHED]->(t:Title {tmdbId: $tmdbId, type: $type})
       DELETE r`,
      { userId, tmdbId: Number(media.tmdb_id), type: media.type }
    );

    await session.run(
      `MATCH (u:User {id: $userId})-[r:FAVORITED]->(t:Title {tmdbId: $tmdbId, type: $type})
       DELETE r`,
      { userId, tmdbId: Number(media.tmdb_id), type: media.type }
    );
  });
}

export async function syncExploreGraphOnRatingChanged(userId, media, rating) {
  invalidateExploreRecommendationsForUser(userId);

  await runIncrementalGraphWrite(async (session) => {
    await session.run(
      `MATCH (u:User {id: $userId})-[r:WATCHED]->(t:Title {tmdbId: $tmdbId, type: $type})
       SET r.rating = $rating`,
      {
        userId,
        tmdbId: Number(media.tmdb_id),
        type: media.type,
        rating: Number.isFinite(Number(rating)) ? Number(rating) : null,
      }
    );
  });
}

export async function syncExploreGraphOnFavoriteChanged(userId, media, isFavorite) {
  invalidateExploreRecommendationsForUser(userId);

  await runIncrementalGraphWrite(async (session) => {
    if (isFavorite) {
      await upsertUserNode(session, userId);
      await upsertTitleNode(session, media);
      await session.run(
        `MATCH (u:User {id: $userId})
         MATCH (t:Title {tmdbId: $tmdbId, type: $type})
         MERGE (u)-[:FAVORITED]->(t)`,
        { userId, tmdbId: Number(media.tmdb_id), type: media.type }
      );
      return;
    }

    await session.run(
      `MATCH (u:User {id: $userId})-[r:FAVORITED]->(t:Title {tmdbId: $tmdbId, type: $type})
       DELETE r`,
      { userId, tmdbId: Number(media.tmdb_id), type: media.type }
    );
  });
}

export async function syncExploreGraphOnFriendshipChanged(userId, friendUserId, isActive) {
  invalidateExploreRecommendationsForUser(userId);
  invalidateExploreRecommendationsForUser(friendUserId);

  await runIncrementalGraphWrite(async (session) => {
    await upsertUserNode(session, userId);
    await upsertUserNode(session, friendUserId);

    if (isActive) {
      await session.run(
        `MATCH (a:User {id: $userId})
         MATCH (b:User {id: $friendUserId})
         MERGE (a)-[:FRIENDS_WITH]->(b)
         MERGE (b)-[:FRIENDS_WITH]->(a)`,
        { userId, friendUserId }
      );
      return;
    }

    await session.run(
      `MATCH (a:User {id: $userId})-[r:FRIENDS_WITH]->(b:User {id: $friendUserId})
       DELETE r`,
      { userId, friendUserId }
    );

    await session.run(
      `MATCH (a:User {id: $friendUserId})-[r:FRIENDS_WITH]->(b:User {id: $userId})
       DELETE r`,
      { userId, friendUserId }
    );
  });
}

export async function discardExploreRecommendation(userId, tmdbId, type) {
  const normalizedType = type === "series" ? "series" : type === "movie" ? "movie" : null;
  if (!normalizedType) {
    const error = new Error("Invalid media type");
    error.code = "INVALID_TYPE";
    throw error;
  }

  const media = await findOrCreateMedia(tmdbId, normalizedType);
  await addDiscardedRecommendation(userId, media.id);
  invalidateExploreRecommendationsForUser(userId);

  await runIncrementalGraphWrite(async (session) => {
    await upsertUserNode(session, userId);
    await upsertTitleNode(session, media);
    await session.run(
      `MATCH (u:User {id: $userId})
       MATCH (t:Title {tmdbId: $tmdbId, type: $type})
       MERGE (u)-[r:DISLIKED]->(t)
       SET r.createdAt = datetime($createdAt)`,
      {
        userId,
        tmdbId: Number(tmdbId),
        type: normalizedType,
        createdAt: new Date().toISOString(),
      }
    );
  });

  return {
    userId,
    mediaId: media.id,
    tmdbId: Number(tmdbId),
    type: normalizedType,
  };
}

export async function discardExploreRecommendationsBulk(userId, items = []) {
  const uniqueItems = Array.from(
    new Map(
      (Array.isArray(items) ? items : [])
        .filter((item) => Number.isInteger(Number(item?.tmdbId)) && Number(item.tmdbId) > 0 && (item?.type === "movie" || item?.type === "series"))
        .map((item) => [`${item.type}-${Number(item.tmdbId)}`, { tmdbId: Number(item.tmdbId), type: item.type }])
    ).values()
  );

  if (uniqueItems.length === 0) {
    return { processed: 0 };
  }

  for (const item of uniqueItems) {
    await discardExploreRecommendation(userId, item.tmdbId, item.type);
  }

  invalidateExploreRecommendationsForUser(userId);

  return { processed: uniqueItems.length };
}

function mapRecommendationRecord(record) {
  return {
    tmdb_id: record.get("tmdbId"),
    type: record.get("type"),
    title: record.get("title"),
    poster_path: record.get("posterPath"),
    release_year: record.get("releaseYear") ? String(record.get("releaseYear")) : null,
    score: Number(record.get("score") || 0),
    genres: normalizeGenres(record.get("genres")),
    reason_context: record.get("reasonContext") || [],
  };
}

async function querySection(session, cypher, params, section) {
  const result = await session.run(cypher, params);

  return {
    key: section.key,
    title: section.title,
    description: section.description,
    items: result.records.map(mapRecommendationRecord),
  };
}

export async function getExploreRecommendations(userId, type = "all") {
  const cached = getCachedExploreRecommendations(userId, type);
  if (cached) {
    return cached;
  }

  let syncSummary = null;

  if (!graphBootstrapped) {
    const snapshot = await getRecommendationSnapshot();
    const payload = buildSnapshotPayload(snapshot);
    await syncGraph(payload);
    syncSummary = {
      users: payload.users.length,
      friendships: payload.friendships.length,
      titles: payload.titles.length,
      interactions: payload.watchlisted.length + payload.watched.length + payload.favorited.length + payload.disliked.length,
    };
  }

  const context = await buildUserExploreContext(userId, type);

  const personalSections = await Promise.all([
    buildFavoriteSeedSection(context, type),
    buildGenreDiscoverSection(context, type),
  ]);

  const response = await runNeo4jSession("read", async (session) => {
    const sections = [...personalSections];

    sections.push(
      await querySection(
        session,
        `MATCH (me:User {id: $userId})-[:FRIENDS_WITH]-(friend:User)-[rel:FAVORITED|WATCHED]->(candidate:Title)
         WHERE NOT (me)-[:WATCHED|WATCHLISTED|FAVORITED]->(candidate)
           AND NOT (me)-[:DISLIKED]->(candidate)
           AND ($type = 'all' OR candidate.type = $type)
         WITH candidate,
              collect(DISTINCT friend.username)[0..3] AS reasonContext,
              count(DISTINCT CASE WHEN type(rel) = 'FAVORITED' THEN friend.id ELSE NULL END) AS favoriteCount,
              count(DISTINCT friend) AS friendCount,
              sum(CASE type(rel) WHEN 'FAVORITED' THEN 5.0 ELSE 1.0 END + coalesce(rel.rating, 0) / 2.0) AS score
         WHERE friendCount > 0
         RETURN candidate.tmdbId AS tmdbId,
                candidate.type AS type,
                candidate.title AS title,
                candidate.posterPath AS posterPath,
                candidate.releaseYear AS releaseYear,
            candidate.genres AS genres,
                reasonContext,
                (score + favoriteCount * 2.0) AS score
         ORDER BY score DESC, releaseYear DESC
         LIMIT 12`,
        { userId, type },
        {
          key: "friendTrending",
          title: "Friends' Favorites",
          description: "Titles your friends have been watching and favoriting.",
        }
      )
    );

    return {
      generatedAt: new Date().toISOString(),
      syncSummary,
      sections: dedupeSectionItems(sections),
    };
  });

  setCachedExploreRecommendations(userId, type, response);
  return response;
}
