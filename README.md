# Signal Dashboard

React + Vite dashboard for the `sedim3nt/signal` repository, deployed on Vercel.

It ingests YouTube creator uploads, pulls transcripts with `yt-dlp`, summarizes them into structured JSON, synthesizes cross-source narratives, and renders a static dashboard with Today, Signal Map, Creators, Topics, Videos, Sources, and Ops views.

## Commands

```bash
npm run dev
npm run ingest:seed
npm run ingest:full
npm run synthesize
npm run db:build
npm run build
npm run preview
```

`npm run ingest:daily` uses RSS-first discovery and processes only new video IDs. `npm run ingest:seed` is a bounded smoke run. `npm run ingest:full` scans the last 92 days across active channels with `yt-dlp`.

## Environment

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

If `OPENAI_API_KEY` is missing, the ingest still runs with heuristic fallback summaries.

## Dependencies

- Node.js
- `yt-dlp`
- Network access to YouTube
- Optional OpenAI API key for high-quality transcript summaries

## Data Flow

```text
data/channels.json
  -> scripts/ingest-youtube.mjs
  -> YouTube RSS for daily discovery; yt-dlp for backfills and captions
  -> .cache/youtube/transcripts
  -> .cache/youtube/summaries
  -> public/data/signal.json
  -> scripts/synthesize-signal.mjs
  -> data/signal.sqlite + public/data/signal-db.json
  -> React dashboard
```

Generated cache files stay local. The browser receives the optimized JSON payload and public database export in `public/data/`.

## Source List

Active channels are in `data/channels.json`.

Core list:

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

Scout channels are tracked but disabled by default until their signal/noise ratio is proven.

## Vercel

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

Local production deploy:

```bash
vercel deploy --prod
```

Project config lives in `vercel.json`.

## Daily Ingest

The included GitHub Actions workflow runs once per day, regenerates `public/data/signal.json`, runs synthesis, rebuilds the SQLite/JSON database exports, and commits generated changes. Vercel can redeploy automatically from GitHub, or the workflow can deploy directly when Vercel secrets are configured.

Required GitHub secret:

```text
OPENAI_API_KEY
```

Optional direct-deploy GitHub secrets:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

Optional GitHub variable:

```text
OPENAI_MODEL
```
