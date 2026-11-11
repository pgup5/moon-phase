# 月相查詢 Moon Phase Checker

A Traditional Chinese moon experience that works from the visitor's current date, time, time zone and (optionally) location. Everything is computed in the browser with Jean Meeus' *Astronomical Algorithms*; there is no build step.

Live site: https://moon-phase-psi.vercel.app

## Features
- Daily moon poetry: 366 distinct excerpts rotate by local calendar day, independently of Moon phase, with author/title and the same date selection on birthday cards. Every consecutive 366 days is unique, including leap day. [Sources and license](data/poetry-sources.md); English mode labels untranslated excerpts as original Chinese.
- Tonight: share a specific Moon by link, retaining its UTC instant, coordinates, hemisphere view and language. Uses native sharing, clipboard, or a selectable link fallback. Shared locations apply to the current session without overwriting saved locations; recipient times use their device time zone.
- Observe: moonrise direction preview for the selected local date/location, with optional rear-camera video, absolute phone-orientation guidance and a manual bearing slider. Horizontal guide only: camera field of view is approximate, magnetic/true-north differences and obstructions are not corrected. Camera tracks stop when leaving Observe on mobile or hiding the page; video stays on the device. Requires HTTPS/localhost and camera permission; unavailable sensors or cameras retain manual mode.
- Calendar: Mid-Autumn, Lantern Festival, Lunar New Year and next-full-Moon countdown cards. Counts calendar days from the selected date, retains same-day festivals, handles DST, and exports a 1080×1350 PNG with custom greeting and reference date. Lunar festivals use the UTC+8 calendar date shown as the same local civil date.
- Calendar: next locally visible lunar eclipse, contact times/altitudes, remaining visibility for ongoing eclipses, optional umbral-only filter and time preview (Astronomy Engine, up to 10 years, 1900–2100)
- Tonight: a phase-aware observing challenge for unaided eyes or binoculars, with completion saved on this device
- Explore: annual meteor-shower planning references with local radiant/moonlight windows; same-instant Moon comparison for Taipei, Tokyo, Sydney, New York and the North Pole; interactive spring/neap tide explanation
- Observe: astronomical-night and moon-free windows with a color timeline
- Explore: nearby planets and five bright stars for the selected time/location
- Observe: phase-aware earthshine tips and candidate twilight windows; all three new features support English and offline use
- Mobile bottom navigation: Tonight, Observe, Explore and Calendar; rocket launches live in Explore, reminders and installation at the bottom of Tonight; time-travel controls in Observe and expandable details keep phone views compact, while desktop shows all sections
- Landscape alignment planner: editable camera/landmark coordinates, optional OpenStreetMap point selection, height-aware closest approach times and time/location preview
- Interactive lunar near-side diagram: lunar seas, craters and Apollo 11 with source links, approximate phase lighting and hemisphere orientation
- Moon photography assistant: phone/camera guidance follows the selected phase, time and location, with exposure starting points and composition tips
- Traditional Chinese by default, with an English language switch that remembers your choice; `?lang=en` and `?lang=zh-Hant` also work
- Realistic 3D moon (Three.js + NASA LRO textures), lit from the real Sun direction; drag to spin
- Time-travel slider with play animation (±30 days, continuous playback)
- Where the moon is: altitude/azimuth sky compass, moonrise/moonset, sunrise/sunset, device compass on phones
- Seven-night viewing comparison: phases, observing windows, hourly weather, comparable scores, and links to nightly details
- Nightly moon path: sky map, rise/set directions, highest point, and a time preview slider (local noon to next noon)
- Chinese culture: 農曆 date, 二十四節氣, festivals (春節、元宵、端午、七夕、中元、中秋、重陽、除夕), 366 daily moon-related poetry excerpts, 玉兔 easter egg (tap the moon 5×)
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

Local lunar-eclipse visibility uses topocentric geometric Moon-center altitude >0°, with refined horizon crossings. Global event type and locally visible phases are distinguished; refraction, terrain and weather are excluded. Run `node --experimental-default-type=module --test tests/lunar-eclipse.test.mjs` for regression checks.

