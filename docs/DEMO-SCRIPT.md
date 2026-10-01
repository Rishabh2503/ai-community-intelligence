# Demo script — 7 minutes

A tested walkthrough. Every step below has been verified to work on the seeded database.

---

## Before you start (2 minutes, do this offline)

```bash
npm install          # only if you have not already
npm run db:setup     # seeds data and builds the index
npm run dev          # leave this running
```

Open **http://localhost:3000** and check:

- The Discover page shows recommendation cards.
- Sign in as `aarav@communityspace.dev` / `password123` (click the account button in the dialog to auto-fill).

### Demo accounts and what each one can see

| Account | Role | Sidebar |
|---|---|---|
| *(signed out)* | — | 7 public pages |
| `rohan@communityspace.dev` | Student member | 7 public pages |
| `aarav@communityspace.dev` | Organizer | + Organizer Analytics |
| `sara@communityspace.dev` | Admin | + Organizer Analytics **and** Moderation |

Password for all: `password123`. Start as **aarav** (steps 1–5), switch to **sara** for step 6.

Keep a second tab on **http://localhost:4000/api/health** — handy if someone asks "is the AI real or hardcoded?"

> Present in **dev mode**. Do not run a production build during the demo.

---

## The story (say this in ~20 seconds)

> "Communities today are scattered across WhatsApp groups, Instagram posts, spreadsheets and Google Forms. If you join a college developer community today, you cannot answer three basic questions: what is happening, who can help me, and where is that thing someone posted last month. Community Space makes all of that searchable and answerable."

---

## 1 · Intent-based discovery (60s) — `/`

1. Point out the four stat cards — real numbers from the database.
2. Type into the intent box:
   > `I want to learn about vector search and find people to build with`
3. Click **Recommend**.

**Say:** "This is not keyword matching. The system built an interest vector from three things — what I just typed, my profile skills, and what I've recently viewed or joined — and searched everything the community has published."

4. Point at the line under the heading: *"Ranked using your request … + your skills (React, Node.js, TypeScript) + what you recently viewed and joined."*

**Say:** "Every ranking in this app explains itself. That is deliberate."

---

## 2 · Semantic search (60s) — `/search`

1. Click the example chip: **"Who can help me with Kubernetes costs?"**

**Say:** "Notice the top results do not contain the words 'help' or 'costs' in the way I typed them. It found the Kubernetes Cost Optimisation Clinic *and* the DevOps engineer whose profile mentions cost optimisation — an event and a person, from one question."

2. Point at the **reasons** chips and the **match percentage** on a card.

**Say:** "Ranking is a hybrid: 75% vector similarity for meaning, 25% keyword overlap so exact terms like 'CKA' or 'Docker' stay competitive. Seven entity types are indexed — events, resources, announcements, discussions, communities, member profiles and open projects."

3. *(Optional)* Toggle **People** to filter to profiles only.

---

## 3 · RAG knowledge assistant (90s) — `/assistant` ⭐ the centrepiece

1. Click the starter: **"When is the winter hackathon and what are the team size rules?"**

**Say while it loads:** "This is retrieval augmented generation. It embedded my question, retrieved the six most relevant passages from the knowledge base, and answered using only those."

2. When the answer appears, scroll to **SOURCES**.

**Say:** "Three things matter here. First, the sources — every claim is traceable, so nobody has to trust a chatbot. Second, the **grounded** badge — if retrieval had found nothing relevant, it would say 'low confidence' instead of inventing an answer. Third, the follow-up chips — that is what makes this discovery rather than search."

3. Click a follow-up chip to show it is a real conversation.

4. Ask a question that has no answer, e.g.:
   > `What is the refund policy for paid workshops?`

**Say:** "It refuses instead of hallucinating — and notice it names the closest content it *does* have. Before answering, it measures how much of my question's vocabulary the retrieved passages actually cover. If that is below 70%, it declines. Retrieving something similar is not the same as being able to answer, and that distinction is the difference between a demo and something a community could rely on."

---

## 4 · Teammate matching (60s) — `/people` → *Find teammates*

1. Leave the project dropdown on the free-form option.
2. Brief: `Building a mobile study group app for a hackathon`
3. Required skills: `React Native, UI Design`
4. Click **Find collaborators**.

**Say:** "Scoring blends three signals: 55% semantic similarity between the brief and the person's profile, 35% hard skill coverage, 10% availability and experience."

5. Point at **Rohan Gupta**.

**Say:** "Covers React Native, actively looking for a team — and crucially it tells me the gap: he does not cover UI Design. A matching system that only says '87% match' is useless. This one tells you what is missing so you know who else to recruit."

---

