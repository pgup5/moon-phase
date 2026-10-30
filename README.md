# 月相查詢 Moon Phase Checker

A Traditional Chinese moon experience that works from the visitor's current date, time, time zone and (optionally) location. Everything is computed in the browser with Jean Meeus' *Astronomical Algorithms*; there is no build step.

Live site: https://moon-phase-psi.vercel.app

## Features
- Tonight: a phase-aware observing challenge for unaided eyes or binoculars, with completion saved on this device
- Explore: annual meteor-shower planning references with local radiant/moonlight windows; same-instant Moon comparison for Taipei, Tokyo, Sydney, New York and the North Pole; interactive spring/neap tide explanation
- Explore: astronomical-night and moon-free windows with a color timeline, plus nearby planets and five bright stars for the selected time/location
- Plan: phase-aware earthshine tips and candidate twilight windows; all three new features support English and offline use
- Mobile bottom navigation: Tonight, Plan, Explore and Calendar; rocket launches live in Explore, reminders and installation at the bottom of Tonight; time-travel controls in Plan and expandable details keep phone views compact, while desktop shows all sections
- Landscape alignment planner: editable camera/landmark coordinates, optional OpenStreetMap point selection, height-aware closest approach times and time/location preview
- Interactive lunar near-side diagram: lunar seas, craters and Apollo 11 with source links, approximate phase lighting and hemisphere orientation
- Moon photography assistant: phone/camera guidance follows the selected phase, time and location, with exposure starting points and composition tips
- Traditional Chinese by default, with an English language switch that remembers your choice; `?lang=en` and `?lang=zh-Hant` also work
- Realistic 3D moon (Three.js + NASA LRO textures), lit from the real Sun direction; drag to spin
- Time-travel slider with play animation (±30 days, continuous playback)
- Where the moon is: altitude/azimuth sky compass, moonrise/moonset, sunrise/sunset, device compass on phones
- Seven-night viewing comparison: phases, observing windows, hourly weather, comparable scores, and links to nightly details
- Nightly moon path: sky map, rise/set directions, highest point, and a time preview slider (local noon to next noon)
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

## Night-sky calculations

Moon-free windows use Sun altitude ≤ −18° and Moon-center altitude ≤ −0.833°, sampled once per minute from local noon to the next noon (including DST). They describe geometry, not measured darkness or weather. Earthshine candidate windows use 1–35% illumination, Moon altitude ≥ 5°, and Sun altitude −18° to −4° as site-selected guidance.

Nearby objects use vendored [Astronomy Engine 2.1.19](https://github.com/cosinekitty/astronomy/tree/v2.1.19) (MIT, license retained in `vendor/astronomy.js`), with topocentric coordinates and five rounded J2000 bright-star positions from [CDS SIMBAD](https://simbad.cds.unistra.fr/simbad/). The feature supports 1900–2100; stellar proper motion is omitted. This is a limited identification catalog, not a complete sky chart or an occultation predictor.

Run the night-sky regression checks with `node --experimental-default-type=module --test tests/night-sky.test.mjs`.

## Observing tools

Meteor showers use rounded annual reference activity periods/near-peak radiants from the [IMO 2026 calendar](https://www.imo.net/files/meteor-shower/cal2026.pdf). These are recurring planning references, not precise annual peak times or event forecasts. Candidate windows are sampled every 5 minutes for the selected night/location, requiring astronomical night and radiant altitude ≥20°. They prefer Moon-free intervals and do not predict meteor counts. Daily radiant drift is omitted.

The five-place Moon comparison uses Astronomy Engine at one UTC instant, with each city's IANA time zone (including DST). North Pole uses 90°N, 0° longitude and UTC as an explicit reference. Bright-side orientation is projected onto the local sky with zenith up; below-horizon diagrams are educational only. Supports 1900–2100.

The tide slider is an idealized equilibrium-tide model combining lunar and solar second harmonics (solar contribution 0.46 relative to lunar). Its relative index is not a local tide forecast; basin geometry, distance changes, declination and lag are omitted. See [NASA tides](https://science.nasa.gov/moon/tides/) and [NOAA tides](https://www.noaa.gov/jetstream/ocean/tides).

Run observing-tool checks with `node --experimental-default-type=module --test tests/observing.test.mjs`.
