# Vercel Deployment

## Local Deploy

```bash
npm run build
npm run deploy:prod
```

## Vercel Project Settings

- Framework preset: Vite
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`

These settings are also encoded in `vercel.json`.

## Daily Deploy

The GitHub Actions workflow refreshes generated data every day and commits it to `main`.

Production deploy is handled by the local Codex watchdog using the authenticated Vercel CLI session:

```bash
git pull --ff-only
npm run deploy:prod
```

If the Vercel account is later connected to GitHub through Vercel's Git integration, Vercel can deploy automatically from `sedim3nt/signal` and the local deploy step can become a fallback only.
