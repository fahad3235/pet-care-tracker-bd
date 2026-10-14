# Pet Care Tracker BD

An offline, bilingual (English / বাংলা) pet-care tracker for pet owners in Bangladesh.
Log feedings, vaccinations, vet visits, and weight — all in one place, with no account,
no server, and no network requests. Your data stays in your browser (localStorage)
and can be exported as a JSON backup at any time.

Live: https://fahad3235.github.io/pet-care-tracker-bd/

## Features

- **Pet profiles** — name, species (dog, cat, bird, fish, rabbit, other), breed, sex,
  date of birth, weight, and notes. Age is computed automatically (years / months / days).
  Deleting a pet deletes all of its feedings, vaccines, visits, and weights.
- **Feeding log** — date, time, food type (dry / wet / homemade / treat / other),
  amount in g or ml, and an optional note. Dashboard shows today's feeding count.
- **Vaccinations** — vaccine name (with common-vaccine presets), date given, and next
  due date. Status badges: Overdue, Due today, Due soon (within 14 days), Up to date,
  No due date. "Mark given today" stamps today's date and clears the due date so you
  can enter the next one. The dashboard lists upcoming vaccinations, overdue first.
- **Vet visits** — date, reason, clinic/vet, cost in ৳, and notes, with a running
  total of vet spend.
- **Weight tracking** — weight entries per pet with an SVG trend chart. Logging a
  newer weight updates the pet profile's current weight automatically.
- **Dashboard** — pet count, feedings today, overdue / due-soon vaccines, total vet
  spend, visit count, upcoming vaccinations, and per-pet summary cards.
- **Data** — JSON export / import with strict validation (malformed backups are
  rejected with your existing data intact), and erase-all guarded by typing DELETE.
- **Bilingual UI** — EN / বাংলা toggle, persisted across reloads, with Bengali digits.
- **Safety** — all user-entered text is HTML-escaped before rendering (XSS-safe);
  every form validates inline (future dates, empty names, non-positive amounts,
  due-before-given, and more).

## Stack

Vanilla HTML / CSS / JavaScript. No frameworks, no build step, no dependencies,
no network requests. Money is stored as integer paisa (1 BDT = 100 paisa) to avoid
floating-point error.

## Run locally

Just open `index.html` in a browser, or serve the folder:

```bash
npx serve .
# or
python3 -m http.server 8000
```

For deterministic demo/testing, append `?asof=YYYY-MM-DD` to pin "today"
(e.g. `index.html?asof=2026-10-14`).

## Testing

```bash
node tests/run-node-tests.js        # pure-logic unit tests
NODE_PATH=../load-shedding-tracker-bd/node_modules node tests/smoke.mjs   # headless-Chrome UI smoke tests
```

The smoke test needs `puppeteer-core` and the Chromium at
`/opt/meta-chromium/chrome` (the factory VM path). See `TEST_RESULTS.md` for the
latest verified results.

## Deployment

Static site — any static host works. GitHub Pages: push the repo contents to
`main` and enable Pages (branch `main`, folder `/ (root)`).

## Limitations

- Single-browser storage: data lives in one browser's localStorage. Use Export for
  backups; there is no sync between devices.
- No reminders/notifications: due-soon and overdue badges only appear when you open
  the app — nothing runs in the background.
- No veterinary guidance: vaccine schedules and intervals are yours to enter. This
  app is a personal organizer, not a substitute for veterinary advice. For any
  health concern, see a veterinarian.
- Ships empty: no demo pets, prices, or schedules are included, so nothing here
  looks like real data.

## Status

Complete MVP. See `TEST_RESULTS.md` for verified test counts.
