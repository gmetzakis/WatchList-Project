# MyCineShelf — Backend

REST API server for MyCineShelf, built with **Express 5** and **PostgreSQL**.

## Quick Start

```bash
npm install
cp .env.example .env   # Fill in your credentials
npm run dev            # Start with nodemon (auto-reload)
```

The server starts on `http://localhost:5000` by default.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with hot-reload (nodemon) |
| `npm start` | Start production server |

## Architecture

```
src/
├── app.js               # Express app configuration
├── server.js            # Entry point
├── controllers/         # Request handlers & business logic
├── models/              # Data access layer (raw SQL queries)
├── routes/              # Route definitions & middleware binding
├── middleware/           # Auth middleware (JWT verification)
├── services/            # External integrations (TMDB, Neo4j)
└── db/
    └── index.js         # PostgreSQL connection pool
```

### Design Decisions

- **No ORM** — Raw SQL via `pg` for full control over queries and performance
- **MVC-ish pattern** — Controllers handle logic, models encapsulate SQL, routes define endpoints
- **Service layer** — TMDB API calls and Neo4j graph operations are isolated in `services/`
- **Graceful degradation** — The app works without Neo4j; recommendations return a 503 with a helpful message

## Key Features

- **JWT authentication** with bcrypt password hashing (cost factor 10)
- **TMDB API proxy** with retry logic (3 retries, 300ms delay)
- **Recommendation engine** combining content-based filtering + social graph analysis via Neo4j
- **5-minute recommendation cache** per user/type, invalidated on user interactions
- **Transactional operations** for multi-step data changes (registration, media status changes)
- **Password reset** via email with SHA-256 hashed tokens and 1-hour expiry

## Environment Variables

See [`.env.example`](.env.example) for a complete template with descriptions.

## Health Checks

| Endpoint | Description |
|---|---|
| `GET /health` | Server health check |
| `GET /test-db` | Database connectivity check |
