# OtoBattle Backend Architecture

> **Status**: Design document (not yet implemented)
> **Author**: Auto-generated
> **Date**: 2026-03-05
> **Version**: 1.0

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Authentication Flow](#authentication-flow)
6. [Deployment Strategy](#deployment-strategy)
7. [Migration Plan](#migration-plan)
8. [Future Considerations](#future-considerations)

---

## Overview

OtoBattle is currently a fully client-side React + Canvas2D browser game. All state (best score, settings) is stored in `localStorage`. This document defines the architecture for adding server-side capabilities to support:

- User accounts (registration, login, profiles)
- Persistent score tracking and leaderboards
- Session management
- Future multiplayer/social features

### Design Principles

- **Incremental adoption**: The frontend must continue to work without the backend (offline/guest mode).
- **API-first**: All server features are exposed through a REST API, enabling future mobile clients.
- **Minimal complexity**: Choose technologies that are well-suited for a small team and low operational overhead.
- **Type safety end-to-end**: Share TypeScript types between frontend and backend where possible.

---

## Tech Stack

### Recommended Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Runtime** | Node.js 22 LTS | Same language as frontend (TypeScript). Unified tooling. |
| **Framework** | Fastify 5 | Faster than Express, built-in schema validation, TypeScript-first, excellent plugin ecosystem. |
| **Language** | TypeScript 5.9 | Already used in frontend. Enables shared type definitions. |
| **Database** | PostgreSQL 16 | Robust, scalable, excellent JSON support, free tiers on Railway/Supabase/Neon. |
| **ORM** | Prisma 6 | Type-safe queries, auto-generated client, migration management, works well with PostgreSQL. |
| **Auth** | JWT (access + refresh tokens) | Stateless, works well with SPA frontends. Refresh tokens enable session revocation. |
| **Validation** | Zod | Runtime validation matching TypeScript types. Integrates with Fastify via fastify-type-provider-zod. |
| **Password Hashing** | bcrypt (via `bcryptjs`) | Industry standard, no native dependencies (pure JS implementation). |

### Why Fastify over Express

- **Performance**: Fastify is ~2x faster in benchmarks for JSON serialization.
- **Schema validation**: Built-in JSON Schema / Zod integration for request/response validation.
- **TypeScript**: First-class TypeScript support with typed routes.
- **Plugins**: Encapsulated plugin system prevents global middleware pollution.
- **Logging**: Built-in Pino logger (structured JSON logs).

### Why PostgreSQL over SQLite

- **Concurrent access**: PostgreSQL handles multiple simultaneous connections (leaderboard queries + score submissions).
- **Cloud hosting**: Managed PostgreSQL is available on Railway, Supabase, Neon, and Fly.io with free tiers.
- **Scalability**: No file-locking issues. Supports connection pooling.
- **JSON support**: `jsonb` type for flexible game session metadata.
- **Full-text search**: Useful for future username search / friend-finding.

> **Note**: SQLite is acceptable for local development and testing via Prisma's multi-provider support.

---

## Database Schema

### Entity Relationship Diagram

```
users 1──N scores
users 1──N sessions
```

### Tables

#### `users`

Stores player accounts.

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(32) NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(64),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_email ON users (email);
```

#### `scores`

Stores individual game scores. Each completed game session creates one row.

```sql
CREATE TABLE scores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score         INTEGER NOT NULL,
  wave          INTEGER NOT NULL,
  combo_max     INTEGER NOT NULL DEFAULT 0,
  instrument    VARCHAR(16) NOT NULL DEFAULT 'piano',
  duration_sec  REAL NOT NULL DEFAULT 0,
  played_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scores_user_id ON scores (user_id);
CREATE INDEX idx_scores_score_desc ON scores (score DESC);
CREATE INDEX idx_scores_played_at ON scores (played_at DESC);
CREATE INDEX idx_scores_instrument ON scores (instrument);
```

#### `sessions`

Stores refresh tokens for JWT auth. Enables multi-device login and session revocation.

```sql
CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token VARCHAR(512) NOT NULL UNIQUE,
  user_agent    TEXT,
  ip_address    INET,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_refresh_token ON sessions (refresh_token);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);
```

### Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String    @id @default(uuid()) @db.Uuid
  username     String    @unique @db.VarChar(32)
  email        String    @unique @db.VarChar(255)
  passwordHash String    @map("password_hash") @db.VarChar(255)
  displayName  String?   @map("display_name") @db.VarChar(64)
  avatarUrl    String?   @map("avatar_url")
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  scores   Score[]
  sessions Session[]

  @@map("users")
}

model Score {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  score       Int
  wave        Int
  comboMax    Int      @default(0) @map("combo_max")
  instrument  String   @default("piano") @db.VarChar(16)
  durationSec Float    @default(0) @map("duration_sec") @db.Real
  playedAt    DateTime @default(now()) @map("played_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([score(sort: Desc)])
  @@index([playedAt(sort: Desc)])
  @@index([instrument])
  @@map("scores")
}

model Session {
  id           String   @id @default(uuid()) @db.Uuid
  userId       String   @map("user_id") @db.Uuid
  refreshToken String   @unique @map("refresh_token") @db.VarChar(512)
  userAgent    String?  @map("user_agent")
  ipAddress    String?  @map("ip_address")
  expiresAt    DateTime @map("expires_at") @db.Timestamptz
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([refreshToken])
  @@index([expiresAt])
  @@map("sessions")
}
```

---

## API Endpoints

Base URL: `/api/v1`

### Authentication

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| `POST` | `/auth/register` | Create new user account | No |
| `POST` | `/auth/login` | Authenticate and receive tokens | No |
| `POST` | `/auth/refresh` | Refresh access token | No (refresh token in body) |
| `POST` | `/auth/logout` | Revoke refresh token | Yes |
| `DELETE` | `/auth/sessions` | Revoke all sessions (logout everywhere) | Yes |

#### `POST /auth/register`

```json
// Request
{
  "username": "player1",
  "email": "player1@example.com",
  "password": "securePassword123"
}

// Response 201
{
  "user": {
    "id": "uuid",
    "username": "player1",
    "displayName": null,
    "createdAt": "2026-03-05T00:00:00Z"
  },
  "accessToken": "eyJhbG...",
  "refreshToken": "dGhpcyBpcyBh..."
}
```

Validation:
- `username`: 3-32 characters, alphanumeric + underscore only, unique
- `email`: valid email format, unique
- `password`: 8-128 characters, at least one letter and one number

#### `POST /auth/login`

```json
// Request
{
  "email": "player1@example.com",
  "password": "securePassword123"
}

// Response 200
{
  "user": {
    "id": "uuid",
    "username": "player1",
    "displayName": "Player One"
  },
  "accessToken": "eyJhbG...",
  "refreshToken": "dGhpcyBpcyBh..."
}
```

#### `POST /auth/refresh`

```json
// Request
{
  "refreshToken": "dGhpcyBpcyBh..."
}

// Response 200
{
  "accessToken": "eyJhbG...",
  "refreshToken": "bmV3IHJlZnJl..."
}
```

#### `POST /auth/logout`

```
Authorization: Bearer <accessToken>
```

```json
// Request
{
  "refreshToken": "dGhpcyBpcyBh..."
}

// Response 204 (No Content)
```

### User Profile

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| `GET` | `/users/me` | Get current user profile | Yes |
| `PATCH` | `/users/me` | Update display name / avatar | Yes |
| `GET` | `/users/:username` | Get public user profile | No |

#### `GET /users/me`

```json
// Response 200
{
  "id": "uuid",
  "username": "player1",
  "email": "player1@example.com",
  "displayName": "Player One",
  "avatarUrl": null,
  "createdAt": "2026-03-05T00:00:00Z",
  "stats": {
    "totalGames": 42,
    "bestScore": 15000,
    "bestWave": 12,
    "bestCombo": 18,
    "favoriteInstrument": "piano"
  }
}
```

### Scores

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| `POST` | `/scores` | Submit a game score | Yes |
| `GET` | `/scores/me` | Get current user's score history | Yes |
| `GET` | `/scores/me/best` | Get current user's personal best | Yes |

#### `POST /scores`

```json
// Request
{
  "score": 5200,
  "wave": 7,
  "comboMax": 12,
  "instrument": "piano",
  "durationSec": 183.5
}

// Response 201
{
  "id": "uuid",
  "score": 5200,
  "wave": 7,
  "comboMax": 12,
  "instrument": "piano",
  "durationSec": 183.5,
  "playedAt": "2026-03-05T12:00:00Z",
  "rank": 42,
  "isPersonalBest": true
}
```

#### `GET /scores/me`

Query parameters: `?limit=20&offset=0&instrument=piano`

```json
// Response 200
{
  "scores": [
    {
      "id": "uuid",
      "score": 5200,
      "wave": 7,
      "comboMax": 12,
      "instrument": "piano",
      "durationSec": 183.5,
      "playedAt": "2026-03-05T12:00:00Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

### Leaderboard

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| `GET` | `/leaderboard` | Get global top scores | No |
| `GET` | `/leaderboard/weekly` | Get weekly top scores | No |
| `GET` | `/leaderboard/instrument/:instrument` | Get top scores by instrument | No |

#### `GET /leaderboard`

Query parameters: `?limit=50&offset=0`

```json
// Response 200
{
  "entries": [
    {
      "rank": 1,
      "user": {
        "username": "maestro42",
        "displayName": "Maestro",
        "avatarUrl": null
      },
      "score": 28500,
      "wave": 22,
      "comboMax": 35,
      "instrument": "violin",
      "playedAt": "2026-03-04T18:30:00Z"
    }
  ],
  "total": 1500,
  "limit": 50,
  "offset": 0
}
```

#### `GET /leaderboard/weekly`

Same response format as `/leaderboard`. Filters scores to the current week (Monday 00:00 UTC to Sunday 23:59 UTC).

#### `GET /leaderboard/instrument/:instrument`

Same response format. Valid instruments: `piano`, `violin`, `viola`, `cello`, `guitar`, `flute`, `voice`.

### Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Username must be 3-32 characters",
    "details": [
      {
        "field": "username",
        "message": "Must be at least 3 characters"
      }
    ]
  }
}
```

| HTTP Status | Error Code | Description |
|-------------|-----------|-------------|
| 400 | `VALIDATION_ERROR` | Request body/params failed validation |
| 401 | `UNAUTHORIZED` | Missing or invalid access token |
| 403 | `FORBIDDEN` | Valid token but insufficient permissions |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Username or email already taken |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## Authentication Flow

### Token Strategy

- **Access Token**: Short-lived JWT (15 minutes). Contains `userId` and `username`. Sent in `Authorization: Bearer <token>` header.
- **Refresh Token**: Long-lived opaque token (30 days). Stored in `sessions` table. Sent in request body (not cookies, for SPA compatibility).
- **Token Rotation**: Each refresh request issues a new refresh token and invalidates the old one (prevents reuse attacks).

### JWT Payload

```json
{
  "sub": "user-uuid",
  "username": "player1",
  "iat": 1741132800,
  "exp": 1741133700
}
```

### Flow Diagram

```
1. Register/Login
   Client  ──POST /auth/register──>  Server
   Client  <──{accessToken, refreshToken}──  Server

2. Authenticated Requests
   Client  ──GET /scores/me──>  Server
           Authorization: Bearer <accessToken>
   Client  <──{scores: [...]}──  Server

3. Token Refresh (when accessToken expires)
   Client  ──POST /auth/refresh──>  Server
           {refreshToken: "..."}
   Client  <──{accessToken, refreshToken}──  Server
   (old refreshToken is invalidated)

4. Logout
   Client  ──POST /auth/logout──>  Server
           Authorization: Bearer <accessToken>
           {refreshToken: "..."}
   Server  ──deletes session row──
   Client  <──204──  Server
```

### Security Measures

- Passwords hashed with bcrypt (cost factor 12).
- Rate limiting on auth endpoints (10 requests/minute per IP).
- Refresh token rotation prevents replay attacks.
- Access tokens are short-lived (15 min) to limit exposure window.
- `sessions` table enables server-side revocation (logout everywhere).
- CORS configured to allow only the frontend origin.
- Helmet middleware for security headers.

---

## Deployment Strategy

### Recommended: Railway

| Aspect | Details |
|--------|---------|
| **Frontend** | Vite static build deployed to Vercel (or Railway static site) |
| **Backend** | Fastify server on Railway (Dockerfile or Nixpacks auto-detect) |
| **Database** | Railway PostgreSQL add-on (free tier: 1 GB) |
| **Domain** | Custom domain via Railway or Vercel |
| **CI/CD** | GitHub Actions: lint + typecheck + build, auto-deploy on push to `main` |

### Alternative Options

| Option | Frontend | Backend | Database | Pros | Cons |
|--------|----------|---------|----------|------|------|
| **Railway** | Vercel | Railway | Railway PG | Simple, integrated, free tier | Limited free tier resources |
| **Fly.io** | Vercel | Fly.io | Fly PG | Global edge, generous free tier | More complex deployment config |
| **Vercel + Neon** | Vercel | Vercel Functions | Neon PG | Single platform, serverless | Cold starts, execution time limits |
| **Self-hosted** | Nginx | Docker | Docker PG | Full control | Requires server management |

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/otobattle

# Auth
JWT_SECRET=<random-64-char-string>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# Server
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://otobattle.example.com

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

### Project Structure

```
otobattle/
  src/                    # Frontend (existing)
    game/
    components/
    hooks/
    audio/
    utils/
  server/                 # Backend (new)
    src/
      index.ts            # Fastify server entry
      config.ts           # Environment config (via @fastify/env)
      plugins/
        auth.ts           # JWT + auth middleware plugin
        prisma.ts         # Prisma client plugin
        cors.ts           # CORS configuration
        rateLimit.ts      # Rate limiting plugin
      routes/
        auth.ts           # /api/v1/auth/*
        users.ts          # /api/v1/users/*
        scores.ts         # /api/v1/scores/*
        leaderboard.ts    # /api/v1/leaderboard/*
      services/
        authService.ts    # Registration, login, token logic
        scoreService.ts   # Score submission, history, aggregation
        leaderboardService.ts  # Leaderboard queries
      schemas/
        auth.ts           # Zod schemas for auth routes
        scores.ts         # Zod schemas for score routes
        leaderboard.ts    # Zod schemas for leaderboard routes
      types/
        index.ts          # Shared types (can import from ../src/game/types.ts)
    prisma/
      schema.prisma
      migrations/
    package.json          # Separate dependencies
    tsconfig.json
  docs/
    backend-architecture.md  # This document
  package.json            # Frontend dependencies (existing)
  vite.config.ts          # Frontend build (existing)
```

---

## Migration Plan

### Phase 1: Backend Foundation (Week 1-2)

**Goal**: Set up the backend server, database, and auth system.

1. Create `server/` directory with its own `package.json` and `tsconfig.json`.
2. Initialize Prisma with the schema above.
3. Implement auth endpoints (register, login, refresh, logout).
4. Deploy backend to Railway with PostgreSQL.
5. Add CORS configuration for the frontend origin.

**Deliverables**: Working auth API, deployed database, CI/CD pipeline.

### Phase 2: Score Submission (Week 2-3)

**Goal**: Enable authenticated users to submit and retrieve scores.

1. Implement `POST /scores` endpoint.
2. Implement `GET /scores/me` and `GET /scores/me/best` endpoints.
3. Add frontend integration:
   - New `src/utils/api.ts` module for HTTP requests.
   - On game over, if logged in, submit score to server.
   - Continue saving to `localStorage` as fallback (guest mode).

**Deliverables**: Score persistence for logged-in users.

### Phase 3: Leaderboard (Week 3-4)

**Goal**: Public leaderboards viewable by all players.

1. Implement leaderboard endpoints (global, weekly, per-instrument).
2. Add frontend leaderboard component.
3. Add leaderboard link to title screen and game over screen.

**Deliverables**: Viewable leaderboards, both global and weekly.

### Phase 4: User Profiles (Week 4-5)

**Goal**: User profile pages with stats and score history.

1. Implement user profile endpoints.
2. Add frontend profile page/modal.
3. Add login/register UI components.
4. Implement token storage and refresh logic in frontend.

**Deliverables**: Complete user account flow.

### Frontend Integration Points

The frontend currently stores data via `localStorage` (`src/utils/storage.ts`). The migration adds an API layer alongside `localStorage`:

```typescript
// src/utils/api.ts (new file)

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (res.status === 401) {
    // Attempt token refresh
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`
      return fetch(`${API_BASE}${path}`, { ...options, headers })
    }
  }
  return res
}

