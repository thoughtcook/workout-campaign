"""Decimate the CC BY strong-body GLB and tag approximate muscle regions.

Usage:
  python3 tools/build-strong-body.py /path/to/male_human_strong_body_-_free__downloadable.glb

Requires numpy and fast-simplification. The Sketchfab download is about 35 MB
and 1.26 million triangles with no UVs and no muscle groups; this writes a
Y-up GLB the page can parse without a Draco or meshopt decoder.

Muscle territories are fitness-surface annotations, not anatomical boundaries.
"""
import json, struct, sys
from pathlib import Path

import numpy as np
import fast_simplification

GROUPS = [
    'chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'obliques',
    'lats', 'midback', 'lowerback', 'glutes', 'quads', 'adductors', 'hamstrings', 'calves', 'neutral'
]
TARGET_TRIANGLES = 100_000


def read_glb(path):
    data = Path(path).read_bytes()
    magic, version, length = struct.unpack_from('<III', data, 0)
    if magic != 0x46546C67 or version != 2:
        raise SystemExit('expected a glTF 2 GLB')
    offset, js, blob = 12, None, None
    while offset + 8 <= length:
        chunk_length, chunk_type = struct.unpack_from('<II', data, offset)
        chunk = data[offset + 8:offset + 8 + chunk_length]
        if chunk_type == 0x4E4F534A:
            js = json.loads(chunk)
        elif chunk_type == 0x004E4942:
            blob = chunk
        offset += 8 + chunk_length
    if js is None or blob is None:
        raise SystemExit('GLB is missing JSON or BIN')
    return js, blob


def accessor(js, blob, index):
    acc = js['accessors'][index]
    view = js['bufferViews'][acc['bufferView']]
    start = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    components = {'SCALAR': 1, 'VEC3': 3}[acc['type']]
    dtype = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[acc['componentType']]
    stride = view.get('byteStride', components * np.dtype(dtype).itemsize)
    count = acc['count']
    if stride == components * np.dtype(dtype).itemsize:
        array = np.frombuffer(blob, dtype=dtype, count=count * components, offset=start).reshape(count, components).copy()
    else:
        array = np.empty((count, components), dtype=dtype)
        for i in range(count):
            array[i] = np.frombuffer(blob, dtype=dtype, count=components, offset=start + i * stride)
    return array


def load_surface(path):
    js, blob = read_glb(path)
    vertices, faces, base = [], [], 0
    for mesh in js['meshes']:
        prim = mesh['primitives'][0]
        pos = accessor(js, blob, prim['attributes']['POSITION']).astype(np.float64)
        idx = accessor(js, blob, prim['indices']).reshape(-1).astype(np.int64)
        # Sketchfab root rotates Z-up source onto Y-up: x' = x, y' = z, z' = -y.
        x, y, z = pos[:, 0], pos[:, 1], pos[:, 2]
        pos = np.stack([x, z, -y], axis=1)
        vertices.append(pos)
        faces.append(idx + base)
        base += len(pos)
    points = np.concatenate(vertices)
    triangles = np.concatenate(faces).reshape(-1, 3)
    quant = np.round(points * 100).astype(np.int32)
    _, unique, inverse = np.unique(quant, axis=0, return_index=True, return_inverse=True)
    points = np.ascontiguousarray(points[unique])
    triangles = np.ascontiguousarray(inverse[triangles])
    keep = (triangles[:, 0] != triangles[:, 1]) & (triangles[:, 1] != triangles[:, 2]) & (triangles[:, 0] != triangles[:, 2])
    return points, np.ascontiguousarray(triangles[keep])


def torso_curve(points):
    ymin, ymax = float(points[:, 1].min()), float(points[:, 1].max())
    height = ymax - ymin
    samples = np.linspace(0, 1, 41)
    depth = np.empty(len(samples))
    for i, t in enumerate(samples):
        y = ymin + height * t
        band = points[(np.abs(points[:, 1] - y) < height * 0.02) & (np.abs(points[:, 0]) < 14)]
        depth[i] = np.median(band[:, 2]) if len(band) > 30 else np.nan
    depth = np.where(np.isnan(depth), np.nanmedian(depth), depth)
    return ymin, height, samples, depth


