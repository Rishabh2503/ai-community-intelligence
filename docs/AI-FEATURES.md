# AI Features — how they actually work

This is the document to read before you present. It explains each AI feature at a level you can defend in questioning, including the parts that are *not* magic.

---

## The provider abstraction

Everything AI-related goes through three interfaces:

```ts
IEmbeddingProvider      embed(texts)      → vectors
ISummarizationProvider  summarize(text)   → summary + highlights
IChatProvider           complete(msgs)    → grounded answer
```

Two implementations ship with the project:

| | `HuggingFaceAiProvider` | `LocalAiProvider` |
|---|---|---|
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` (384-d) | hashing vectorizer (384-d) |
| Summaries | `facebook/bart-large-cnn` (abstractive) | TextRank-style (extractive) |
| Answers | `Llama-3.2-3B-Instruct` (generative) | passage composition (extractive) |
| Needs a key | yes (free tier) | no |
| Needs internet | yes | no |

They are wrapped by two decorators:

```
CachedEmbeddingProvider( ResilientAiProvider( HuggingFace, Local ) )
```

- **Resilient** — if Hugging Face errors, times out (15s) or is rate-limited, the local provider answers instead. Your demo cannot fail because of someone else's uptime.
- **Cached** — repeated texts (search queries during a demo) are embedded once.

Selection happens in `createAiProvider()` based on `AI_PROVIDER` and whether `HUGGINGFACE_API_KEY` is set.

---

## 1. Embeddings and the index

### What gets indexed

Seven entity types. For each, a descriptor builds a **searchable document**: the title, the meaningful body, plus context that a person might search by.

An event becomes:

```
GraphQL API Engineering Workshop. <summary or description>
Mode: HYBRID. Venue: Koramangala, Bengaluru.
Starts: 10 Oct 2026, 10:00. Ends: 10 Oct 2026, 14:00.
Hosted by Bengaluru JavaScript Collective, organised by Aarav Sharma.
Topics: GraphQL, Node.js, API.
```

This is why "hybrid events in Bengaluru next month" can match even though those exact words are not in the description.

### Chunking

Documents are split into ~700-character chunks with ~120 characters of overlap, on sentence boundaries. **The title is prepended to every chunk**, so a chunk taken from the middle of a long announcement still carries its subject.

Each chunk is stored as:

```
EmbeddingRecord(entityType, entityId, chunkIndex, content, vector, model, metadata)
```

The seed corpus produces 42 chunks from 32 entities.

### How the offline embedder works

Since we cannot run a neural model without a dependency, `LocalAiProvider` uses a **hashing vectorizer**:

1. Tokenise, remove stop words.
2. Add bigrams so phrases like "machine learning" survive.
3. Add 3-character shingles so "kubernetes"/"kubernetes'"/"k8s-style" typos still land nearby.
4. Hash each feature to one of 384 buckets with a signed hash (reduces collision bias).
5. Weight by `1 + log(term frequency)` and L2-normalise.

The result behaves like TF-IDF in a fixed-size vector space: **topically similar texts land close together**, but it does not understand synonyms the way a neural model does. That is exactly why the hybrid ranking below matters, and why the Hugging Face path exists.

> Be honest about this in your presentation. "Offline mode uses a lexical vectorizer; adding a free Hugging Face token switches it to a real sentence-transformer, with no code change" is a much stronger answer than claiming neural embeddings everywhere.

---

## 2. Hybrid ranking

`SemanticSearchService` scores every chunk:

```
score = 0.75 × cosine(query_vector, chunk_vector)
      + 0.25 × |query_tokens ∩ chunk_tokens| / |query_tokens|
