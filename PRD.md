# Signal Dashboard PRD

## Product

Signal Dashboard is a private, daily intelligence surface. It watches a curated set of YouTube creators, pulls captions for new videos, summarizes the relevant points, and turns them into succinct decision signal.

The dashboard serves two jobs:

1. Invest better over multi-month and multi-year time horizons, with quarterly rebalancing discipline.
2. Stay relevant in the AI age as a freelancer/operator: tools to try, skills to build, business ideas to test, and work that will still matter as models improve.

## User

Primary user: Landon / SpiritTree operator.

Needs:

- High-signal bullets, not long-form notes.
- Separation between investing signal and career/operator signal.
- Creator tabs for source context without requiring video consumption.
- Topic tabs for cross-source synthesis.
- A daily "what matters today" view.
- A narrative map that turns repeated claims into durable themes with evidence.
- A source list that can evolve without redesigning the app.

## Source Strategy

Core sources are selected for one of three functions:

- AI/operator frontier: what changes the work surface, tooling stack, and solo-business opportunity set.
- Macro/crypto/investing: what changes allocation posture, risk, liquidity, and narratives.
- Space: what frontier hardware and infrastructure trends deserve attention.

Core watchlist:

- IndyDevDan
- Nate B Jones
- AI Explained
- Burke Holland
- Fireship
- Limitless Podcast
- Benjamin Cowen
- Real Vision
- Lyn Alden Media
- Patrick Boyle
- Coin Bureau
- The DeFi Report
- Bankless
- Forward Guidance
- Marcus House
- Everyday Astronaut

Scout bench:

- The Defiant
- Greg Isenberg
- Theo - t3.gg
- Andrej Karpathy
- NASASpaceflight

The DeFi Report is included as a core source despite being smaller because smaller channels can surface less consensus crypto signal. Limitless Podcast is included as explicitly requested and fits the AI engineering depth slot.

## Information Architecture

Primary sections:

- Today: daily TLDR, most important learnings, action queue, portfolio signal, career signal.
- Signal Map: recurring narratives, rebalance watch, career/tool watch, and evidence links.
- Creators: one tab/card per creator with latest and strongest source items.
- Topics: AI Tools, Operator Edge, Macro, Crypto, Investing, Space.
- Videos: searchable/filterable source-item index.
- Sources: core vs scout rationale.
- Ops: ingest coverage, missing transcripts, scan warnings.

## Data Model

Generated file: `public/data/signal.json`

Important fields:

- `generatedAt`
- `cutoff`
- `channels`
- `topics`
- `videos[]`
- `daily`
- `synthesis`
- `coverage`

Each video contains:

- title, URL, channel, publish date, duration, thumbnail
- topics
- importance score
- transcript status
- TLDR
- alpha bullets
- source bullets
- actions
- risks
- portfolio signal
- career signal

The durable database is generated at `data/signal.sqlite`, with public exports at `public/data/signal.sqlite` and `public/data/signal-db.json`.

Narratives contain:

- id, title, summary, strength, momentum
- topics
- why it matters
- monitor list
- evidence video IDs

## Pipeline

Daily cadence:

1. Discover uploads from active channels with `yt-dlp`.
2. Fetch metadata until the lookback cutoff is reached.
3. Download English subtitles or auto-captions.
4. Reuse local transcript/summary cache when available.
5. Summarize transcript into structured JSON with OpenAI when `OPENAI_API_KEY` is present.
6. Fall back to deterministic heuristic summaries if captions or model access fail.
7. Write the dashboard payload to `public/data/signal.json`.
8. Synthesize cross-source narratives into `data.synthesis`.
9. Build the SQLite and normalized JSON database exports.
10. Build and deploy the static app.

Commands:

- `npm run ingest:seed`: bounded smoke/seed run.
- `npm run ingest:full`: 92-day ingest across all active channels.
- `npm run synthesize`: cross-source narrative synthesis.
- `npm run db:build`: SQLite and normalized JSON exports.
- `npm run build`: Vite production build.

## Scoring

Importance is a 0-100 score using:

- model-assessed relevance to investing and AI-age career goals
- source tier
- recency
- topic match
- actionable signal density

The score is not financial advice. It is a triage score for what to read/watch first.

## MVP Acceptance Criteria

- React dashboard loads from generated JSON.
- Today page shows TLDR, top learnings, action queue, investing signal, and career signal.
- Signal Map shows recurring narratives with evidence links.
- Creator and topic views work without a backend.
- Video index supports search, creator filtering, and topic filtering.
- Ingestion can run locally and in scheduled CI.
- Missing transcript and coverage warnings are visible in Ops.
- App builds with `npm run build`.

## Deployment

Hosting: Vercel.

Repository: `sedim3nt/signal`.

Build settings:

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Node version: current LTS or newer

Daily process:

- GitHub Actions cron can run ingestion and commit `public/data/signal.json`.
- Vercel redeploys when the data commit lands.
- Alternative: GitHub Actions can deploy directly to Vercel with `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`.

## Security

- No API keys are exposed to the browser.
- `OPENAI_API_KEY` is only used by the ingestion script.
- The public app contains summaries and source URLs only.
- YouTube transcripts are cached locally in `.cache/`, which is gitignored.

## Future Work

- Add per-source weighting UI.
- Add quarterly rebalance brief generator.
- Add "narratives gaining/losing momentum" timeline.
- Add Telegram/Sedim3nt coordination export.
- Add newsletter/email digest.
- Add source-level quality scores after 30 days of run history.
