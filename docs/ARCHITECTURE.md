# Architecture

This document explains how Community Space is put together, why each boundary exists, and how a request flows through the system.

---

## 1. Guiding idea

The codebase is organised so that **business rules do not depend on tools**.

Express, Prisma, SQLite and Hugging Face are *details*. They sit at the edges. The middle of the application — what a recommendation is, how a match is scored, when content gets summarised — is written in plain TypeScript with no framework imports.

Practically this means:

- You could replace Express with Fastify and only `interfaces/http` changes.
- You could replace SQLite with PostgreSQL and only `infrastructure/persistence` changes.
- You could replace Hugging Face with OpenAI or Ollama and only one new file appears in `infrastructure/ai`.

---

## 2. The layers

```
interfaces/http   ← knows about HTTP, Express, Zod
        │
        ▼
application       ← business logic, orchestration
        │
        ▼
domain            ← models + interfaces, zero dependencies
        ▲
        │
infrastructure    ← implements domain interfaces using real tools
```

### `domain/` — the contract layer

Contains no logic, no imports from any library.

- `domain/entities/models.ts` — plain shapes: `Profile`, `Event`, `Community`, `SearchHit`…
  These are *not* Prisma types. Prisma rows are converted into them, which is why nothing above this layer ever deals with JSON-encoded arrays.
- `domain/repositories/index.ts` — what persistence must be able to do (`IEventRepository`, `IEmbeddingRepository`…).
- `domain/services/ai-provider.ts` — what AI must be able to do (`IEmbeddingProvider`, `ISummarizationProvider`, `IChatProvider`).

### `application/services/` — the behaviour layer

One service per responsibility:

| Service | Responsibility |
|---|---|
| `AuthService` | register, login, identity |
| `ProfileService` | the member directory |
| `IndexedContentService` (abstract) | the shared publish workflow |
| `EventService`, `ResourceService`, `AnnouncementService`, `PostService`, `ProjectService`, `CommunityService` | entity-specific behaviour |
| `IndexingService` | keeps the vector index in sync |
| `SummarizationService` | decides *when* to summarise |
| `SemanticSearchService` | the single ranking engine |
| `AssistantService` | RAG prompt construction + citation |
| `RecommendationService` | builds the user interest vector |
| `MatchmakingService` | collaborator scoring |
| `ModerationService` | reports + automated triage |
| `AnalyticsService` | organizer dashboard aggregation |

Services receive their collaborators through the constructor. They never construct anything themselves and never import Prisma or `fetch`.

### `infrastructure/` — the implementation layer

- `persistence/` — Prisma repositories + `mappers.ts` (row → domain model, the only place JSON decoding happens).
- `ai/` — `HuggingFaceAiProvider`, `LocalAiProvider`, the `ResilientAiProvider` and `CachedEmbeddingProvider` decorators, and the factory that assembles them.
- `security/` — `BcryptPasswordHasher`, `JwtTokenService`.

### `interfaces/http/` — the delivery layer

- `routes/index.ts` — endpoint definitions and Zod schemas.
- `routes/content-router.factory.ts` — builds an identical CRUD router for any content service.
- `middleware/index.ts` — `asyncHandler`, authentication, role gate, 404 and error translation.

Controllers do three things only: validate input, call one service, serialise the result.

### `container.ts` — the composition root

The **only** file that calls `new` on concrete classes. It wires repositories, the AI provider, the index registry and every service, then hands the finished object graph to `app.ts`.

This is what turns "dependency inversion" from a slogan into something real: to switch the database or the AI vendor you edit this one file.

---

## 3. Request lifecycle

Example: `GET /api/ai/search?q=who can help with kubernetes costs`

```
1. Express route              validates the query with Zod
2. SemanticSearchService      embeds the query via IEmbeddingProvider
3. CachedEmbeddingProvider    returns a cached vector, or delegates…
4. ResilientAiProvider        …tries Hugging Face, falls back to local on failure
5. IEmbeddingRepository       loads candidate chunk vectors from SQLite
6. Ranking                    0.75 × cosine + 0.25 × keyword overlap
7. Grouping                   best chunk per entity
8. Hydration                  loads full domain objects for the top results
9. Interaction logged         feeds recommendations and analytics
10. JSON response             { query, hits[], tookMs, model }
```

