# Fitness body model

The 3D figure is a decimated derivative of a muscular male surface. Inactive
skin is cool gray, primary targets are saturated orange-red, supporting
regions are warm gold, and recorded-set progress fills each region with green
from the bottom. It contains no internal anatomical structures. Surface
territories are approximate fitness annotations; they do not identify isolated
anatomical muscles or measure activation.

The previous MakeHuman figure is no longer shipped. Keeping both meshes would
leave two competing bodies in the same viewer.

## Source and licence

**Male Human Strong Body - Free / Downloadable** by
[Orthovasky](https://sketchfab.com/orthovasky),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

https://sketchfab.com/3d-models/male-human-strong-body-free-downloadable-c370d7b22dd249129acad646e04d2452

The Sketchfab download is a glTF binary of about 35 MB: 14 chunks of one
surface, roughly 895,000 vertices and 1.26 million triangles, positions and
normals only. There are no UVs, vertex colours, or named muscle groups. The
file embedded in this app, `strong-body.glb`, is a modified copy:

- welded duplicate vertices from the chunk split
- quadric-decimated, then cut along the waist and lumbar seams: 50,790 vertices and 101,552 triangles (1.2 MB)
- rotated to Y-up and scaled so height is 1
- indexed into 16 approximate regions (15 workout muscles plus neutral head,
  hands, feet and shins)

That decimation is the size tradeoff for a buildless GitHub Pages page on a
phone. Draco or meshopt would be smaller still, but the vendored Three.js r170
core build has no decoder, and adding a WASM decoder would be a second runtime.
The page parses this GLB directly. Rebuild from the original download with
Python 3, numpy and `fast-simplification`:

```sh
python3 tools/build-strong-body.py /path/to/male_human_strong_body_-_free__downloadable.glb
```

No endorsement by Orthovasky is implied.

Renderer: **Three.js r170**, MIT. Vendored unchanged from
https://github.com/mrdoob/three.js/tree/r170/build
with its licence in `vendor/THREE-LICENSE.txt`.
The app does not download code or models from a third-party CDN at runtime.
