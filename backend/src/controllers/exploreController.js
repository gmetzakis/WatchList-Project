import { getExploreRecommendations } from "../services/exploreRecommendations.js";

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
