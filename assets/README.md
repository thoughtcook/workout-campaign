# Fitness body model

This is a complete outer-surface fitness figure, rendered in grey with orange
training targets and green recorded-set progress. It contains no internal
anatomical structures. Surface territories are approximate fitness annotations;
they do not identify isolated anatomical muscles or measure activation.

## Source and licence

MakeHuman Community **hm08 base mesh**, CC0 1.0 Universal:
https://github.com/makehumancommunity/makehuman

Pinned source commit: `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`.

Source files, relative to that repository:

- `makehuman/data/3dobjs/base.obj`
- `makehuman/data/targets/macrodetails/caucasian-male-young.target`
- `makehuman/data/targets/macrodetails/universal-male-young-maxmuscle-averageweight.target`

Original base-mesh credits: Data Collection AB, Joel Palmius and Jonas Hauquier
(2020). The upstream asset header explicitly releases the mesh as CC0.
Full asset licence is included in [MAKEHUMAN-CC0.txt](MAKEHUMAN-CC0.txt).
No MakeHuman GPL application code is included in this application.

`fitness-body.json` is a converted, triangulated outer body with helper geometry
removed and 15 approximate surface muscle territories added. The original
geometry is retained, with smooth normals calculated at runtime. Dark surface
shading indicates training shorts. This asset has 13,380 vertices / 26,756
triangles and occupies about 702 KB before HTTP compression.

To rebuild, download the three files above from the pinned commit, save them as
`base.obj`, `male.target` and `muscle.target` in a temporary directory, then run:

```sh
python3.11 tools/build-fitness-model.py /path/to/source-directory
```

Renderer: **Three.js r170**, MIT. Vendored unchanged from
https://github.com/mrdoob/three.js/tree/r170/build
with its licence in `vendor/THREE-LICENSE.txt`.
The app does not download code or models from a third-party CDN at runtime.

The reference screenshot supplied by the user is design guidance only and is
not redistributed in the app. This model is not the HILEFIT proprietary asset.