## 5 · Organizer side: publish + AI summary (60s) — `/events`

1. Click **Publish event**.
2. Fill in a title and paste a long description (any 4–5 sentence paragraph).
3. Click **Run AI duplicate check** first.

**Say:** "Before publishing, it checks the new content against everything already indexed. If an organizer is about to post a duplicate event, we stop it here rather than reporting it later."

4. Click **Publish**, then find the new card.

**Say:** "Two things just happened automatically: the long description was summarised — that is the AI summary badge — and the event was chunked, embedded and added to the search index."

5. Go to `/search` and search for a distinctive phrase from the description you just pasted.

**Say:** "Published seconds ago, already semantically searchable."

---

## 6 · Moderation (45s) — `/moderation`

> **Switch account first.** The moderation queue is **admin-only**. Sign out and sign back in as `sara@communityspace.dev` (Admin / moderator) — the sign-in dialog has a click-to-fill button for it.
>
> **Worth saying while you switch:** "Notice the sidebar just changed. As an organizer I had Analytics but no Moderation. Nav items are filtered by role, and the API rejects the call independently — hiding a menu item is not access control."

1. Show the queue — point out it is **sorted by AI priority**, and each report carries a verdict and a rationale.
2. Scroll to **Triage sandbox**, paste:
   - Title: `FREE MONEY`
   - Body: `Buy now limited offer! Click here to earn $5000 working from home. https://a.co https://b.co https://c.co`
3. Click **Run triage**.

**Say:** "`LIKELY_SPAM`, 80% priority, and it lists exactly why — promotional patterns and three outbound links. Three explainable checks: near-duplicate detection using embeddings, spam heuristics and a flagged-term lexicon. The AI never deletes anything; it ranks what a human should look at first."

---

## 7 · Organizer analytics (45s) — `/analytics`

> Visible to **organizers and admins**. Sara (admin) can see it too, so no account switch is needed after step 6.

1. Show the engagement chart and totals.
2. Scroll to **Frequently requested information**.

**Say:** "This is the part organizers care about most. Every question asked of the assistant is logged and topic-labelled. So we can show what members keep asking about — and then cross-reference it against what has actually been published."

3. Point at **CONTENT GAPS**.

**Say:** "These are topics with high demand and little published content. That is a data-driven answer to 'what should we publish next?', which no WhatsApp group can give you."

4. Point at **Skill supply**.

**Say:** "And this shows whether the community can actually staff the projects it is attracting."

---

## Technical questions — prepared answers

**"Which AI models are you using?"**
> "The provider is behind an interface with two implementations. By default it runs a fully offline provider so the project needs no API key. Adding a free Hugging Face token switches it to `all-MiniLM-L6-v2` for embeddings, BART for summaries and Llama 3.2 for answers — with no code change. There is also an automatic fallback: if Hugging Face is rate-limited or slow, it falls back to local mid-request rather than failing."

**"Is the offline mode really AI?"**
> "It is machine learning in the classical sense — a hashing vectorizer with TF weighting, plus extractive summarisation and retrieval-grounded answering. It is not a neural model, and I would not claim it is. The architecture is what matters: swapping in neural embeddings is one environment variable."

**"Where is SOLID in this?"**
> Open `docs/SOLID-AND-DRY.md`. Best single example: `EntityIndexRegistry` — profiles and projects were added to semantic search after search was built, and neither the search service nor the assistant needed any edit. Open/Closed in practice.

**"How would you test it?"**
> "Every service takes interfaces in its constructor, so each is unit-testable with hand-written fakes — no database, no network. `MatchmakingService` needs a fake profile repository and a stub embedder, nothing else."

**"How does this scale?"**
> "Similarity is computed in Node today, which is fine for thousands of chunks. Because everything goes through `IEmbeddingRepository`, moving to pgvector or Qdrant means one new implementation and one line in the composition root. Same for SQLite → PostgreSQL."

**"What would you build next?"**
> "Background job queue for re-indexing, real-time notifications, an evaluation harness to measure whether assistant answers are actually correct, and a hosted moderation classifier behind the existing interface."

---

## If something goes wrong

| Problem | Fix |
|---|---|
| Search returns nothing | `npm run db:setup` — the index is empty |
| Port already in use | Change `PORT` in `apps/api/.env` and `NEXT_PUBLIC_API_URL` in `apps/web/.env.local` |
| A page shows a red error toast | The API is not running; check the `[api]` lines in the terminal |
| Slow first response | Only happens with a Hugging Face token — the model is waking up; it falls back after 15s |

**Safety net:** if anything breaks live, switch to the terminal and run a `curl` against `/api/ai/search`. The API is independent of the UI, and showing raw JSON is a perfectly good recovery.