export async function submitScore(data: {
  score: number
  wave: number
  comboMax: number
  instrument: string
  durationSec: number
}) {
  return apiFetch('/scores', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
```

The `GameCanvas.tsx` game over handler would be extended:

```typescript
// In GameCanvas.tsx, after saveBestScore(hud.score):
if (isLoggedIn) {
  submitScore({
    score: hud.score,
    wave: hud.wave,
    comboMax: hud.maxCombo,
    instrument: hud.settings.instrument,
    durationSec: hud.duration,
  }).catch(() => {
    // Silently fail - localStorage already has the score
  })
}
```

### Backward Compatibility

- **Guest mode**: Users who are not logged in continue using `localStorage` for best scores. No server dependency.
- **Offline play**: The game works entirely offline. Score submission is attempted but failure is silent.
- **No breaking changes**: All existing frontend functionality remains intact. Backend features are purely additive.

---

## Future Considerations

### Potential Extensions (Not in Scope)

| Feature | Complexity | Description |
|---------|-----------|-------------|
| **OAuth login** | Medium | Google/GitHub/Discord login via Passport.js or @fastify/oauth2 |
| **WebSocket multiplayer** | High | Real-time head-to-head mode via Fastify WebSocket plugin |
| **Achievement system** | Medium | Badge/trophy table, triggered by score milestones |
| **Replay system** | High | Record input sequences server-side for playback |
| **Admin dashboard** | Medium | User management, score moderation, analytics |
| **Anti-cheat** | High | Server-side score validation, input replay verification |

### Performance Targets

| Metric | Target |
|--------|--------|
| API response time (p95) | < 100ms |
| Leaderboard query time | < 50ms (indexed) |
| Score submission time | < 200ms |
| Concurrent users | 100+ (Railway starter) |
| Database size (1 year) | < 500 MB |

### Monitoring

- **Logging**: Pino structured JSON logs (built into Fastify).
- **Health check**: `GET /health` endpoint for uptime monitoring.
- **Error tracking**: Sentry integration (optional).
- **Metrics**: Response time, error rate, active users (via Railway dashboard or custom).
