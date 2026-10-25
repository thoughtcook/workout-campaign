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

## Muscle mission and phone layout

The home screen includes an original front/back SVG muscle schematic and, when
WebGL is available, a muscular male surface. Both are simplified fitness
diagrams, not a diagnostic anatomical atlas. Tap a region or its labelled chip
to inspect the associated exercises. The inactive body stays cool gray. Primary
targets are saturated orange-red; supporting regions are warm gold with a
dashed outline on the flat map. Saved completed sets fill the regions with
green energy from the bottom. Side selection also supports keyboard input and
labelled controls. The default is one view on phones and both views on larger
screens; either can be changed.

Goal mode uses the selected plan or active draft's actual exercise variants and
target sets. Logged mode uses saved records on the chosen UTC+8 calendar day.
Only checked sets containing valid actual load and reps/seconds contribute.
Partial sessions contribute only their completed sets. Drafts do not inject
energy. Successful saves reveal the logged body view with a short injection
animation; reduced-motion preferences disable it. Edits, archive/restore and
imports recompute energy from the journal, so it is not a separate counter.

Each muscle's energy is completed associated sets / declared associated target
sets, capped visually at 100%. Primary and supporting set counts remain distinct.
A compound set can involve several muscles, so muscle set counts must not be
added to calculate total session volume. Energy is a completion metaphor, not a
measurement of activation, physiological energy, fatigue, recovery or hypertrophy.
Unknown variants are shown as unmapped rather than guessed. Cardio, mobility,
rest and ambiguous legacy records are not converted to muscle energy.

The phone layout puts the muscle model before the recording form, uses a bottom
navigation bar with safe-area spacing, 44+ px controls, larger form inputs to
avoid iOS focus zoom, and a sticky save action above the bottom navigation.
The model can be reopened for any recorded date from a timeline node. No journal
schema/storage-key change is required; existing v2 records and backups remain
compatible. Original sources are linked for context, not copied as diagram art:

- https://www.acefitness.org/resources/everyone/exercise-library/
- https://www.acefitness.org/resources/everyone/exercise-library/25/incline-chest-press/
- https://www.nasm.org/resource-center/exercise-library/romanian-deadlift-barbell

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
- `muscle-map.js`: explicit variant-to-muscle mapping, completion aggregation and vector schematic
- `fitness-renderer.mjs`, `fitness-view.js`, `assets/strong-body.glb`: WebGL figure and flat-map fallback
- `journal-store.js`: validated durable storage with stale-write protection
- `log.json`: unchanged read-only legacy records
- `tests/training.test.cjs`: progression, schema, backup and storage regressions
- `tests/muscle-map.test.cjs`: muscle mapping, partial credit, visual states and record-derived energy

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

### 2.3 · 强壮人体立体视图

立体人物换成 Orthovasky 在 Sketchfab 发布的「Male Human Strong Body - Free / Downloadable」（[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)）。作者页面：https://sketchfab.com/orthovasky 。模型页：https://sketchfab.com/3d-models/male-human-strong-body-free-downloadable-c370d7b22dd249129acad646e04d2452 。这是衍生作品：减面，并标了近似肌群，不表示作者为本应用背书。

原文件约 35MB、126 万个三角面，没有 UV，也没有肌群分组，直接放进 GitHub Pages 对手机过重。页面加载的是 `assets/strong-body.glb`：同一表面减到约 5 万顶点、10 万三角面，大约 1.2MB。没有用 Draco 或 meshopt，因为仓库里的 Three.js r170 核心文件不带对应解码器，页面自己解析这个 GLB。以前的 MakeHuman 网格和加载时体态变形不再使用，避免两套身体叠在一起。

静息身体是冷灰，主要目标是饱和橙红，协同区域是暖金，已保存的完成组仍从该分区底部向上填入绿色。训练记录仍是唯一能量来源。分区按这具网格的体表位置重标，是健身示意，不是精确解剖。能量计算和 `workout-campaign.v2` 没有改。

手机上可左右拖动旋转，点击身体选择肌群，用 ＋／－ 缩放，正面／背面／立体视角切换。纵向手势用于页面滚动。画布按需渲染，像素比上限 1.5；充能短暂动画遵循减少动态效果设置，不持续自动旋转。无运行时第三方 CDN 依赖。WebGL 不可用时，平面图使用同一套灰 / 橙红 / 暖金 / 绿色。

WebGL 不可用、模型下载失败或显卡上下文丢失时保留可操作的平面图与肌群按钮，训练记录不受影响。来源、减面说明和署名见 [assets/README.md](assets/README.md)。
