# Cloudflare Deployment

This file is superseded. The active deployment target is Vercel; see `docs/vercel-deploy.md`.

Target domain:

```text
signal.spirittree.dev
```

## Pages Project

Recommended project name:

```text
signal-dashboard
```

Build settings:

```text
Build command: npm run build
Output directory: dist
```

## Direct Upload

```bash
npm run build
npx wrangler pages deploy dist --project-name signal-dashboard
```

## Custom Domain

For a Cloudflare Pages subdomain, add `signal.spirittree.dev` as a custom domain on the Pages project and create the CNAME required by Cloudflare. If Cloudflare manages `spirittree.dev`, this can be done through the dashboard or the Cloudflare API.

Expected DNS shape after the Pages project exists:

```text
Type: CNAME
Name: signal
Target: signal-dashboard.pages.dev
Proxy: enabled
```

If the project receives a different `*.pages.dev` hostname, use that hostname instead.

## API Requirements

To automate the DNS record, the token needs permissions to read zones and edit DNS for `spirittree.dev`.

To deploy by Wrangler, Wrangler needs an authenticated Cloudflare account with Pages access.

Official references:

- Cloudflare Pages custom domains: https://developers.cloudflare.com/pages/configuration/custom-domains/
- Cloudflare Pages direct upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Cloudflare DNS records API: https://developers.cloudflare.com/api/resources/dns/subresources/records/methods/create/
