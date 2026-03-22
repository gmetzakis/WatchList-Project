import { discardExploreRecommendation, discardExploreRecommendationsBulk, getExploreRecommendations } from "../services/exploreRecommendations.js";

export async function getRecommendations(req, res) {
  const userId = req.user.id;
  const type = req.query.type === "movie" || req.query.type === "series" ? req.query.type : "all";

  try {
    const payload = await getExploreRecommendations(userId, type);
    res.json(payload);
  } catch (error) {
    if (error?.code === "NEO4J_NOT_CONFIGURED") {
      return res.status(503).json({
        error: "Neo4j is not configured yet",
        details: "Set NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD, and optionally NEO4J_DATABASE in the backend environment.",
      });
    }

    console.error("Explore recommendations error:", error);
    res.status(500).json({ error: "Failed to generate recommendations" });
  }
}

export async function discardRecommendation(req, res) {
  const userId = req.user.id;
  const tmdbId = Number(req.params.tmdbId);
  const type = req.body?.type;

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return res.status(400).json({ error: "Invalid tmdb id" });
  }

  if (type !== "movie" && type !== "series") {
    return res.status(400).json({ error: "Type must be movie or series" });
  }

  try {
    await discardExploreRecommendation(userId, tmdbId, type);
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (error?.code === "INVALID_TYPE") {
      return res.status(400).json({ error: "Type must be movie or series" });
    }

    console.error("Explore discard error:", error);
    return res.status(500).json({ error: "Failed to discard recommendation" });
  }
}

export async function discardRecommendationsBulk(req, res) {
  const userId = req.user.id;
  const items = Array.isArray(req.body?.items) ? req.body.items : null;

  if (!items) {
    return res.status(400).json({ error: "Items must be an array" });
  }

  try {
    const result = await discardExploreRecommendationsBulk(userId, items);
    return res.status(200).json({ ok: true, processed: result.processed });
  } catch (error) {
    console.error("Explore bulk discard error:", error);
    return res.status(500).json({ error: "Failed to discard recommendations" });
  }
}
