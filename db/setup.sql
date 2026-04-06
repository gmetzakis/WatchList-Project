-- ============================================================
-- MyCineShelf — PostgreSQL Schema Setup
-- ============================================================
-- Run this file against an empty database to create all tables:
--
--   createdb mycineshelf
--   psql -d mycineshelf -f db/setup.sql
--
-- Or from within psql:
--   \i db/setup.sql
-- ============================================================

BEGIN;

-- -----------------------------------------------------------
-- 1. Users
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
);

-- Case-insensitive email lookups
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

-- -----------------------------------------------------------
-- 2. User Profiles
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name     TEXT,
    last_name      TEXT,
    username       TEXT UNIQUE,
    year_of_birth  INTEGER,
    country        TEXT,
    movies_watched INTEGER NOT NULL DEFAULT 0,
    series_watched INTEGER NOT NULL DEFAULT 0
);

-- Case-insensitive username lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username_lower
    ON user_profiles (LOWER(username));

-- -----------------------------------------------------------
-- 3. User Avatars
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_avatars (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    image_data TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 4. Password Reset Tokens
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash
    ON password_reset_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires
    ON password_reset_tokens (expires_at);

-- -----------------------------------------------------------
-- 5. Media (movies & series from TMDB)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
    id           SERIAL PRIMARY KEY,
    tmdb_id      INTEGER NOT NULL,
    type         TEXT NOT NULL,              -- 'movie' or 'series'
    title        TEXT NOT NULL,
    poster_path  TEXT,
    genres       TEXT[] NOT NULL DEFAULT '{}',
    release_year INTEGER,
    UNIQUE (tmdb_id, type)
);

-- -----------------------------------------------------------
-- 6. User Media (watchlist, watched, ratings, favorites)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_media (
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_id    INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'watchlist',  -- 'watchlist' or 'watched'
    genres      TEXT[],
    watched_at  TIMESTAMPTZ,
    rating      NUMERIC,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_user_media_status
    ON user_media (user_id, status);

-- -----------------------------------------------------------
-- 7. Friend Requests
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS friend_requests (
    id             SERIAL PRIMARY KEY,
    requester_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_by   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'declined')),
    receiver_seen  BOOLEAN NOT NULL DEFAULT FALSE,
    requester_seen BOOLEAN NOT NULL DEFAULT TRUE,
    responded_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_requester
    ON friend_requests (requester_id, status);

CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver
    ON friend_requests (receiver_id, status);

-- -----------------------------------------------------------
-- 8. User Disliked Media (explore discards)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_disliked_media (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_id   INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, media_id)
);

COMMIT;

-- ============================================================
-- Schema created successfully!
-- ============================================================
