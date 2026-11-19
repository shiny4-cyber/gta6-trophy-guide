# Leonida Legend - a GTA VI trophy guide and tracker

[![make.fun entry](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/shiny4-cyber/gta6-trophy-guide/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/shiny4-cyber/gta6-trophy-guide/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01)

An offline guide and tracker for the 55 PlayStation 5 trophies of Grand Theft Auto VI: every trophy with its
official name, description and grade, a guide written for this entry that cites where each fact comes from, a
roadmap to the platinum grouped by chapter and activity, and a checklist whose progress stays in the browser.

One trophy can be lost - `Positive Mental Attitude`, if the Chapter 1 balcony meditation is skipped. Everything
else waits for you in free roam after the credits. There are no online trophies in the list, and the app makes no
network request of any kind: it runs from its own files.

## Run it

`app/` is the whole product: plain HTML, one stylesheet, one classic script and one JSON data file, no build step.

```
node serve.ts            # serves app/ on http://localhost:8080
```

Any static server works with `app/` at its root. Open it as a file and the trophy file cannot be read, because
browsers refuse `fetch` from `file://`; the page says so rather than failing silently.

## Hand it in

```
node main.ts                       # writes /output
MAKEFUN_OUTPUT_DIR=out node main.ts   # writes ./out
```

`main.ts` copies `app/` and `screenshots/` to the output directory and writes `dossier.json` there with the kit's
`vendor/makefun-frontend.ts`, unchanged.

## What is where

| Path | What it holds |
| --- | --- |
| `app/index.html` | the page: masthead, progress meter, tabs, filters, the list, the detail panel, the transfer view |
| `app/style.css` | the whole look - type, colour, rule; no image and no webfont, so the first load stays small |
| `app/app.js` | the behaviour: filters, localStorage, spoiler shield, roadmap, detail, export and import |
| `app/data/trophies.json` | the 55 trophies (official name, description, grade, hidden flag, kind, counts, missable flag, guide, steps, `sources`) and the roadmap stages |
| `screenshots/` | four renders of the app: the checklist with a cited guide open, the roadmap, the spoiler shield, export and import |
| `tools/shots.mjs` | the script that took them: headless Chrome over the DevTools protocol against a local static server |

## The data

`app/data/trophies.json` is an object with a `trophies` array. Each item carries `name`, `description` and `grade`
exactly as PlayStation publishes them, plus `hidden`, `kinds`, `chapter`, `missable`, `counts`, `guide` (this
entry's own words), `steps` and `sources` (a name and a link per claim the guide rests on). A `roadmap` array
orders the same ids into seven stages and names the chapter that closes each window.

Sources named per trophy: PowerPyx's trophy roadmap and its location pages, PSNProfiles' list, SixShore's missable
and roadmap summary, gta.guide's per-trophy notes and GTABase's list. Where the guide writers disagree, or where a
trigger is still unconfirmed, the guide says so instead of inventing a method.

## Look

No Rockstar Games logo, no official artwork, no box art, no screenshot of the game. Type, colour and rule only.
Unaffiliated with Rockstar Games and Sony Interactive Entertainment. MIT licensed; the trophy names and
descriptions remain PlayStation's, quoted as published.
