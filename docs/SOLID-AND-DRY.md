# SOLID and DRY in this codebase

Every principle below is shown with the **actual file** in this project that demonstrates it, what the naive version would have looked like, and what the principle bought us.

Use this document when you are asked "where exactly did you apply SOLID?" — each section gives you a file to open on screen.

---

## S — Single Responsibility Principle

> A class should have one reason to change.

### Example: publishing an event touches three concerns, handled by three classes

| Class | File | Its single job |
|---|---|---|
| `EventService` | `application/services/content.services.ts` | Event-specific rules (RSVP, upcoming list) |
| `SummarizationService` | `application/services/summarization.service.ts` | Decide when text is worth summarising |
| `IndexingService` | `application/services/indexing.service.ts` | Keep the vector index in sync |

`EventService` never chunks text. `IndexingService` never knows what an event is. `SummarizationService` never touches the database.

**Naive alternative:** one `EventService` that validates, saves, calls the AI, chunks text, writes vectors and logs analytics. Every one of those concerns would then be a reason to edit the same file.

### More examples in this project

- `config/env.ts` is the **only** module that reads `process.env`. Configuration changes touch one file.
- `persistence/mappers.ts` is the **only** place a database row becomes a domain model.
- `interfaces/http/middleware/index.ts` is the **only** place an error becomes an HTTP status code.

---

## O — Open/Closed Principle

> Open for extension, closed for modification.

### Example: adding a new searchable entity type

Indexing behaviour is described by a **strategy object**, not by a `switch`:

```ts
// application/services/entity-index.registry.ts
export interface EntityIndexDescriptor<TEntity> {
  readonly type: IndexableEntityType;
  loadOne(id: string): Promise<TEntity | null>;
  loadAll(): Promise<TEntity[]>;
  getId(entity: TEntity): string;
  toDocument(entity: TEntity): SearchDocument;
}
```

Seven descriptors are registered in `container.ts`. To make a new entity (say `Job`) searchable you **add one descriptor** — `IndexingService`, `SemanticSearchService`, `AssistantService` and `RecommendationService` are not modified at all, yet they all immediately support it.

**Naive alternative:**

```ts
// the version we avoided
switch (entityType) {
  case 'EVENT': text = `${e.title} ${e.description}`; break;
  case 'RESOURCE': text = `${r.title} ${r.description}`; break;
  // …edit this switch every single time, in several files
}
```

### Second example: adding an AI vendor

`createAiProvider()` in `infrastructure/ai/ai-provider.factory.ts` is the only file that mentions Hugging Face. Adding OpenAI or Ollama means writing a new class that implements `IAiProvider` and adding one branch in the factory. No service changes.

---

## L — Liskov Substitution Principle

> Subtypes must be usable anywhere their base type is expected, without surprises.

### Example: the offline provider is a true substitute

`LocalAiProvider` and `HuggingFaceAiProvider` both implement `IAiProvider`. They return the same shapes, honour the same options and throw the same way.

This is not theoretical — it is what makes `ResilientAiProvider` possible:

```ts
// infrastructure/ai/resilient-ai.provider.ts
private async attempt<T>(operation: string, run: (provider: IAiProvider) => Promise<T>) {
  try {
    return await run(this.primary);     // Hugging Face
  } catch {
    return run(this.fallback);          // Local — a drop-in replacement
  }
}
```

If the two implementations were not genuinely substitutable, a mid-request failover would produce a different response shape and crash the caller.

**Where we had to respect LSP carefully:** embeddings from different models are numerically incomparable. Rather than let a substitution silently corrupt results, `SemanticSearchService` records the model and skips vectors whose dimension does not match the query:

```ts
const comparable = record.vector.length === queryVector.length && record.vector.length > 0;
const vectorScore = comparable ? VectorMath.cosineSimilarity(queryVector, record.vector) : 0;
```

---

## I — Interface Segregation Principle

> No client should be forced to depend on methods it does not use.

### Example: AI capabilities are three interfaces, not one

```ts
// domain/services/ai-provider.ts
export interface IEmbeddingProvider     { embed(texts: string[]): Promise<EmbeddingResult>; }
export interface ISummarizationProvider { summarize(text: string, o?): Promise<SummaryResult>; }
export interface IChatProvider          { complete(messages: ChatMessage[]): Promise<ChatResult>; }
```

Consequently each service declares only what it actually needs:

| Service | Depends on |
|---|---|
| `IndexingService` | `IEmbeddingProvider` only |
| `SummarizationService` | `ISummarizationProvider` only |
| `AssistantService` | `IChatProvider` (+ the search service) |
| `MatchmakingService` | `IEmbeddingProvider` only |

That means a future embeddings-only provider can be plugged into indexing without pretending to implement chat.

### Second example: repositories are narrow

There is no universal `IRepository`. `IEmbeddingRepository` exposes `upsertMany`, `findByTypes`, `findForEntity`, `deleteForEntity` — vector concerns only. `IInteractionRepository` exposes analytics aggregations. Neither carries methods the other would ignore.