```

**Why not pure vector search?** Short queries — the most common kind — are dominated by exact terms. A user searching "CKA" wants the CKA study group, not "things about certification in general". The lexical term keeps precise matches competitive.

**Why not pure keyword search?** Then "who can help me save money on my cluster" would miss "Kubernetes Cost Optimisation Clinic" entirely.

Then:

- Only the **best chunk per entity** is kept, so a long announcement cannot occupy five result slots.
- Vectors whose dimension does not match the query are skipped — a safety net if the index was built with a different model.
- Each hit carries `reasons[]` ("Strong semantic match", "Mentions kubernetes, cost") which the UI displays. Explainability is a feature, not an afterthought.

`matchPercentage` maps the score into 0–100 for display.

---

## 3. RAG knowledge assistant

```
question
  │
  ├─ retrieve top-6 chunks (same hybrid ranking)
  ├─ keep chunks scoring > 0.08
  ├─ GUARDRAIL: measure question coverage  → below 0.7, refuse to answer
  ├─ build the prompt:
  │     system: answer ONLY from CONTEXT, say so if it is not there
  │     system: CONTEXT: [1] EVENT :: Title \n <chunk> …
  │     user:   <question>
  ├─ generate  (Llama via HF, or extractive composition offline)
  ├─ attach de-duplicated citations with relevance scores
  └─ log question + topic label  → organizer analytics
```

### The grounding guardrail

A high similarity score does **not** mean the question was answered. "What is the refund policy for paid workshops?" retrieves workshop content with a strong score while saying nothing about refunds — the classic setup for a confident wrong answer.

So before generating, the assistant measures **coverage**: the share of the question's *content words* that appear in the retrieved context. Generic asking-words ("know", "explain", "provide", "tell") are filtered out first, otherwise "What should I know about accessibility audits?" would be penalised for a question about *knowing* rather than about *accessibility audits*.

Measured on the seed corpus:

| Question | Coverage | Outcome |
|---|---|---|
| "resources explaining RAG chunking" | 1.00 | answered |
| "winter hackathon team size rules" | 0.80 | answered |
| "how to join the CKA study group" | 0.75 | answered |
| "dress code and parking at the venue" | 0.60 | **refused** |
| "refund policy for paid workshops" | 0.50 | **refused** |
| "free lunch and airport pickup" | 0.17 | **refused** |

The threshold is **0.7**. Validated on 11 questions — 7 answerable, 4 unanswerable — with no misclassification.

When it refuses, it does so usefully:

> *"I don't have that information in the community knowledge base yet, so I'd rather not guess. The closest published content I could find is: "Kubernetes Cost Optimisation Clinic". An organizer can publish it as an announcement or resource and I'll be able to answer next time."*

The question is still logged, so refusals become **content gaps** on the organizer dashboard.

### Grounding

The system prompt forbids outside knowledge, and the UI shows a `grounded` / `low confidence` badge plus every source used. A member can verify any claim in two clicks.

### The offline answer composer

Without an LLM we cannot write new prose, so the local provider does the honest thing: it **selects and presents the most relevant passages**.

It parses the `[n] TYPE :: Title` blocks, removes the citation scaffolding, drops fragments left over from chunk overlap (passages beginning mid-sentence), removes duplicate sources, ranks the remainder by vocabulary overlap with the question, discards passages that share nothing with the question, and renders the top three with their titles.

The result reads like a well-organised answer and is 100% grounded — it physically cannot hallucinate.

### Follow-up questions

Generated from the *types* of the retrieved sources: an event source suggests "What should I prepare for …?", a project source suggests "Who can I team up with for …?". This is what makes the interface conversational rather than a search box with extra steps.

---

## 4. Recommendations

The interest vector is a weighted average:

| Signal | Weight | Source |
|---|---|---|
| Stated intent | ×2 | what the user just typed |
| Profile | ×1 | headline, bio, skills, interests, expertise |
| Activity | ×1 | centroid of the last 12 entities viewed/joined/RSVP'd |

That composite vector is fed into the same retrieval engine. Items the user already joined or RSVP'd to are excluded.

**Cold start:** a brand-new signed-out visitor has no signals, so the service falls back to *trending* — entities ranked by recent interaction count. No empty screen.

The response includes a human-readable `basis` string, which the UI prints under the heading:

> *Ranked using your request "I want to learn about vector search" + your skills (React, Node.js) + what you recently viewed and joined.*

---

## 5. Collaborator matching

```
score = 0.55 × cosine(project brief, member profile)
      + 0.35 × (required skills the member has ÷ required skills)
      + 0.10 × (availability × 0.6 + min(experience/8, 1) × 0.4)
