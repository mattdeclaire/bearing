# 🧭 Bearing

A daily compass guessing game. You're shown 5 cities — physically point your
phone toward where you think each one is and lock in your guess. Your score is
the sum of your angular errors in degrees across all 5 cities. Lower is better.
One puzzle per day, same cities for everyone — share your result and see how
your friends' sense of direction stacks up.

Two modes: the default **continental** game keeps all 5 cities on your own
continent (auto-detected from your location), so targets surround you and
bearings point every which way; **Global** is the classic worldwide list.

**Play it:** https://bearing.city/

## Stack

- Pure static SPA — no backend. Vite + React + TypeScript + Tailwind.
- Deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to
  `main`.
- Browser geolocation gives your position; the device orientation API gives
  your compass heading. On desktop (or when no compass is available) the dial
  falls back to drag-to-aim, so the game is playable anywhere.

## Daily puzzles

Puzzles live in committed monthly JSON files, one stream per game: the global
game in `public/days/YYYY-MM.json` and one per continent (Antarctica excluded)
in `public/days/{continent}/YYYY-MM.json` — seven streams total. Each file
maps every date of the month to its 5 cities. The app fetches the current
month's file for the active mode — continental picks the directory matching
the continent nearest the player — and uses the entry for the player's
**local** date (Wordle-style), so everyone on the same calendar day (and, in
continental mode, the same continent) gets the same puzzle. A missing file or
date shows a friendly "no puzzle today" state.

- `npm run gen-days` (`scripts/gen-days.ts`) generates complete month files
  for all seven streams with a deterministic shuffle keyed off each date
  string (global) or continent + date (continental), covering yesterday
  through one year out. It **skips files that already exist** — a published
  puzzle must never change underneath players. Don't run `--force`: the city
  pool has grown since the first global months were published, so
  regeneration would rewrite them.
- `.github/workflows/gen-days.yml` runs monthly (cron, 1st of the month) to
  top up the window and commits the new files to `main`, which triggers a
  deploy. If a run is missed, the next run catches up automatically. GitHub
  emails on scheduled-workflow failures by default — no extra alerting needed.

## Development

```sh
npm install
npm run dev      # local dev server
npm test         # unit tests (bearing math, scoring, share text, day generation)
npm run build    # static production build in dist/
```

## True north

Target bearings are great-circle (true-north) bearings. iOS's
`webkitCompassHeading` is already true-north-corrected when location services
are on. Android's `deviceorientationabsolute` reports **magnetic** north, so
the app adds the local magnetic declination — computed client-side from the
World Magnetic Model (`geomagnetism`) at the player's position — to put both
platforms on true north.

## One-time setup after cloning to a new repo

Enable GitHub Pages: **Settings → Pages → Source → "GitHub Actions"**, and set
the custom domain to `bearing.city` (DNS: apex A records to GitHub Pages'
IPs). Note that workflow-based Pages deploys ignore any `CNAME` file — the
domain lives in the Pages settings.
