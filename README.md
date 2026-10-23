# Workout Campaign

Game-style fitness dashboard for Johnny.

## Files
- `index.html` — dashboard UI (GitHub Pages entrypoint)
- `log.json` — workout data store
- `gym-plan.js` — provisional four-day gym plan, substitutions, progression and mobility guidance
- `training-core.js` — plan definitions and the unfinished journal's recommendation/validation module

## Gym plan

The dashboard now includes a selectable gym plan: upper A, lower A, upper B,
lower B, plus an optional cardio/mobility session. Equipment availability still
needs confirmation. Each strength session has a 50-minute budget, illustrated
as 06:18–07:08: 5 minutes of specific warm-up, 37 minutes of strength,
and 8 minutes of mobility. With roughly 8 minutes of travel each way, the
illustrative door-to-door window is 06:10–07:16; changing is separate.
Travel can be an easy jog or a walk, with actual timing adjusted accordingly. The first eight strength sessions reduce
three-set exercises to two sets. Training plans are never logged as completed
workouts automatically. Historical logs remain unchanged.

This is a partial preview: plan selection and the existing dashboard are usable.
The growth timeline, per-set entry, browser storage, import/export, and adaptive
next-session UI are NOT implemented yet. The core module is not a working journal.

Serve the directory with a local HTTP server to preview; opening the HTML as a
file may prevent fetching `log.json`. Do not add dates of birth or medical
details to this public repository.

## Deploy
Enable **GitHub Pages** for the `main` branch `/root` folder.

Then the site will be available at:
- `https://thoughtcook.github.io/workout-campaign/`

## Data format
Append workout sessions to `log.json` like:

```json
[
  {
    "date": "2026-03-28T06:30:00+08:00",
    "dayType": "legs",
    "exercises": [
      { "name": "深蹲", "sets": 4, "reps": 15, "weight": 0 },
      { "name": "弹力带硬拉", "sets": 4, "reps": 12, "weight": 20 }
    ]
  }
]
```

## Workflow
1. Johnny sends workout logs in Telegram
2. Update `log.json`
3. Commit and push
4. GitHub Pages refreshes automatically