def label_faces(points, triangles):
    ymin, height, samples, depth = torso_curve(points)
    tri = points[triangles]
    normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    length = np.linalg.norm(normals, axis=1, keepdims=True)
    length[length == 0] = 1
    normals /= length
    centers = tri.mean(1)
    zones = np.empty(len(triangles), dtype=object)

    def torso_z(yn):
        return float(np.interp(yn, samples, depth))

    for i, ((x, y, z), (nx, ny, nz)) in enumerate(zip(centers, normals)):
        yn = (y - ymin) / height
        ax = abs(x)
        tz = torso_z(yn)
        if yn > 0.848 or yn < 0.072:
            zones[i] = 'neutral'
            continue
        if ax > 48.5 and yn < 0.60:
            zones[i] = 'neutral'
            continue
        if ax > 24.5 and 0.47 < yn < 0.735:
            if ax > 39.5 or (ax > 36.5 and yn < 0.665):
                zones[i] = 'forearms'
            elif ny > 0.55 and yn > 0.685 and ax < 34:
                zones[i] = 'shoulders'
            else:
                zones[i] = 'biceps' if nz >= -0.05 else 'triceps'
            continue
        if 0.72 < yn < 0.845 and ax > 14.5:
            if z < tz - 1 and ax < 18:
                zones[i] = 'midback'
            elif z > tz + 1 and ax < 17 and yn < 0.785:
                zones[i] = 'chest'
            else:
                zones[i] = 'shoulders'
            continue
        if yn > 0.80:
            zones[i] = 'midback' if z < tz + 1 else 'neutral'
            continue
        posterior = z < tz - 1.6
        anterior = z > tz + 0.4
        if 0.405 <= yn <= 0.535 and ax < 20 and posterior and nz < 0.25:
            zones[i] = 'glutes'
            continue
        if yn < 0.50 and ax < 24:
            inward = nx * (1 if x >= 0 else -1) < -0.42
            if inward and 0.30 < yn < 0.49 and not posterior:
                zones[i] = 'adductors'
            elif yn >= 0.285 and (anterior or nz > 0.18):
                zones[i] = 'quads'
            elif yn >= 0.285 and (posterior or nz < 0.0):
                zones[i] = 'hamstrings'
            elif yn < 0.285 and (posterior or nz < 0.2):
                zones[i] = 'calves'
            else:
                zones[i] = 'neutral'
            continue
        if anterior or nz > 0.2:
            if 0.64 < yn < 0.80 and ax < 17:
                zones[i] = 'chest'
            elif 0.515 < yn <= 0.66 and ax < 12:
                zones[i] = 'abs'
            elif 0.50 < yn < 0.72 and ax < 23:
                zones[i] = 'obliques'
            else:
                zones[i] = 'neutral'
            continue
        if posterior or nz < -0.12:
            if yn > 0.68 and ax < 15:
                zones[i] = 'midback'
            elif 0.54 < yn <= 0.74 and ax >= 7.5:
                zones[i] = 'lats'
            elif 0.50 < yn <= 0.66 and ax < 13:
                zones[i] = 'lowerback'
            elif 0.50 < yn < 0.74:
                zones[i] = 'lats'
            else:
                zones[i] = 'neutral'
            continue
        if 0.52 < yn < 0.70 and ax >= 12:
            zones[i] = 'lats' if z < tz else 'obliques'
        elif 0.52 < yn < 0.67:
            zones[i] = 'abs'
        else:
            zones[i] = 'neutral'

    yn = (centers[:, 1] - ymin) / height
    ax = np.abs(centers[:, 0])
    tz = np.interp(yn, samples, depth)
    anterior = centers[:, 2] > tz + 0.4
    posterior = centers[:, 2] < tz - 1.8
    chest = anterior & (yn > 0.645) & (yn < 0.795) & (ax < 16)
    zones[chest & np.isin(zones, ['lats', 'midback', 'lowerback', 'glutes', 'hamstrings', 'calves', 'quads'])] = 'chest'
    abs_box = anterior & (yn > 0.52) & (yn <= 0.645) & (ax < 10.5)
    zones[abs_box & np.isin(zones, ['lats', 'midback', 'lowerback', 'glutes', 'hamstrings', 'calves', 'obliques'])] = 'abs'
    quad_box = anterior & (yn > 0.30) & (yn < 0.50) & (ax > 6) & (ax < 24)
    zones[quad_box & (zones == 'obliques')] = 'quads'
    lat_box = posterior & (yn > 0.55) & (yn < 0.73) & (ax > 8) & (ax < 24)
    zones[lat_box & np.isin(zones, ['chest', 'abs', 'obliques', 'quads', 'biceps'])] = 'lats'
    zones[(zones == 'glutes') & anterior] = 'quads'
    zones = smooth(triangles, zones, rounds=3)
    yn = (centers[:, 1] - ymin) / height
    ax = np.abs(centers[:, 0])
    tz = np.interp(yn, samples, depth)
    # Keep the waist hem on a height contour so the red/gold block does not drip into the groin.
    low_front = (yn < 0.50) & (centers[:, 2] > tz) & np.isin(zones, ['abs', 'obliques', 'chest'])
    zones[low_front & (ax < 16)] = 'quads'
    zones[low_front & (ax >= 16)] = 'obliques'
    high_front = (yn >= 0.50) & (yn < 0.645) & (centers[:, 2] > tz - 1) & (ax < 20)
    zones[high_front & (ax < 11) & np.isin(zones, ['quads', 'neutral', 'glutes', 'adductors', 'hamstrings'])] = 'abs'
    zones[high_front & (ax >= 11) & np.isin(zones, ['quads', 'neutral', 'glutes', 'adductors', 'hamstrings', 'lats'])] = 'obliques'
    # Front-of-shoulder specks are delts, not back muscles showing through the chest.
    delt = (yn > 0.70) & (yn < 0.83) & (ax > 17) & (ax < 34) & (centers[:, 2] > tz - 6)
    zones[delt & np.isin(zones, ['neutral', 'midback', 'lats', 'chest', 'biceps'])] = 'shoulders'
    zones = remove_islands(triangles, zones, minimum=48)
    return zones, ymin, height, samples, depth