## Mobile usability and performance

- A sticky selected-date/location indicator during time travel and a global “Back to now” button are available across tabs; date editing remains in Observe.
- Explore has seven direct section shortcuts. Meteor showers, lunar eclipses, five-city comparison, seven-night tables and launch lists show summaries before expandable details.
- A recommendation immediately below the poem uses remaining viewing windows and the same astronomy/weather scoring basis. Past windows are excluded and missing weather is labeled.
- Hidden mobile tabs defer their heavier calculations and launch fetching. The 3D module loads after the first render; Data Saver uses the 2D fallback. Moon/sky animations are capped at 30 fps, pause in background/hidden views, and respect reduced motion. Coarse-pointer devices cap canvas pixel ratio at 1.5. Main live updates run every 30 seconds rather than every second.
- Browser QA uses Chrome mobile emulation, including iPhone/Android viewport sizes, touch interactions, reduced motion, offline operation and CPU throttling. Physical iOS Safari and Android devices still need a real-device check.

Run the usability regression checks against a local server with `node tests/mobile-usability.cjs` (Chrome required; defaults to `http://127.0.0.1:8765/`, override with `MOON_QA_URL`). External launch/weather responses are mocked for repeatable checks. Advice logic tests: `node --experimental-default-type=module --test tests/viewing-advice.test.mjs`.

## Reliability and automated checks

Saved locations are validated; blocked or corrupt browser storage falls back to the default location without stopping startup. Failed weather requests can be retried from Tonight without reloading. Calendar dates support keyboard activation. Date selection and playback are limited to 1900–2100, with both local and UTC years checked at the boundaries.

GitHub Actions runs all Node regression tests, JavaScript syntax checks and the Chrome mobile/offline checks on pushes and pull requests. Run all logic tests locally with `node --experimental-default-type=module --test tests/*.test.mjs`.

Moonrise/countdown logic: `node --experimental-default-type=module --test tests/moonrise-countdown.test.mjs`. The mobile browser checks also cover camera denial, stream cleanup on navigation, late permission responses, countdown image creation and offline calculation. Phone sensor accuracy and rear-camera behavior still require physical iOS/Android checks.


## Static deployment at root or `/moon/`

Serve the repository contents from the app directory, with directory URLs ending
in `/` (for example `/moon/`). The same files support root deployment on Vercel;
no build step or runtime server is needed. Keep query strings when redirecting a
directory URL to its trailing-slash form. The host must serve JavaScript, the
manifest and `sw.js` as static files with appropriate MIME types.

The manifest resolves `start_url`, `scope` and icons relative to its own URL.
Worker registration and lunar textures resolve relative to their ES modules.
The worker precaches app-local URLs, including the Apple touch icon, and serves
query-bearing app URLs offline without changing `t`, `lat`, `lon`, `hemi` or
`lang`. Weather, launches and optional map tiles still require network access
(or their existing data caches).

Cache names use `moon-phase:<registration scope>:<version>`. Activation removes
only older caches with the same scope prefix, preserving other apps and other
Moon deployments on the origin. Old `moon-v*` caches are deliberately retained:
the legacy name does not identify which deployment owns it. Installation must
complete precaching before `skipWaiting`; successful updates retain the existing
immediate activation/client-claim behavior without forcing a page reload. Bump
the worker cache version when changing the precached application assets.

PWA regression checks for both paths run with the other Node tests:

```sh
node --experimental-default-type=module --test tests/*.test.mjs
```

For the full Chrome suite, run a static server at the repository root and use
`node tests/mobile-usability.cjs`. To test the subpath without changing deployment
configuration, make a temporary parent directory containing a `moon` symlink to
this repository, serve that parent directory, and run:

```sh
MOON_QA_URL=http://127.0.0.1:8766/moon/ node tests/mobile-usability.cjs
```

The browser suite checks manifest resolution, worker scope, share-link paths,
and offline navigation/reload with the shared parameters, in addition to the
existing feature and mobile checks. Real-device home-screen installation still
needs an iOS/Android check. Hosting configuration and deployment workflows are
unchanged.
