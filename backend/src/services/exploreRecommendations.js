import { getRecommendationSnapshot } from "../models/exploreModel.js";
import { runNeo4jSession } from "./neo4j.js";

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

function normalizeGenres(rawGenres) {
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
    if (!titleMap.has(key)) {
      titleMap.set(key, {
        tmdbId: Number(interaction.tmdb_id),
        type: interaction.type,
        title: interaction.title,
        posterPath: interaction.poster_path,
        releaseYear: interaction.release_year ? Number(interaction.release_year) : null,
        genres: normalizeGenres(interaction.media_genres || interaction.user_genres),
      });
    }
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

  return runNeo4jSession("read", async (session) => {
    const sections = await Promise.all([
      querySection(
        session,
        `MATCH (me:User {id: $userId})-[:WATCHED|FAVORITED]->(seed:Title)<-[:WATCHED|FAVORITED]-(peer:User)
         WHERE peer.id <> $userId
         WITH me, peer, count(DISTINCT seed) AS sharedTaste
         MATCH (peer)-[peerRel:WATCHED|FAVORITED]->(candidate:Title)
         WHERE NOT (me)-[:WATCHED|WATCHLISTED|FAVORITED]->(candidate)
           AND ($type = 'all' OR candidate.type = $type)
         WITH candidate,
              collect(DISTINCT peer.username)[0..3] AS reasonContext,
              max(sharedTaste) AS overlap,
              sum(sharedTaste + CASE type(peerRel) WHEN 'FAVORITED' THEN 2 ELSE 1 END + coalesce(peerRel.rating, 0) / 5.0) AS score
         RETURN candidate.tmdbId AS tmdbId,
                candidate.type AS type,
                candidate.title AS title,
                candidate.posterPath AS posterPath,
                candidate.releaseYear AS releaseYear,
                reasonContext,
                score
         ORDER BY score DESC, releaseYear DESC
         LIMIT 12`,
        { userId, type },
        {
          key: "tasteMatches",
          title: "Built From Similar Taste",
          description: "Titles other users liked after overlapping with your watched and favorited picks.",
        }
      ),
      querySection(
        session,
        `MATCH (me:User {id: $userId})-[:FRIENDS_WITH]-(friend:User)-[rel:FAVORITED|WATCHED]->(candidate:Title)
         WHERE NOT (me)-[:WATCHED|WATCHLISTED|FAVORITED]->(candidate)
           AND ($type = 'all' OR candidate.type = $type)
         WITH candidate,
              collect(DISTINCT friend.username)[0..3] AS reasonContext,
              count(DISTINCT friend) AS friendCount,
              sum(CASE type(rel) WHEN 'FAVORITED' THEN 3 ELSE 1 END + coalesce(rel.rating, 0) / 5.0) AS score
         WHERE friendCount > 0
         RETURN candidate.tmdbId AS tmdbId,
                candidate.type AS type,
                candidate.title AS title,
                candidate.posterPath AS posterPath,
                candidate.releaseYear AS releaseYear,
                reasonContext,
                (score + friendCount) AS score
         ORDER BY score DESC, releaseYear DESC
         LIMIT 12`,
        { userId, type },
        {
          key: "friendSignals",
          title: "Trending With Friends",
          description: "Unseen titles that your accepted friends have watched or favorited.",
        }
      ),
      querySection(
        session,
        `MATCH (me:User {id: $userId})-[rel:WATCHED|FAVORITED]->(:Title)-[:IN_GENRE]->(genre:Genre)<-[:IN_GENRE]-(candidate:Title)
         WHERE NOT (me)-[:WATCHED|WATCHLISTED|FAVORITED]->(candidate)
           AND ($type = 'all' OR candidate.type = $type)
         WITH candidate,
              collect(DISTINCT genre.name)[0..3] AS reasonContext,
              count(DISTINCT genre) AS genreOverlap,
              sum(CASE type(rel) WHEN 'FAVORITED' THEN 3 ELSE 1 END + coalesce(rel.rating, 0) / 5.0) AS score
         WHERE genreOverlap > 0
         RETURN candidate.tmdbId AS tmdbId,
                candidate.type AS type,
                candidate.title AS title,
                candidate.posterPath AS posterPath,
                candidate.releaseYear AS releaseYear,
                reasonContext,
                (score + genreOverlap) AS score
         ORDER BY score DESC, releaseYear DESC
         LIMIT 12`,
        { userId, type },
        {
          key: "genreSignals",
          title: "Pulled From Your Genres",
          description: "Recommendations based on the genres that show up repeatedly in your watched and favorite history.",
        }
      ),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      syncSummary: {
        users: payload.users.length,
        friendships: payload.friendships.length,
        titles: payload.titles.length,
        interactions: payload.watchlisted.length + payload.watched.length + payload.favorited.length,
      },
      sections: sections.filter((section) => section.items.length > 0),
    };
  });
}