def smooth(triangles, zones, rounds):
    from collections import defaultdict
    edges = defaultdict(list)
    for i, (a, b, c) in enumerate(triangles):
        for edge in ((a, b), (b, c), (c, a)):
            edges[edge if edge[0] < edge[1] else (edge[1], edge[0])].append(i)
    neighbors = [[] for _ in range(len(triangles))]
    for faces in edges.values():
        if len(faces) == 2:
            i, j = faces
            neighbors[i].append(j)
            neighbors[j].append(i)
    current = zones
    for _ in range(rounds):
        updated = current.copy()
        for i, label in enumerate(current):
            votes = [label]
            seen = {i}
            ring = [i]
            for _depth in range(2):
                nxt = []
                for face in ring:
                    for other in neighbors[face]:
                        if other not in seen:
                            seen.add(other)
                            votes.append(current[other])
                            nxt.append(other)
                ring = nxt
            best, count = label, 0
            for vote in set(votes):
                n = votes.count(vote)
                if n > count:
                    best, count = vote, n
            if count >= len(votes) * 0.5:
                updated[i] = best
        current = updated
    return current


def remove_islands(triangles, zones, minimum):
    from collections import defaultdict
    edges = defaultdict(list)
    for i, (a, b, c) in enumerate(triangles):
        for edge in ((a, b), (b, c), (c, a)):
            key = edge if edge[0] < edge[1] else (edge[1], edge[0])
            edges[key].append(i)
    neighbors = [[] for _ in range(len(triangles))]
    for faces in edges.values():
        if len(faces) == 2:
            i, j = faces
            neighbors[i].append(j)
            neighbors[j].append(i)
    seen = np.zeros(len(triangles), dtype=bool)
    current = zones.copy()
    for start in range(len(triangles)):
        if seen[start]:
            continue
        label = current[start]
        stack = [start]
        seen[start] = True
        component = []
        border = defaultdict(int)
        while stack:
            face = stack.pop()
            component.append(face)
            for other in neighbors[face]:
                if current[other] == label and not seen[other]:
                    seen[other] = True
                    stack.append(other)
                elif current[other] != label:
                    border[current[other]] += 1
        if len(component) >= minimum or not border:
            continue
        current[component] = max(border, key=border.get)
    return current