---

## D — Dependency Inversion Principle

> Depend on abstractions, not concretions.

### Example: no service imports Prisma

```ts
// application/services/matchmaking.service.ts
export class MatchmakingService {
  constructor(
    private readonly profiles: IProfileRepository,   // interface
    private readonly projects: IProjectRepository,   // interface
    private readonly ai: IEmbeddingProvider,         // interface
  ) {}
}
```

The concrete classes are chosen once, in the composition root:

```ts
// container.ts
const profiles = new PrismaProfileRepository(prisma);
const ai = createAiProvider();
services.matchmaking = new MatchmakingService(profiles, projects, ai);
```

**What this buys us in practice:**

1. **Testability** — a unit test can pass `{ listAll: async () => [fakeProfile] }` and a fake embedder; no database, no network.
2. **Swappability** — moving to PostgreSQL means writing new repository classes and editing `container.ts`. Not one service changes.
3. **Honest boundaries** — because a service *cannot* reach the database directly, accidental coupling is impossible rather than merely discouraged.

---

# DRY — Don't Repeat Yourself

DRY here means "every decision has exactly one home", not "never type the same word twice".

## 1. The publish workflow is written once

Five content types (events, resources, announcements, posts, projects) share the same lifecycle: **summarise → persist → index**. It exists once, as a Template Method:

```ts
// application/services/indexed-content.service.ts
async create(input: TCreate): Promise<TEntity> {
  const withSummary = await this.withSummary(input);          // shared
  const entity = await this.repository.create(withSummary);   // shared
  await this.indexing.indexEntity(this.entityType, this.getId(entity)); // shared
  return entity;
}
```

Subclasses supply only what differs:

```ts
// application/services/content.services.ts
export class ResourceService extends IndexedContentService<Resource, ResourceInput, Partial<ResourceInput>> {
  protected getId(entity: Resource) { return entity.id; }
  protected getSummarySource(input: Partial<ResourceInput>) {
    return input.description ? { title: input.title ?? 'Resource', body: input.description } : null;
  }
}
```

**Saved:** five copies of the same orchestration, and five chances to forget the re-index step.

## 2. CRUD endpoints are generated, not typed out

```ts
// interfaces/http/routes/content-router.factory.ts
export const createContentRouter = <TService>(options: ContentRouterOptions<TService>): Router => { … }
```

One factory produces `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` for five entity types, with identical pagination, status codes and ownership injection. Entity-specific endpoints (`/events/:id/rsvp`, `/communities/:id/join`) are passed in as `extraRoutes`.

**Saved:** ~25 near-identical route handlers.

## 3. One ranking function for four features

Search, recommendations, matching and the RAG assistant all retrieve through `SemanticSearchService`. The blend weights live in one place:

```ts
private static readonly VECTOR_WEIGHT = 0.75;
private static readonly LEXICAL_WEIGHT = 0.25;
```

Changing how relevance works changes all four features consistently — and no feature can drift into its own private scoring rules.

## 4. Cross-cutting concerns each have one home

| Concern | Single home |
|---|---|
| Reading configuration | `config/env.ts` |
| JSON encode/decode for SQLite | `core/json.ts` |
| Tokenising, chunking, sentence splitting | `core/text-utils.ts` |
| Cosine, centroid, normalisation | `core/vector-math.ts` |
| Error → HTTP status | `interfaces/http/middleware/index.ts` |
| Async error catching | `asyncHandler` (one wrapper, not a try/catch per route) |
| Attaching the JWT to requests | `lib/api.ts` `request()` on the frontend |
| Colours, radius, typography | `theme/theme.ts` |
| Rendering a result card | `components/ui.tsx` `ResultCard` |
| Reporting content | `components/ReportDialog.tsx` |

## 5. Navigation is data

```tsx
// components/AppShell.tsx
const NAV_ITEMS = [
  { href: '/', label: 'Discover', icon: <ExploreIcon /> },
  …
];
```

The desktop sidebar, the mobile drawer, the active-route highlight and the page title in the top bar are all derived from this one array. Adding a page means adding one line.

---

## Quick answers for questions you may be asked

**"Show me one place where SOLID actually saved you work."**
`EntityIndexRegistry`. Profiles and projects were added to semantic search *after* search was built, and neither `SemanticSearchService` nor `AssistantService` needed a single edit.

**"Isn't the abstraction overkill for a demo?"**
The offline/Hugging Face fallback proves it is not. Because everything depends on `IAiProvider`, the app runs with no API key, and gains hosted models by pasting a token into `.env` — with no code change anywhere.

**"How would you test this?"**
Services take interfaces, so each one is unit-testable with hand-written fakes: `MatchmakingService` with a fake profile repository and a stub embedder, `ModerationService` with a fake embedding repository. No database or network needed.

**"What is the difference between DRY and just making helper functions?"**
DRY is about knowledge, not characters. The ranking weights (0.75 / 0.25) are a *decision*. They live in one class, so the decision cannot silently diverge between search and recommendations.
