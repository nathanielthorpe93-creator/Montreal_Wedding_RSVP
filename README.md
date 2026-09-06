# Nathaniel & Morgan — Wedding RSVP

Interactive wedding RSVP app for Nathaniel and Morgan's August 21, 2027 wedding in Montréal. Invitation lookup and RSVP submissions are securely proxied through server routes to Google Apps Script and Google Sheets.

## Requirements

- Node.js 22.13 or newer
- pnpm

## Run locally

```bash
pnpm install
pnpm dev
```

Open the local URL shown in the terminal.

Local development and production hosting require these server-only environment variables:

```text
RSVP_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
RSVP_SHARED_SECRET=your-shared-secret
```

Never prefix these variables with `NEXT_PUBLIC_` or expose them in client code.

## Production build and local preview

```bash
pnpm build
pnpm start
```

`pnpm start` serves the last production build. After changing source files,
run `pnpm build` again before restarting it. For local development, prefer
`pnpm dev`, which recompiles source changes automatically.

## Deploy to Cloudflare Workers

The production Worker is named `montreal-wedding-rsvp`. The Cloudflare Vite
plugin reads `wrangler.jsonc` and writes the deployable configuration to
`dist/server/wrangler.json` during `pnpm build`. Both RSVP settings are declared
as required encrypted Worker secrets; their values are never stored in this
repository.

You need a Cloudflare account before authenticating or deploying. You do not
need to create a Worker project in the dashboard first: the first Wrangler
deployment creates it. From this project directory on the Mac, run:

```bash
corepack pnpm install
corepack pnpm exec wrangler login
corepack pnpm exec wrangler whoami
corepack pnpm build
corepack pnpm exec wrangler deploy --config dist/server/wrangler.json --secrets-file .env.local
```

The final command performs the first deployment and uploads the two values from
the ignored `.env.local` file as encrypted Cloudflare secrets. Confirm that the
file contains exactly these names before running it:

```text
RSVP_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
RSVP_SHARED_SECRET=your-shared-secret
```

For later code-only deployments, use:

```bash
corepack pnpm deploy
```

To update either secret later with an interactive prompt, build first so the
generated config exists, then run the relevant command:

```bash
corepack pnpm build
corepack pnpm exec wrangler secret put RSVP_APPS_SCRIPT_URL --config dist/server/wrangler.json
corepack pnpm exec wrangler secret put RSVP_SHARED_SECRET --config dist/server/wrangler.json
```

`wrangler secret put` creates and immediately deploys a new Worker version. As a
dashboard alternative, open **Workers & Pages**, select
**montreal-wedding-rsvp**, then go to **Settings → Variables and Secrets** and
add both names with type **Secret**.

### Connect `rsvp.nathanielandmorgan.com`

After the Worker has been deployed and tested at its `workers.dev` URL:

1. The `nathanielandmorgan.com` DNS zone must be active in the same Cloudflare
   account as the Worker. If the domain currently uses another DNS provider,
   add the site to Cloudflare and change the registrar's authoritative
   nameservers to the two nameservers Cloudflare assigns. This moves DNS
   authority only; copy all existing DNS records first so the current Netlify
   site and email continue working.
2. Remove any existing DNS record specifically named `rsvp` (especially the
   Netlify CNAME). A Worker Custom Domain cannot use a hostname that already has
   a CNAME record.
3. In **Workers & Pages → montreal-wedding-rsvp → Settings → Domains & Routes**,
   choose **Add → Custom Domain**, enter `rsvp.nathanielandmorgan.com`, and
   confirm. Cloudflare creates the required proxied DNS record and TLS
   certificate automatically.

Do not add the custom domain to `wrangler.jsonc` until you are ready for the DNS
change; otherwise the next deployment would attempt to attach it automatically.

## Add to GitHub

After extracting this package, create a new empty GitHub repository and run:

```bash
git init
git add .
git commit -m "Initial wedding RSVP prototype"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the example repository URL with the URL of your new GitHub repository.

## Project notes

- The Google Sheet Guest List is the source of truth for invitation names, types, guest limits, and party rules.
- See `GOOGLE_SHEET_SETUP.md` for the exact column change, dropdown values, and Apps Script deployment steps.
- The paste-ready Apps Script replacement is `google-apps-script/Code.gs`.
- Visual styling is in `app/globals.css` and the page components.
- Images and textures are stored in `public/`.
- `.openai/hosting.json` identifies the existing OpenAI Sites project; it does not contain a password or API key.