def seal_hems(points, triangles, zones, ymin, height, samples, depth):
    """Split torso triangles across the waist so the colour hem follows one height."""
    ycut = ymin + height * 0.505
    centers = points[triangles].mean(1)
    ax = np.abs(centers[:, 0])
    mask = ax < 26
    pts = [row.copy() for row in points]
    cache = {}

    def on_edge(i, j):
        a, b = (int(i), int(j)) if i < j else (int(j), int(i))
        key = (a, b)
        if key in cache:
            return cache[key]
        ya, yb = points[a, 1], points[b, 1]
        t = float((ycut - ya) / (yb - ya))
        t = min(1.0, max(0.0, t))
        point = points[a] * (1 - t) + points[b] * t
        point[1] = ycut
        pts.append(point)
        cache[key] = len(pts) - 1
        return cache[key]

    new_tris, new_zones = [], []
    for i, (a, b, c) in enumerate(triangles):
        ids = (int(a), int(b), int(c))
        if not mask[i]:
            new_tris.append(ids)
            new_zones.append(zones[i])
            continue
        ys = [points[v, 1] for v in ids]
        above = [y >= ycut for y in ys]
        count = sum(above)
        if count == 0 or count == 3 or max(ys) - min(ys) < height * 0.003:
            new_tris.append(ids)
            new_zones.append(zones[i])
            continue
        lone = above.index(True) if count == 1 else above.index(False)
        i0, i1, i2 = ids[lone], ids[(lone + 1) % 3], ids[(lone + 2) % 3]
        p1, p2 = on_edge(i0, i1), on_edge(i0, i2)
        for tri in ((i0, p1, p2), (p1, i1, i2), (p1, i2, p2)):
            if len(set(tri)) < 3:
                continue
            new_tris.append(tri)
            new_zones.append(zones[i])
    pts = np.asarray(pts, dtype=np.float64)
    tris = np.asarray(new_tris, dtype=np.int32)
    zones = np.asarray(new_zones, dtype=object)
    centers = pts[tris].mean(1)
    yn = (centers[:, 1] - ymin) / height
    ax = np.abs(centers[:, 0])
    tz = np.interp(yn, samples, depth)
    # Pieces on the cut inherit a side from their centroid, so a triangle
    # that used to straddle the waist cannot paint across it.
    on_cut = np.abs(centers[:, 1] - ycut) < height * 0.02
    torso = ax < 26
    front = centers[:, 2] > tz - 0.8
    above = centers[:, 1] >= ycut
    seam = on_cut & torso
    zones[seam & above & front & (ax < 11)] = 'abs'
    zones[seam & above & front & (ax >= 11)] = 'obliques'
    zones[seam & above & ~front & (ax < 9)] = 'lowerback'
    zones[seam & above & ~front & (ax >= 9)] = 'lats'
    zones[seam & ~above & front & (ax < 7)] = 'neutral'
    zones[seam & ~above & front & (ax >= 7)] = 'quads'
    zones[seam & ~above & ~front & (ax < 16)] = 'glutes'
    zones[seam & ~above & ~front & (ax >= 16)] = 'hamstrings'
    return pts, tris, zones


