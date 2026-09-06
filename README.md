# Nathaniel & Morgan — Wedding RSVP

Interactive wedding RSVP prototype for Nathaniel and Morgan's August 21, 2027 wedding in Montréal.

This version is front-end only. RSVP submissions are demonstrated in the browser and are not yet connected to Google Sheets or another backend.

## Requirements

- Node.js 22.13 or newer
- pnpm

## Run locally

```bash
pnpm install
pnpm dev
```

Open the local URL shown in the terminal.

## Production build

```bash
pnpm build
pnpm start
```

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

- The guest invitation dataset and lookup rules currently live in `app/page.tsx`.
- Visual styling is in `app/globals.css` and the page components.
- Images and textures are stored in `public/`.
- `.openai/hosting.json` identifies the existing OpenAI Sites project; it does not contain a password or API key.
