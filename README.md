# Workout Campaign

Game-style fitness dashboard for Johnny.

## Files
- `index.html` — dashboard UI (GitHub Pages entrypoint)
- `log.json` — workout data store

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