def split_axis(points, triangles, zones, mask, axis, value):
    points = np.asarray(points, dtype=np.float64)
    pts = [row.copy() for row in points]
    cache = {}

    def on_edge(i, j):
        a, b = (int(i), int(j)) if i < j else (int(j), int(i))
        key = (a, b)
        if key in cache:
            return cache[key]
        denom = float(points[b, axis] - points[a, axis])
        if abs(denom) < 1e-8:
            return a
        t = min(1.0, max(0.0, float((value - points[a, axis]) / denom)))
        point = points[a] * (1 - t) + points[b] * t
        point[axis] = value
        pts.append(point)
        cache[key] = len(pts) - 1
        return cache[key]

    new_tris, new_zones = [], []
    for i, (a, b, c) in enumerate(triangles):
        ids = (int(a), int(b), int(c))
        if not mask[i]:
            new_tris.append(ids)
            new_zones.append(zones[i])
            continue
        coords = [points[v, axis] for v in ids]
        above = [coord >= value for coord in coords]
        count = sum(above)
        if count == 0 or count == 3 or max(coords) - min(coords) < 1e-3:
            new_tris.append(ids)
            new_zones.append(zones[i])
            continue
        lone = above.index(True) if count == 1 else above.index(False)
        i0, i1, i2 = ids[lone], ids[(lone + 1) % 3], ids[(lone + 2) % 3]
        p1, p2 = on_edge(i0, i1), on_edge(i0, i2)
        for tri in ((i0, p1, p2), (p1, i1, i2), (p1, i2, p2)):
            if len(set(tri)) == 3:
                new_tris.append(tri)
                new_zones.append(zones[i])
    return np.asarray(pts, dtype=np.float64), np.asarray(new_tris, dtype=np.int32), np.asarray(new_zones, dtype=object)


def seal_panels(points, triangles, zones, ymin, height, samples, depth):
    """Straighten the neckline and the lumbar panel after the waist hem is cut."""
    def frame(points, triangles):
        centers = points[triangles].mean(1)
        yn = (centers[:, 1] - ymin) / height
        ax = np.abs(centers[:, 0])
        tz = np.interp(yn, samples, depth)
        return centers, yn, ax, tz

    centers, yn, ax, tz = frame(points, triangles)
    neck = (ax < 13) & (centers[:, 2] > tz - 2) & (yn > 0.70) & (yn < 0.90)
    points, triangles, zones = split_axis(points, triangles, zones, neck, 1, ymin + height * 0.832)
    centers, yn, ax, tz = frame(points, triangles)
    posterior = centers[:, 2] < tz - 1.0
    band = posterior & (yn > 0.48) & (yn < 0.70) & (ax < 18)
    points, triangles, zones = split_axis(points, triangles, zones, band, 1, ymin + height * 0.625)
    for side in (1, -1):
        centers, yn, ax, tz = frame(points, triangles)
        posterior = centers[:, 2] < tz - 1.0
        band = posterior & (yn > 0.49) & (yn < 0.66) & (ax < 18)
        points, triangles, zones = split_axis(points, triangles, zones, band, 0, side * 8.2)
    centers, yn, ax, tz = frame(points, triangles)
    front = centers[:, 2] > tz - 0.4
    posterior = centers[:, 2] < tz - 1.0
    neckline = front & (ax < 10.5) & (yn >= 0.745) & (yn < 0.832) & np.isin(zones, ['neutral', 'midback'])
    zones[neckline] = 'chest'
    lumbar = posterior & (ax <= 8.2) & (yn >= 0.505) & (yn <= 0.625)
    zones[lumbar] = 'lowerback'
    spill = (zones == 'lowerback') & ~lumbar
    zones[spill & (yn >= 0.505)] = 'lats'
    zones[spill & (yn < 0.505)] = 'glutes'
    return points, triangles, zones


def normalize(points, ymin, height):
    out = points.copy()
    out[:, 0] -= np.median(points[:, 0])
    out[:, 1] = (points[:, 1] - ymin) / height
    torso = points[(np.abs(points[:, 0]) < 14) & (points[:, 1] > ymin + height * 0.55) & (points[:, 1] < ymin + height * 0.75)]
    out[:, 2] = (points[:, 2] - np.median(torso[:, 2])) / height
    out[:, 0] /= height
    return out.astype(np.float32)


