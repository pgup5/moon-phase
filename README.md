# 月相查詢 Moon Phase Checker

A Traditional Chinese moon experience that works from the visitor's current date, time, time zone and (optionally) location. Everything is computed in the browser with Jean Meeus' *Astronomical Algorithms*; there is no build step.

Live site: https://moon-phase-psi.vercel.app

## Features
- Realistic 3D moon (Three.js + NASA LRO textures), lit from the real Sun direction; drag to spin
- Time-travel slider with play animation (±30 days, continuous playback)
- Where the moon is: altitude/azimuth sky compass, moonrise/moonset, sunrise/sunset, device compass on phones
- Chinese culture: 農曆 date, 二十四節氣, festivals (春節、元宵、端午、七夕、中元、中秋、重陽、除夕), poems by phase, 玉兔 easter egg (tap the moon 5×)
- Live sky background that follows the real Sun altitude, with parallax stars and shooting stars
- Birthday moon share card (PNG, Web Share on mobile)
- Supermoon / blue moon / eclipse forecasts, `.ics` full-moon reminders, installable PWA with offline support
- Upcoming rocket launches worldwide (SpaceX, NASA, China, Japan, India, Europe, Russia …) with filter chips, in the visitor's local time zone ([Launch Library 2](https://thespacedevs.com/llapi), cached in `localStorage` for an hour because of the free 15 requests/hour limit)
- `?t=2026-10-26T20:00` opens a specific moment

## Layout
- `index.html`, `css/style.css`
- `js/astro.js` (astronomy), `js/culture.js` (lunar calendar, festivals, poems), `js/sky.js`, `js/moon3d.js`, `js/card.js`, `js/launches.js`, `js/app.js`
- `vendor/three.module.min.js` (Three.js r160), `textures/` (NASA SVS CGI Moon Kit), `icons/`, `manifest.webmanifest`, `sw.js`

Run locally with any static server, e.g. `python3 -m http.server`. ES modules don't load from `file://`.

Pushing to `main` triggers an automatic Vercel deployment (project `moon-phase`, team `puppy0831`).
