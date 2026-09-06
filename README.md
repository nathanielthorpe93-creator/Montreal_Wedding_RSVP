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

## Production build

```bash
pnpm build
pnpm start
```

`pnpm start` serves the last production build. After changing source files,
run `pnpm build` again before restarting it. For local development, prefer
`pnpm dev`, which recompiles source changes automatically.

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
