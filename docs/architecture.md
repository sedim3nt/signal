# Signal Architecture

## Product Shape

Signal is built as a watcher and synthesis engine, not a video queue. YouTube channels are raw inputs. The website is the decision layer: daily TLDR, portfolio implications, AI-age operator implications, recurring narratives, and source evidence only when needed.

## Repository And Hosting

- GitHub repository: `sedim3nt/signal`
- Hosting: Vercel
- App framework: React + Vite
- Production output: `dist`
- Vercel config: `vercel.json`

## Nightly Process

The daily GitHub Actions workflow runs at night and does the following:

1. Installs Node and `yt-dlp`.
2. Runs `npm run ingest:daily`.
3. Discovers recent uploads from active sources in `data/channels.json`.
4. Downloads transcripts/captions where available.
5. Summarizes each transcript into structured video signal.
6. Runs `npm run synthesize` to create cross-source narratives.
7. Runs `npm run db:build` to create SQLite and normalized JSON exports.
8. Runs `npm run build`.
9. Commits changed generated data.
10. Lets Vercel deploy from Git, or deploys directly if Vercel secrets are present.

## Data Structure

The canonical source registry is `data/channels.json`.

The main generated payload is `public/data/signal.json`:

- `generatedAt`: run timestamp
- `cutoff`: oldest included publish date
- `strategy`: purpose and selection rules
- `topics`: topic taxonomy
- `channels`: monitored source registry
- `videos`: structured source-item summaries
- `daily`: today view data
- `synthesis`: cross-video narrative layer
- `coverage`: scrape and transcript warnings

The durable queryable database is `data/signal.sqlite`, also copied to `public/data/signal.sqlite`.

Key tables:

- `runs`
- `channels`
- `topics`
- `videos`
- `summaries`
- `narratives`
- `narrative_topics`
- `narrative_evidence`
- `coverage_warnings`

`public/data/signal-db.json` is a normalized JSON export for non-SQL consumers.

## Obsidian And Quartz

ClawRyderz has the right principle: the data layer is canonical and rendering is downstream. Signal follows that principle.

I would not make Quartz the primary UI for this project. Quartz is excellent for browsable notes and backlinks, but this product needs ranking, freshness, source weighting, filters, daily briefs, action queues, and recurring narrative synthesis. React is the better primary interface.

The best hybrid path is:

- Keep SQLite/JSON as canonical.
- Keep React/Vercel as the operational dashboard.
- Optionally generate an Obsidian/Quartz vault later as an archive or long-form research library.

## UI/UX

The dashboard is intentionally dense and operational:

- Today: shortest possible decision brief.
- Signal Map: durable narratives with strength, momentum, implications, monitor items, and evidence links.
- Creators: source quality and strongest recent items.
- Topics: cross-source signal by domain.
- Videos: searchable evidence database.
- Sources: core and scout source registry.
- Ops: ingestion health, missing transcripts, and coverage warnings.

The UI does not assume the user watches anything. Source links exist for auditability, not as the primary workflow.
