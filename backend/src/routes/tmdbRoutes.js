import env from "dotenv";
env.config();

//Added this to DEACTIVATE CERTIFICATE AUTHORIZATION!!
if (process.env.PC_RUNNING === "army") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}


import express from "express";
import { searchTMDB, fetchTMDBMedia, fetchTMDBDetails } from "../services/tmdb.js";

const router = express.Router();

router.get("/search", async (req, res) => {
  const query = req.query.query;

  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  try {
    const results = await searchTMDB(query);
    res.json({ results });
  } catch (err) {
    console.error("TMDB Search Error:", err.message);
    res.status(500).json({ error: "Failed to fetch TMDB search results" });
  }
});

router.get("/details/:tmdb_id", async (req, res) => {
  try {
    const media = await fetchTMDBDetails(req.params.tmdb_id);
    res.json(media);
  } catch (err) {
    console.error("TMDB Details Error:", err.message);
    res.status(404).json({ error: "Media not found" });
  }
});

// router.get("/media/status/:id", async (req, res) => {
//   const user_id = req.user.id;
//   const tmdb_id = Number(req.params.ιδ);

//   const record = await prisma.user_media.findFirst({
//     where: { user_id, tmdb_id }
//   });

//   if (!record) {
//     return res.json({ status: null });
//   }

//   return res.json({ status: record.status }); // "watchlist" | "watched"
// });



export default router;