```

Availability weighting: `LOOKING_FOR_TEAM` 1.0 · `OPEN` 0.7 · `BUSY`/`HIRING` 0.2.

Every candidate returns `matchedSkills`, `missingSkills` and `reasons`, so a user sees *why* — and just as importantly, what the gap is:

> **Rohan Gupta — 50%**
> Covers React Native · Profile is semantically close to the project brief · Actively looking for a team · **Gap: UI Design**

One embedding call handles the whole pool: the brief and every profile are embedded in a single batched request.

---

## 6. Summarisation

`SummarizationService` applies the policy; the provider does the work.

- Text under **280 characters** is returned unchanged — summarising a two-line description wastes a call and helps nobody.
- Longer text is condensed to ~3 sentences, optionally as bullets.
- Summaries are generated **on write**, stored on the row, and shown on cards — so reading a list never triggers AI calls.
- The summary is also what gets indexed for events and resources, which keeps the vector index focused on substance.

The offline summariser scores sentences by term frequency (normalised by sentence length), boosts early sentences — announcements front-load the who/what/when — penalises very short fragments, then restores the original order so the summary reads naturally.

---

## 7. Moderation triage

Three explainable checks, combined into a priority score:

**a. Near-duplicate detection**

```
similarity = 0.5 × cosine(new content, indexed chunk)
           + 0.5 × containment(new content, indexed chunk)
```

`containment` is asymmetric — *what fraction of the new text's vocabulary already exists in the stored chunk*. This matters because indexed chunks are enriched with metadata and may be partial, so pure cosine under-reports a genuine copy.

Measured on the seed corpus:

| Case | Blended score | Verdict |
|---|---|---|
| Exact re-post | 0.58 | `LIKELY_DUPLICATE` |
| Reworded re-post | 0.46 | `NEEDS_HUMAN_REVIEW` |
| Genuinely new event | 0.12 | `LIKELY_FINE` |

Thresholds (0.55 duplicate, 0.40 worth showing) were chosen from these measurements, not guessed.

**b. Spam heuristics** — promotional phrases, ≥3 outbound links, all-caps bodies, contact-number patterns.

**c. Flagged-term lexicon** — a small word list for obviously abusive content.

The highest signal sets the priority score; the queue is sorted by it. **A human always decides.** The AI never deletes anything — it only ranks what a moderator should look at first, and explains why.

Triage is also exposed as a **pre-publish check** (`POST /ai/../moderation/triage`), which the event form calls before publishing. Preventing a duplicate is better than reporting one.

---

## 8. Organizer analytics

Beyond counts and charts, the genuinely useful output is **knowledge demand**:

- Every assistant question is logged with a topic label (its top keywords).
- `topTopics` shows what members keep asking.
- `unansweredSignals` cross-references those topics against published resource titles and tags, surfacing **topics with high demand and little content** — a direct, evidence-based answer to "what should we publish next?"

`skillSupply` aggregates member skills, showing an organizer whether the community can staff the projects it is attracting.

---

## Limitations (say these before you are asked)

| Limitation | Mitigation already in place |
|---|---|
| Offline embeddings are lexical, not semantic in the neural sense | Hybrid ranking compensates; a free HF token upgrades it with no code change |
| Similarity is computed in Node, not in the database | Fine for thousands of chunks; the repository interface allows swapping in pgvector/Qdrant |
| Switching models invalidates existing vectors | `npm run db:reset` re-indexes; mismatched dimensions are skipped rather than scored wrongly |
| Re-indexing happens synchronously on write | Keeps content instantly searchable; a queue is the obvious next step |
| Spam lexicon is small and English-only | It is one clearly-marked list; a hosted classifier can be added behind the same interface |
