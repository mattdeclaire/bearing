# 🧭 Bearing

A daily compass guessing game. You're shown 5 cities — physically point your
phone toward where you think each one is and lock in your guess. Your score is
the sum of your angular errors in degrees across all 5 cities. Lower is better.
One puzzle per day, same cities for everyone — share your result and see how
your friends' sense of direction stacks up.

**Play it:** https://bearing.city/

## Stack

- Pure static SPA — no backend. Vite + React + TypeScript + Tailwind.
- Deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to
  `main`.
- Browser geolocation gives your position; the device orientation API gives
  your compass heading. On desktop (or when no compass is available) the dial
  falls back to drag-to-aim, so the game is playable anywhere.

## Daily puzzles

Each day's 5 cities live in a committed JSON file: `public/days/YYYY-MM-DD.json`.
The app loads the file matching the player's **local** date (Wordle-style), so
everyone on the same calendar day gets the same puzzle. If no file exists for
today, the app shows a friendly "no puzzle today" state.

- `npm run gen-days` (`scripts/gen-days.ts`) generates files with a
  deterministic shuffle keyed off the date string, from **yesterday** (covers
  every timezone) through one year out. It **skips files that already exist** —
  a published puzzle must never change underneath players. Use `--force` only
  for deliberate regeneration.
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

## Known approximation

Some Android devices report **magnetic** north rather than true north; iOS
reports true heading when location services are on. The difference (magnetic
declination) is usually under ~15° — accepted as noise for a casual game and
not corrected for.

## One-time setup after cloning to a new repo

Enable GitHub Pages: **Settings → Pages → Source → "GitHub Actions"**, and set
the custom domain to `bearing.city` (DNS: apex A records to GitHub Pages'
IPs). Note that workflow-based Pages deploys ignore any `CNAME` file — the
domain lives in the Pages settings.