def write_glb(path, points, triangles, zones):
    order = []
    for name in GROUPS:
        chosen = np.flatnonzero(zones == name)
        if len(chosen):
            order.append((name, chosen))
    missing = [name for name in GROUPS if name != 'neutral' and name not in {n for n, _ in order}]
    if missing:
        raise SystemExit('missing muscle regions: ' + ', '.join(missing))
    if len(points) >= 65536:
        raise SystemExit('vertex count no longer fits uint16 indices')
    indexed = np.concatenate([triangles[chosen] for _, chosen in order]).astype(np.uint16)
    regions = []
    start = 0
    for name, chosen in order:
        count = int(len(chosen) * 3)
        regions.append({'id': name, 'offset': start, 'count': count})
        start += count
    pos = np.ascontiguousarray(points, dtype=np.float32)
    blob = pos.tobytes() + indexed.tobytes()
    blob += b'\x00' * ((4 - len(blob) % 4) % 4)
    payload = {
        'asset': {
            'version': '2.0',
            'generator': 'workout-campaign/tools/build-strong-body.py',
            'extras': {
                'title': 'Male Human Strong Body - Free / Downloadable',
                'author': 'Orthovasky (https://sketchfab.com/orthovasky)',
                'license': 'CC-BY-4.0',
                'source': 'https://sketchfab.com/3d-models/male-human-strong-body-free-downloadable-c370d7b22dd249129acad646e04d2452',
                'modified': 'Quadric-decimated to about 100000 triangles, with the waist and lumbar seams cut, and annotated with approximate fitness regions.'
            }
        },
        'scene': 0,
        'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0, 'name': 'strong-body'}],
        'meshes': [{
            'name': 'strong-body',
            'primitives': [{
                'attributes': {'POSITION': 0},
                'indices': 1,
                'mode': 4,
                'extras': {'regions': regions, 'up': 'Y', 'height': 1}
            }]
        }],
        'buffers': [{'byteLength': len(blob)}],
        'bufferViews': [
            {'buffer': 0, 'byteOffset': 0, 'byteLength': int(pos.nbytes), 'target': 34962},
            {'buffer': 0, 'byteOffset': int(pos.nbytes), 'byteLength': int(indexed.nbytes), 'target': 34963}
        ],
        'accessors': [
            {
                'bufferView': 0, 'componentType': 5126, 'count': int(len(pos)), 'type': 'VEC3',
                'min': pos.min(0).round(6).tolist(), 'max': pos.max(0).round(6).tolist()
            },
            {'bufferView': 1, 'componentType': 5123, 'count': int(indexed.size), 'type': 'SCALAR'}
        ]
    }
    js = json.dumps(payload, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(blob)
    out = bytearray()
    out += struct.pack('<III', 0x46546C67, 2, total)
    out += struct.pack('<II', len(js), 0x4E4F534A)
    out += js
    out += struct.pack('<II', len(blob), 0x004E4942)
    out += blob
    path.write_bytes(out)
    return regions


def main():
    if len(sys.argv) != 2:
        raise SystemExit('usage: python3 tools/build-strong-body.py /path/to/source.glb')
    points, triangles = load_surface(sys.argv[1])
    print(f'welded {len(points)} vertices, {len(triangles)} triangles')
    points, triangles = fast_simplification.simplify(points, triangles.astype(np.int32), target_count=TARGET_TRIANGLES, agg=5)
    points = np.asarray(points, dtype=np.float64)
    triangles = np.asarray(triangles, dtype=np.int32)
    points[:, 0] -= np.median(points[:, 0])
    zones, ymin, height, samples, depth = label_faces(points, triangles)
    points, triangles, zones = seal_hems(points, triangles, zones, ymin, height, samples, depth)
    points, triangles, zones = seal_panels(points, triangles, zones, ymin, height, samples, depth)
    area = np.linalg.norm(np.cross(points[triangles][:, 1] - points[triangles][:, 0], points[triangles][:, 2] - points[triangles][:, 0]), axis=1)
    for name in GROUPS:
        share = area[zones == name].sum() / area.sum()
        print(f'  {name:12} {share * 100:5.1f}%')
        if name != 'neutral' and share < 0.012:
            raise SystemExit(f'{name} covers too little of the surface')
    normalized = normalize(points, ymin, height)
    dest = Path(__file__).resolve().parents[1] / 'assets' / 'strong-body.glb'
    regions = write_glb(dest, normalized, triangles, zones)
    print(f'{len(normalized)} vertices, {len(triangles)} triangles, {dest.stat().st_size} bytes, {len(regions)} regions')


if __name__ == '__main__':
    main()