Note that step 4 is invisible to step 2. The service asked for an embedding; how it was produced is not its concern.

---

## 4. Data model

SQLite via Prisma. Full schema: `apps/api/prisma/schema.prisma`.

```
User ─1:1─ Profile
User ─1:N─ Event / Resource / Announcement / Post / Project / Report
User ─N:M─ Community        (through Membership)
User ─N:M─ Event            (through Rsvp)

Community ─1:N─ Event / Resource / Announcement / Post

EmbeddingRecord   generic vector index over ALL of the above
Interaction       engagement signal (VIEW / SEARCH / RSVP / JOIN / SAVE)
AssistantQuery    every question asked, for organizer analytics
Report            moderation queue with AI triage fields
```

Two deliberate decisions:

**Arrays are stored as JSON strings.** SQLite has no array type. Rather than scatter `JSON.parse` calls around the codebase, decoding happens exclusively in `core/json.ts` and `persistence/mappers.ts`.

**One generic embedding table, not one per entity.** `EmbeddingRecord(entityType, entityId, chunkIndex, vector, metadata)` means semantic search, RAG, recommendations and duplicate detection all query the same index. Adding a new searchable entity requires no schema change.

---

## 5. Design patterns used

| Pattern | Where | Why |
|---|---|---|
| **Repository** | `domain/repositories` + `infrastructure/persistence` | Business logic is testable without a database |
| **Composition root / DI** | `container.ts` | One place controls all wiring |
| **Strategy** | `EntityIndexDescriptor` in `entity-index.registry.ts` | Each entity type describes how it is indexed; adding one changes no existing file |
| **Template Method** | `IndexedContentService` | The publish workflow is written once; subclasses fill in the differences |
| **Decorator** | `ResilientAiProvider`, `CachedEmbeddingProvider` | Add fallback and caching without touching providers or callers |
| **Factory** | `createAiProvider()` | Chooses the AI stack from configuration |
| **Abstract Factory (routers)** | `createContentRouter()` | Generates identical CRUD endpoints for five entity types |
| **Adapter** | `Mappers` | Translates Prisma rows into domain models |

---

## 6. Frontend architecture

```
app/layout.tsx
  └─ Providers        theme (light/dark) · session · toasts
      └─ AppShell     sidebar + top bar, navigation generated from one array
          └─ page     one folder per feature
```

- **`lib/api.ts`** — every network call goes through one `request()` helper that attaches the JWT, sets headers and normalises errors. No component calls `fetch`.
- **`theme/theme.ts`** — all design tokens (colour, radius, typography, component overrides). Feature code contains no hard-coded colours.
- **`components/ui.tsx`** — the shared kit: `PageHeader`, `ResultCard`, `MatchScore`, `AiSummary`, `TagList`, `StatCard`, `EmptyState`, `LoadingCards`. A search result looks the same on every page because it is literally the same component.
- **`components/ReportDialog.tsx`** — one moderation dialog reused by every content type.

---

## 7. Security notes

- Passwords hashed with bcrypt (10 rounds); hashes never leave the repository layer.
- JWT bearer tokens, verified by middleware; `auth.required` blocks, `auth.optional` personalises without blocking.
- Role gate (`auth.requireRole`) protects moderation resolution and re-indexing.
- All input validated with Zod before reaching a service.
- `helmet` sets security headers; CORS restricted to the configured origin.
- Configuration is validated at boot and the process exits on invalid config rather than failing mid-request.

> For a classroom/demo project the JWT secret ships with a default value. Any real deployment must set `JWT_SECRET`.

---

## 8. Known trade-offs

These are deliberate, and worth mentioning if you are asked "what would you do next?":

| Trade-off | Reason | Next step at scale |
|---|---|---|
| Cosine similarity computed in Node, not in the database | No external dependency; fast for thousands of chunks | pgvector or Qdrant with an ANN index |
| Some filtering (skills) happens in memory | SQLite cannot query inside JSON strings reliably | Proper join tables in PostgreSQL |
| Re-indexing is synchronous on write | Simple, and instant searchability | Background job queue |
| Offline embeddings are lexical-hash based, not neural | Works with zero setup and no key | Add the Hugging Face token — the code path is already there |
