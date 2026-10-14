# TEST_RESULTS — pet-care-tracker-bd

Run: 2026-10-14, 11:00 slot. `?asof=2026-10-14` pins "today" for deterministic tests.

## Node unit tests — 57/57 passed

`node tests/run-node-tests.js`

- Dates: 2026-02-30 rejected, 2024-02-29 accepted, 2023-02-29 rejected; daysBetween ±13.
- Age: 2020-05-10 → {6y, 5m, 4d}; newborn same-day → {0,0,0}; future DOB → null;
  2026-01-20 → {0y, 8m, 24d} (month borrow). formatAge EN "2 yrs 1 mo", BN "১ বছর", days-only "5 days".
- Money: toPaisa(123.45)=12345, fromPaisa(12345)="123.45", formatBDT EN "৳12,345.67",
  BN "৳১২,৩৪৫.৬৭"; toBengaliDigits("2026-10-14")="২০২৬-১০-১৪".
- Pet validation: empty name, bad species, future DOB, weight 0 / 301 rejected.
  addPet/updatePet/findPet OK; update unknown id fails; deletePet cascades to all 4
  record types (verified 1 pet + 1 feeding + 1 vaccine + 1 visit + 1 weight → all 0).
- Feeding: future date, bad time 24:00, amount 0 rejected; unknown pet rejected;
  feedingsToday counts only today (1 of 2).
- Vaccine status boundaries @ 2026-10-14: 10-13 overdue, 10-14 due-today, 10-28 due-soon,
  10-29 up-to-date, empty due → no-due. Due-before-given rejected; past due allowed.
  markVaccineGiven sets givenDate=today, clears dueDate, status → no-due.
  upcomingVaccines sorted overdue-first, excludes no-due.
- Visits: empty reason, negative cost rejected; totalVetSpend per-pet 10000, all 35050.
- Weights: addWeight syncs profile to newest entry (11), older entry (9) does not move it
  back; weightSeries sorted [11, 12]; latestWeight 12; weight 0 rejected.
- Dashboard stats exact: {petCount 1, feedingsToday 1, overdue 1, dueSoon 1,
  totalVetSpend 50000, visitCount 1}.
- Export/import: round-trip preserves pet/feeding/vaccine/visit/weight + nextId.
  Rejected: non-object, missing array, duplicate pet id, unknown pet ref, bad species,
  non-integer costPaisa. Bare data object (no wrapper) accepted, nextId=1.
- Delete-by-unknown-id returns false for all five record types.

## Headless-Chrome smoke — 18/18 passed

`NODE_PATH=../load-shedding-tracker-bd/node_modules node tests/smoke.mjs`
(puppeteer-core + /opt/meta-chromium/chrome, file:// + ?asof=2026-10-14)

- Title + header, 7 tabs present, dashboard empty state.
- Empty pet name → inline validation error (no save).
- Add pet "Mimi" (cat, Deshi, DOB 2021-03-05, 3.5 kg) → card shows age "5 yrs 7 mos",
  weight "3.5 kg"; dashboard shows Mimi, pet count 1.
- Log feeding 80 g → row shows "80 g" + pet name; dashboard feedings-today.
- Add vaccine rabies (given 2025-01-05, due 2026-10-01) → badge "Overdue (13 days overdue)".
- "Mark given today" → badge becomes "No due date".
- Add vet visit "Annual checkup" ৳1500 → total "৳1,500.00".
- Log weight 3.6 kg → SVG chart renders with 1 point.
- Reload → Mimi + ৳1,500.00 persist (localStorage).
- BN toggle → h1 "পোষা প্রাণীর যত্ন", persists across reload; back to EN.
- Typed-DELETE erase: wrong confirm (empty) → error; "DELETE" → "All data erased",
  dashboard back to empty state.
- XSS: pet name `<img src=x onerror=alert(1)>` renders escaped (`&lt;img`), zero `<img>`
  elements in cards, no alert.
- 390px mobile: no horizontal overflow on any of the 7 tabs.
- Zero console/page errors.

## Repairs

- 1 test-side fix: `page.type()` into `<input type="date">` mangled the value
  ("2021-03-05" → "10305-02-02") and tripped real validation — date inputs are now
  set via `$eval` value assignment. App bug count: 0.
- 3 pre-test self-review fixes: edit-pet cleared by tab switch, erase-all resetting
  language, wrong i18n key used for the Status column header.

## ASCII hygiene

`index.html`, `js/*.js`, `tests/*.js` are pure ASCII (Bengali as `\uXXXX` escapes;
verified with `grep -rP "[^\x00-\x7F]"`). README.md keeps literal Bengali for
human-readable docs; it travels through the ASCII-safe push JSON unchanged.
