import { getRecommendationSnapshot } from "../models/exploreModel.js";
import { runNeo4jSession } from "./neo4j.js";
import { discoverTMDBByGenres, fetchTMDBDetails } from "./tmdb.js";

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
  };
}

function getSeenTitleKeys(payload, userId) {
  const seenKeys = new Set();

  for (const collection of [payload.watchlisted, payload.watched, payload.favorited]) {
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

function dedupeSectionItems(sections) {
  const seenKeys = new Set();

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const key = `${item.type}-${item.tmdb_id}`;
        if (seenKeys.has(key)) {
          return false;
        }

        seenKeys.add(key);
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);
}

async function buildFavoriteSeedSection(snapshot, payload, userId, type) {
  const seenKeys = getSeenTitleKeys(payload, userId);
  const candidateMap = new Map();
  const seeds = getTopSeedTitles(snapshot, userId, type).filter((seed) => seed.score >= 8);

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

  return {
    key: "fromYourFavorites",
    title: "Because You Loved These",
    description: "TMDB recommendations expanded from your favorite and highest-rated picks.",
    items: Array.from(candidateMap.values())
      .sort((left, right) => right.score - left.score)
      .slice(0, 12)
      .map((entry) => mapTmdbCandidate(entry.candidate, entry.score, Array.from(entry.reasonContext).slice(0, 3))),
  };
}

async function buildGenreDiscoverSection(snapshot, payload, userId, type) {
  const seenKeys = getSeenTitleKeys(payload, userId);
  const candidateMap = new Map();
  const topGenres = getTopGenres(snapshot, userId, type);

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

  return {
    key: "genreSignals",
    title: "Built From Your Top Genres",
    description: "Fresh titles from TMDB based on the genres you keep rating and favoriting the most.",
    items: Array.from(candidateMap.values())
      .sort((left, right) => right.score - left.score)
      .slice(0, 12)
      .map((entry) => mapTmdbCandidate(entry.candidate, entry.score, Array.from(entry.reasonContext).slice(0, 3))),
  };
}

async function ensureGraphSchema(session) {
  await session.run(`CREATE CONSTRAINT explore_user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE`);
  await session.run(`CREATE CONSTRAINT explore_title_identity IF NOT EXISTS FOR (t:Title) REQUIRE (t.tmdbId, t.type) IS UNIQUE`);
  await session.run(`CREATE CONSTRAINT explore_genre_name IF NOT EXISTS FOR (g:Genre) REQUIRE g.name IS UNIQUE`);
}

async function syncGraph(payload) {
  await runNeo4jSession("write", async (session) => {
    await ensureGraphSchema(session);

    await session.run(`MATCH (:User)-[r:WATCHED|WATCHLISTED|FAVORITED|FRIENDS_WITH]->() DELETE r`);

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
           t.releaseYear = title.releaseYear`,
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
  });
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
  const snapshot = await getRecommendationSnapshot();
  const payload = buildSnapshotPayload(snapshot);

  await syncGraph(payload);

  const personalSections = await Promise.all([
    buildFavoriteSeedSection(snapshot, payload, userId, type),
    buildGenreDiscoverSection(snapshot, payload, userId, type),
  ]);

  return runNeo4jSession("read", async (session) => {
    const sections = [...personalSections];

    sections.push(
      await querySection(
        session,
        `MATCH (me:User {id: $userId})-[:FRIENDS_WITH]-(friend:User)-[rel:FAVORITED|WATCHED]->(candidate:Title)
         WHERE NOT (me)-[:WATCHED|WATCHLISTED|FAVORITED]->(candidate)
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
      syncSummary: {
        users: payload.users.length,
        friendships: payload.friendships.length,
        titles: payload.titles.length,
        interactions: payload.watchlisted.length + payload.watched.length + payload.favorited.length,
      },
      sections: dedupeSectionItems(sections),
    };
  });
}
