<p align="center">
  <img src="frontend/public/video-camera-cinema-svgrepo-com.svg" alt="MyCineShelf Logo" width="80" />
</p>

<h1 align="center">MyCineShelf</h1>

<p align="center">
  A full-stack movie &amp; TV series tracking platform with social features and personalized recommendations.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white" alt="Express 5" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Neo4j-5-008CC1?logo=neo4j&logoColor=white" alt="Neo4j" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss&logoColor=white" alt="TailwindCSS" />
</p>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Database Setup](#database-setup)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [License](#license)

---

## Overview

**MyCineShelf** is a full-stack web application that lets users discover, track, and share movies and TV series. It integrates with the [TMDB API](https://www.themoviedb.org/documentation/api) for rich media metadata, uses **PostgreSQL** for relational data, and leverages a **Neo4j** graph database to power a hybrid recommendation engine that combines content-based filtering with social graph analysis.

---

## Features

| Category | Details |
|---|---|
| **Media Tracking** | Add movies/series to your watchlist, mark as watched, move between lists |
| **Ratings & Favorites** | Rate titles on a 1–10 scale, mark favorites for quick access |
| **Search & Discovery** | Full-text search across movies, series, and actors via TMDB |
| **Smart Recommendations** | Personalized suggestions powered by Neo4j graph analysis — combines your watch history, genre preferences, and friend activity |
| **Social / Friends** | Send/accept friend requests, browse friends' libraries, get social recommendations |
| **User Profiles** | Custom avatars, profile info, watch statistics |
| **Authentication** | JWT-based auth with secure password hashing (bcrypt), password reset via email |
| **Responsive UI** | Mobile-first design with Tailwind CSS and Framer Motion animations |

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| [React 19](https://react.dev/) | UI framework |
| [Vite 8](https://vite.dev/) | Build tool & dev server |
| [React Router 7](https://reactrouter.com/) | Client-side routing |
| [Zustand](https://zustand.docs.pmnd.rs/) | Lightweight state management |
| [Tailwind CSS 4](https://tailwindcss.com/) | Utility-first styling |
| [Framer Motion](https://motion.dev/) | Animations & transitions |
| [Embla Carousel](https://www.embla-carousel.com/) | Carousel component |
| [Lucide React](https://lucide.dev/) | Icon library |

### Backend
| Technology | Purpose |
|---|---|
| [Express 5](https://expressjs.com/) | REST API framework |
| [PostgreSQL](https://www.postgresql.org/) | Primary relational database |
| [Neo4j](https://neo4j.com/) | Graph database for recommendations |
| [JSON Web Tokens](https://jwt.io/) | Stateless authentication |
| [bcrypt](https://github.com/kelektiv/node.bcrypt.js) | Password hashing |
| [Nodemailer](https://nodemailer.com/) | Email delivery (password resets) |
| [Axios](https://axios-http.com/) | TMDB API client |

### External APIs
| Service | Purpose |
|---|---|
| [TMDB API](https://developer.themoviedb.org/docs) | Movie & TV metadata, search, images, trailers |

---

## Architecture

```
┌─────────────┐     HTTPS      ┌─────────────────┐
│   React SPA │ ◄────────────► │   Express API   │
│  (Vercel)   │                │  (Node.js)      │
└─────────────┘                └────────┬────────┘
                                        │
                          ┌─────────────┼─────────────┐
                          │             │             │
                    ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
                    │ PostgreSQL│ │   Neo4j   │ │ TMDB API  │
                    │  (Data)   │ │  (Graph)  │ │ (Metadata)│
                    └───────────┘ └───────────┘ └───────────┘
```

**Data flow:**
- PostgreSQL is the **source of truth** for all user data, media records, and relationships
- Neo4j mirrors relevant data as a **graph layer** for computing recommendations
- The recommendation engine syncs user activity from Postgres → Neo4j on demand
- TMDB API provides movie/series metadata, posters, trailers, and cast information

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14
- **Neo4j** ≥ 5 (optional — app works without it, recommendations will be disabled)
- **TMDB API Key** — [Get one free here](https://developer.themoviedb.org/docs/getting-started)

### Database Setup

1. **Create the PostgreSQL database:**

```bash
createdb mycineshelf
```

2. **Run the schema migration:**

```bash
psql -d mycineshelf -f db/setup.sql
```

> This creates all required tables, indexes, and constraints. See [`db/setup.sql`](db/setup.sql) for the full schema.

3. **(Optional) Set up Neo4j:**

   - Install [Neo4j Desktop](https://neo4j.com/download/) or use [Neo4j AuraDB](https://neo4j.com/cloud/aura-free/) (free tier available)
   - Create a new database
   - Note the connection URI, username, and password for your `.env` file
   - The app will automatically create the required graph schema on first use

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env    # Edit with your credentials
npm run dev             # Starts on http://localhost:5000
```

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env    # Edit if needed
npm run dev             # Starts on http://localhost:5173
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Server port |
| `PG_USER` | **Yes** | — | PostgreSQL username |
| `PG_HOST` | **Yes** | — | PostgreSQL host |
| `PG_DATABASE` | **Yes** | — | PostgreSQL database name |
| `PG_PASSWORD` | **Yes** | — | PostgreSQL password |
| `PG_PORT` | No | `5432` | PostgreSQL port |
| `JWT_SECRET` | **Yes** | — | Secret key for signing JWTs |
| `JWT_EXPIRES_IN` | No | `7d` | Token expiration duration |
| `TMDB_API_KEY` | **Yes** | — | TMDB API key |
| `NEO4J_URI` | No | — | Neo4j connection URI (e.g., `bolt://localhost:7687`) |
| `NEO4J_USERNAME` | No | — | Neo4j username |
| `NEO4J_PASSWORD` | No | — | Neo4j password |
| `NEO4J_DATABASE` | No | `neo4j` | Neo4j database name |
| `SMTP_HOST` | No | — | SMTP server host (for password reset emails) |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password |
| `SMTP_FROM` | No | `SMTP_USER` | Sender email address |
| `FRONTEND_URL` | No | — | Frontend URL for password reset links |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_DEPLOYMENT_TYPE` | No | `local` | Set to `local` for local development |
| `VITE_API_URL` | No | — | Backend API URL override |

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Create a new account |
| `POST` | `/auth/login` | Sign in |
| `GET` | `/auth/username-availability` | Check username availability |
| `POST` | `/auth/forgot-password` | Request password reset email |
| `POST` | `/auth/reset-password` | Reset password with token |

### Media Library
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/media/watchlist` | Get user's watchlist (paginated, filterable) |
| `GET` | `/media/watched` | Get watched history |
| `GET` | `/media/favorites` | Get favorite titles |
| `POST` | `/media/:tmdbId/watchlist` | Add to watchlist |
| `DELETE` | `/media/:tmdbId/watchlist` | Remove from watchlist |
| `POST` | `/media/:tmdbId/watched` | Mark as watched |
| `DELETE` | `/media/:tmdbId/watched` | Remove from watched |
| `POST` | `/media/:tmdbId/watchlist-to-watched` | Move from watchlist to watched |
| `POST` | `/media/:tmdbId/rating` | Rate a title (1–10) |
| `DELETE` | `/media/:tmdbId/rating` | Remove rating |
| `POST` | `/media/:tmdbId/favorite` | Mark as favorite |
| `DELETE` | `/media/:tmdbId/favorite` | Remove from favorites |
| `GET` | `/media/:type/:tmdbId/status` | Get media status for user |

### Friends
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/friends/` | List accepted friends |
| `POST` | `/friends/requests` | Send friend request |
| `POST` | `/friends/requests/:id/respond` | Accept or decline request |
| `DELETE` | `/friends/requests/:id` | Cancel pending request |
| `DELETE` | `/friends/:friendUserId` | Remove friend |
| `GET` | `/friends/notifications` | Get pending notifications |
| `POST` | `/friends/notifications/read` | Mark notifications as read |
| `GET` | `/friends/:friendUserId/library` | View friend's library |

### TMDB Proxy
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/tmdb/search?query=...` | Search movies & series |
| `GET` | `/tmdb/search/people?query=...` | Search actors & directors |
| `GET` | `/tmdb/details/:type/:tmdbId` | Get full media details |
| `GET` | `/tmdb/person/:personId` | Get person details & filmography |

### Explore / Recommendations
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/explore/recommendations` | Get personalized recommendations |
| `POST` | `/explore/recommendations/:tmdbId/discard` | Discard a recommendation |
| `POST` | `/explore/recommendations/discard-bulk` | Bulk discard recommendations |

> All endpoints except `/auth/*` require a valid JWT token in the `Authorization: Bearer <token>` header.

---

## Project Structure

```
watchlist-project/
├── db/
│   └── setup.sql                # PostgreSQL schema & migrations
├── backend/
│   ├── package.json
│   ├── .env.example             # Environment variable template
│   └── src/
│       ├── app.js               # Express app setup & middleware
│       ├── server.js            # Server entry point
│       ├── controllers/         # Route handlers (business logic)
│       │   ├── authController.js
│       │   ├── exploreController.js
│       │   ├── friendController.js
│       │   ├── mediaController.js
│       │   └── profileController.js
│       ├── db/
│       │   └── index.js         # PostgreSQL connection pool
│       ├── middleware/
│       │   └── authMiddleware.js # JWT verification middleware
│       ├── models/              # Data access layer (SQL queries)
│       │   ├── userModel.js
│       │   ├── userProfileModel.js
│       │   ├── mediaModel.js
│       │   ├── userMediaModel.js
│       │   ├── friendModel.js
│       │   ├── userAvatarModel.js
│       │   ├── passwordResetModel.js
│       │   └── exploreModel.js
│       ├── routes/              # Express route definitions
│       │   ├── auth.js
│       │   ├── explore.js
│       │   ├── friends.js
│       │   ├── media.js
│       │   ├── profile.js
│       │   └── tmdbRoutes.js
│       └── services/            # External service integrations
│           ├── exploreRecommendations.js  # Recommendation engine
│           ├── neo4j.js                   # Neo4j driver management
│           └── tmdb.js                    # TMDB API client
└── frontend/
    ├── package.json
    ├── .env.example             # Environment variable template
    ├── index.html
    ├── vite.config.js
    ├── vercel.json              # Vercel deployment config
    └── src/
        ├── App.jsx              # Root component
        ├── main.jsx             # React entry point
        ├── api/
        │   ├── axios.js         # Axios instance & interceptors
        │   └── media.js         # Media API helpers
        ├── components/
        │   └── header.jsx       # Navigation header
        ├── pages/               # Route page components
        │   ├── Search.jsx
        │   ├── MediaDetails.jsx
        │   ├── PersonDetails.jsx
        │   ├── Watchlist.jsx
        │   ├── Watched.jsx
        │   ├── Favorites.jsx
        │   ├── Explore.jsx
        │   ├── Friends.jsx
        │   ├── Profile.jsx
        │   ├── Home.jsx
        │   ├── Login.jsx
        │   ├── Register.jsx
        │   ├── ForgotPassword.jsx
        │   └── ResetPassword.jsx
        ├── router/
        │   ├── AppRouter.jsx    # Route definitions
        │   └── ProtectedRoute.jsx
        ├── store/
        │   └── authStore.js     # Zustand auth state
        └── styles/              # CSS modules
```

---

## Deployment

### Frontend (Vercel)

The frontend is configured for deployment on [Vercel](https://vercel.com):

1. Connect your GitHub repo to Vercel
2. Set the **Root Directory** to `frontend`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variables in the Vercel dashboard

### Backend

The backend can be deployed to any Node.js hosting platform (Railway, Render, Fly.io, etc.):

1. Set the **Root Directory** to `backend`
2. Start command: `node src/server.js`
3. Configure all required environment variables
4. Ensure PostgreSQL and Neo4j are accessible from the hosting environment

### Database

- **PostgreSQL**: Use a managed service like [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Railway](https://railway.app)
- **Neo4j**: Use [Neo4j AuraDB](https://neo4j.com/cloud/aura-free/) free tier or self-host

---

## License

This project is for educational and portfolio purposes.
