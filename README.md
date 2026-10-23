# Workout Campaign

A Chinese-language, mobile-friendly gym training journal for Johnny. Static,
no build step, no external JS/CDN dependencies, and no server-side user data.

## Daily workflow

1. Review the next workout and its explanation. The default sequence is upper A,
   lower A, upper B, lower B; weekdays are illustrative rather than mandatory.
2. Enter sleep, energy, soreness and pain feedback, then generate a session.
3. Record actual weight, repetitions **or seconds**, RIR and completion per set.
   Equipment identity and load units are explicit. Only checked sets count.
4. Record form/pain feedback and actual training/cardio/mobility minutes. Save
   completed or partial training; partial sessions do not advance the sequence.
5. Explore the ascending growth timeline and comparable exercise/weekly/body
   charts. Edit saved sessions or move them to a recoverable area.

Unfinished drafts are saved after input, restored explicitly with Continue Draft,
and never counted as completed training. A rest timer uses a wall-clock deadline
so its remaining time is recalculated after returning from the background.

## Schedule and exercise selection

The illustrative schedule is 06:10 departure, 06:18 arrival, 5 minutes of specific
warm-up, 37 minutes of strength, 8 minutes of mobility, 07:08 departure and about
07:16 arrival home. The gym session is 50 minutes; travel, changing and showering
are separate. Walk on lower-body days if preferred; travel time then changes.

Equipment availability has not been verified. Alternatives can be selected and
actual units/targets adjusted. Changing an exercise or unit clears its actual set
inputs to prevent reinterpreting previous values. RDL is an alternative rather
than the initial default, pending technique instruction.

## Recommendation rules and limits

These are transparent, conservative heuristics, not diagnosis or a validated
individual coaching model:

- First 8 completed strength sessions: 3-set exercises start with 2 sets.
- Sleep below 6 hours, energy 1–2/5 or soreness 2–3/3: suggest recovery or a
  one-set reduction. Today's pain blocks a load-increase recommendation.
- Less than 20 hours since recorded strength work, or less than 48 hours since
  work on the next session's body region: suggest recovery.
- Compare only identical exercise ID, actual variant, equipment, load unit and
  repetitions/seconds metric. History after the session's timestamp is ignored.
- Two successive comparable sessions on different days, with equal loads and
  matching targets, all prescribed sets at the upper rep limit, RIR >=2, good
  form, no pain and adequate recorded recovery: suggest the smallest available
  load increase. No specific increment is invented; the user chooses it.
- Missing feedback prevents progression. Poor form/failure suggests reducing
  difficulty; pain in the latest matching session requires reassessment.
- Seconds, band resistance, bodyweight and assisted loads do not use the
  weight-increase rule. Records older than 21 days trigger reacclimatisation.

References:
- https://acsm.org/resistance-training-guidelines-update-2026/
- https://orthoinfo.aaos.org/en/diseases--conditions/snapping-hip/

## Storage, privacy and backup

New training, recovery, measurements and drafts live in `localStorage` under
`workout-campaign.v2`, scoped to this browser and origin. They are **not** sent to
GitHub or a backend. They do **not** automatically sync between devices. Clearing
site data or using private browsing can lose records; export regularly.

JSON backups include sessions, measurements, recoverable records and drafts.
Import validates the entire batch before writing, adds only unseen IDs, and
never silently overwrites existing records or a local draft. Same-ID revisions
are skipped and reported; this is a backup/transfer mechanism, not conflict-aware
multi-device synchronization. Exported files contain personal training/recovery
information and should be kept private. Exports can preserve an in-memory draft
when storage writes fail. Corrupt stored data is not overwritten; a raw recovery
export is offered. Concurrent tabs reject stale writes instead of replacing data.

`log.json` is the original, already-public legacy archive. It remains unchanged
and is rendered read-only in the tree. Its ambiguous reps/seconds and band-weight
values are excluded from the new statistics and recommendations. New backups do
not duplicate that bundled legacy archive. Do not commit personal dates of birth,
health reports, new daily logs, or exported backups to this public repository.

Body measurements are optional. Saving on the same day updates that day's entry.
Weight charts show the mean of measured days within the trailing 7 calendar days;
missing days are not invented, and body fat is not estimated. Dates and weekly
boundaries use Asia/Singapore (UTC+8); weeks start Monday.

## Files

- `index.html`, `styles.css`: responsive interface
- `app.js`: journal forms, timeline, accessible SVG charts, timer, backup flows
- `training-core.js`: pure training rules, validation and aggregation
- `journal-store.js`: validated durable storage with stale-write protection
- `log.json`: unchanged read-only legacy records
- `tests/training.test.cjs`: progression, schema, backup and storage regressions

## Local use and checks

Use an HTTP server (for example `python3 -m http.server 8080`) and open the page
through that server. A `file://` URL may prevent reading the legacy archive.
No package installation or build is required. Node 18+ is needed only for checks:

```bash
npm run check
npm test
```

Automated rule/storage tests and static wiring checks have been run. Visual and
interactive browser acceptance still needs verification in a supported browser;
DOM/static checks are not a substitute for that. Test with a short partial session,
reload to restore a draft, save, export, and import into a separate browser profile.

## Deployment

GitHub Pages serves `main` from the repository root:
https://thoughtcook.github.io/workout-campaign/

Publishing code does not publish new browser-local journal data. There is no
service worker, so browser caching may require a hard refresh after deployment.
