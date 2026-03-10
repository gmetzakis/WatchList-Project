import express from "express";
import db from "./db/index.js";
import cors from "cors";

import authRoutes from "./routes/auth.js";
import testTokenRoutes from "./routes/test_token.js";

const app = express();

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

//Test database connection
app.get("/test-db", async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM test_db`);
    res.json(result.rows);
  } catch (err) {
    console.error("Database connection error:", err);
    res.status(500).json({ error: "Database connection error" });
  }
});

// Endpoints
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});


app.use("/auth", authRoutes);
app.use("/test-token", testTokenRoutes);


export default app;