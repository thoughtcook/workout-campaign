"""Rebuild the CC0 fitness surface from pinned MakeHuman assets (Python 3.11+).

Usage: python3.11 tools/build-fitness-model.py /path/to/source-directory
Source files: base.obj, male.target, muscle.target. See assets/README.md.
Muscle territories are approximate surface annotations, not isolated anatomy.
"""
import json, sys
from pathlib import Path

source = Path(sys.argv[1])
vertices, faces, group = [], [], ''
for line in (source / 'base.obj').read_text().splitlines():
    s = line.split()
    if not s:
        continue
    if s[0] == 'v':
        vertices.append(list(map(float, s[1:4])))
    elif s[0] == 'g':
        group = s[1]
    elif s[0] == 'f' and group == 'body':
        q = [int(p.split('/')[0]) - 1 for p in s[1:]]
        faces.extend([[q[0], q[i], q[i+1]] for i in range(1, len(q)-1)])
for filename, weight in [('male.target', 1), ('muscle.target', 1)]:
    for line in (source / filename).read_text().splitlines():
        s = line.split()
        if len(s) == 4 and not line.startswith('#'):
            i = int(s[0])
            vertices[i] = [vertices[i][j] + weight * float(s[j+1]) for j in range(3)]

def zone(x, y, z):
    a = abs(x)
    if y > 6.35 or y < -7.5:
        return 'neutral'
    # A-pose arm follows the shoulder-to-wrist diagonal.
    if a > 1.65 + max(0, 5.5-y)*.30 and y > .7:
        if y > 5.0: return 'shoulders'
        if y > 3.65: return 'biceps' if z > .25 else 'triceps'
        if a < 5.05: return 'forearms'
        return 'neutral'
    if y > 4.9 and a > 1.45: return 'shoulders'
    if y > 1.65:
        if z > .35:
            if y > 4.0 + .09*a*a: return 'chest'
            return 'abs' if a < .82 else 'obliques'
        if y > 4.15 or (a < .65 and y > 2.5): return 'midback'
        return 'lats' if a > .65 and y > 1.0 else 'lowerback'
    if y > .0:
        return 'glutes' if z < .35 else 'neutral'
    if y > -3.3:
        if z < .08: return 'hamstrings'
        return 'adductors' if a < 1.05 else 'quads'
    return 'calves' if z < .05 else 'neutral'

used = sorted(set(i for f in faces for i in f))
remap = {i: n for n, i in enumerate(used)}
zones = ['neutral','chest','shoulders','biceps','triceps','forearms','abs','obliques','lats','midback','lowerback','glutes','quads','adductors','hamstrings','calves']
triangles = {k: [] for k in zones}
positions = []
for i in used:
    x,y,z = vertices[i]
    positions.extend([round(x,4), round(y,4), round(z,4)])
for f in faces:
    center = [sum(vertices[i][k] for i in f)/3 for k in range(3)]
    triangles[zone(*center)].extend(remap[i] for i in f)
out = {'source':'MakeHuman hm08 + male / maxmuscle targets, CC0', 'positions':positions,'regions':triangles}
dest = Path(__file__).resolve().parents[1] / 'assets/fitness-body.json'
dest.write_text(json.dumps(out,separators=(',',':'))+'\n')
print(f'{len(used)} vertices, {len(faces)} triangles, {dest.stat().st_size} bytes')
