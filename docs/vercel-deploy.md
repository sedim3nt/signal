# Vercel Deployment

## Local Deploy

```bash
npm run build
vercel deploy --prod
```

## Vercel Project Settings

- Framework preset: Vite
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`

These settings are also encoded in `vercel.json`.

## Daily Deploy

The GitHub Actions workflow refreshes generated data every day. Vercel should be connected to `sedim3nt/signal` so every commit to the default branch deploys production.

For direct deploy from GitHub Actions, configure these repository secrets:

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

The workflow will then run:

```bash
npx vercel pull --yes --environment=production
npx vercel build --prod
npx vercel deploy --prebuilt --prod
```
