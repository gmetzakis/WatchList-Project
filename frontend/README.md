# MyCineShelf — Frontend

Single-page application built with **React 19**, **Vite 8**, and **Tailwind CSS 4**.

## Quick Start

```bash
npm install
cp .env.example .env   # Configure if needed
npm run dev            # Start on http://localhost:5173
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

## Architecture

```
src/
├── App.jsx              # Root layout (header + outlet)
├── main.jsx             # React entry point
├── api/
│   ├── axios.js         # Axios instance with JWT interceptors
│   └── media.js         # Media API helper functions
├── components/
│   └── header.jsx       # Navigation bar
├── pages/               # Route-level page components
├── router/
│   ├── AppRouter.jsx    # Route definitions
│   └── ProtectedRoute.jsx  # Auth guard wrapper
├── store/
│   └── authStore.js     # Zustand auth state (persisted)
└── styles/              # CSS files (Tailwind + custom)
```

### Key Libraries

| Library | Usage |
|---|---|
| **Zustand** | Auth state with localStorage persistence |
| **React Router 7** | Client-side routing with protected routes |
| **Framer Motion** | Page transitions and UI animations |
| **Embla Carousel** | Media recommendation carousels |
| **Lucide React** | Icon set |

## Deployment

Configured for **Vercel** — see [`vercel.json`](vercel.json) for the SPA rewrite rule.

Set the root directory to `frontend` and build command to `npm run build`.
