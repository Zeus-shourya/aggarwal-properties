"""Turn the raw extraction (extract.py) into the site's map data file.

usage: build.py <raw-dir> <out-js>
"""
import sys, json, math, re, collections
from shapely import wkt
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import polylabel

rawdir, outjs = sys.argv[1], sys.argv[2]

A = math.radians(33.7)
META = {
    "p1": dict(north=(0.0, -1.0), widths=[20, 22], rotate=False),
    "p2": dict(north=(-math.sin(A), -math.cos(A)), widths=[20], rotate=False),
    "p3": dict(north=(1.0, 0.0), widths=[16.5, 33, 38.5], rotate=True),
}
DIRS = ["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"]


def fmt_ft(ft):
    inches = round(ft * 12)
    f, i = divmod(inches, 12)
    return f"{f}'" if i == 0 else f"{f}'{i}\""


def parse_dim(t):
    m = re.search(r"\[(\d+)'(?:-(\d+(?:\.\d+)?)\")?\]", t)
    if m:
        return int(m.group(1)) + float(m.group(2) or 0) / 12
    m = re.fullmatch(r"(\d+)'\s*(?:(\d+(?:\.\d+)?)\s*(?:\"|''))?", t)
    if m:
        return int(m.group(1)) + float(m.group(2) or 0) / 12
    return None


def natkey(s):
    return [int(p) if p.isdigit() else p for p in re.split(r"(\d+)", s)]


out = {}
for key, meta in META.items():
    raw = json.load(open(f"{rawdir}/{key}_raw.json"))
    ft = raw["ft_per_u"]
    W = raw["W"]
    north = meta["north"]
    east = (-north[1], north[0])
    roads = wkt.loads(raw["roads"])
    _plot_min = min(Polygon(p["poly"]).area for p in raw["plots"])
    _gs = list(roads.geoms) if hasattr(roads, "geoms") else [roads]
    from shapely.ops import unary_union as _uu
    roads = _uu([Polygon(g.exterior, [h for h in g.interiors if Polygon(h).area > 0.5 * _plot_min]) for g in _gs])
    roads_b = roads.buffer(0.8 / ft)
    dims = [(parse_dim(s["t"]), s["c"]) for s in raw["spans"]]
    dims = [(v, c) for v, c in dims if v]

    def T(x, y):
        return (y, W - x) if meta["rotate"] else (x, y)

    def Tv(dx, dy):
        return (dy, -dx) if meta["rotate"] else (dx, dy)

    plots = []
    UNM = []
    stat_w, stat_f, matched, total_sides = collections.Counter(), collections.Counter(), 0, 0
    for p in raw["plots"]:
        poly = Polygon(p["poly"]).simplify(0.25 / ft)
        v = list(poly.exterior.coords)[:-1]
        n = len(v)
        edges = []
        for i in range(n):
            a, b = v[i], v[(i + 1) % n]
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy)
            if L * ft < 1.5:
                continue
            nx, ny = dy / L, -dx / L
            mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            if poly.contains(Point(mid[0] + nx * 0.5 / ft, mid[1] + ny * 0.5 / ft)):
                nx, ny = -nx, -ny
            # road adjacency + road width
            hits, widths = 0, []
            for t in (0.25, 0.5, 0.75, -0.3, -0.15, 0.1, 0.9, 1.15, 1.3):
                px, py = a[0] + dx * t, a[1] + dy * t
                if roads_b.contains(Point(px + nx * 3 / ft, py + ny * 3 / ft)):
                    if t in (0.25, 0.5, 0.75):
                        hits += 1
                    ray = LineString([(px, py), (px + nx * 200 / ft, py + ny * 200 / ft)])
                    inter = ray.intersection(roads_b)
                    parts = list(inter.geoms) if hasattr(inter, "geoms") else [inter]
                    for part in parts:
                        if part.length > 0 and part.distance(Point(px, py)) < 2 / ft:
                            widths.append(part.length * ft - 0.8)
            is_road = hits >= 2 and L * ft >= 6
            bearing = math.degrees(math.atan2(nx * east[0] + ny * east[1], nx * north[0] + ny * north[1])) % 360
            # confirm the computed length with a nearby dimension label on the plan
            Lft = L * ft
            best = None
            for val, c in dims:
                if abs(val - Lft) > 0.4:
                    continue
                # distance from label to edge segment, and position along it
                tt = ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / (L * L)
                if tt < 0.1 or tt > 0.9:
                    continue
                dist = abs((c[0] - a[0]) * (-dy / L) + (c[1] - a[1]) * (dx / L)) * ft
                if dist < 9 and (best is None or abs(val - Lft) < abs(best - Lft)):
                    best = val
            total_sides += 1
            if best is not None:
                matched += 1
            else:
                nearest = None
                for val, c in dims:
                    tt = ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / (L * L)
                    dist = abs((c[0] - a[0]) * (-dy / L) + (c[1] - a[1]) * (dx / L)) * ft
                    if 0.2 < tt < 0.8 and dist < 7 and (nearest is None or dist < nearest[1]):
                        nearest = (val, dist)
                UNM.append((p["label"], round(Lft, 2), nearest and round(nearest[0], 2)))
            if best is None and key == "p3":
                Lft = round(Lft * 2) / 2  # this plan is dimensioned in half-karams, i.e. on a 6-inch grid
            edges.append(dict(len=best if best is not None else Lft, road=is_road, bearing=bearing,
                              width=min(widths) if widths else None))
        road_edges = sorted([e for e in edges if e["road"]], key=lambda e: e["len"])
        def snap(w):
            if not w:
                return None
            near = min(meta["widths"], key=lambda k: abs(k - w))
            if abs(near - w) <= (3.2 if key == "p2" else 1.2):
                return near
            if key == "p3" and w > 45:
                return "main"
            return None

        facing, seen = [], set()
        for e in road_edges:
            d = DIRS[int((e["bearing"] + 22.5) // 45) % 8]
            if d not in seen:
                seen.add(d)
                facing.append([d, snap(e["width"])])
        tag = ""
        if len(road_edges) >= 3:
            tag = "Three-side open"
        elif len(road_edges) == 2:
            diff = abs((road_edges[0]["bearing"] - road_edges[1]["bearing"] + 180) % 360 - 180)
            tag = "Two-side open" if diff > 135 else "Corner plot"
        # road width in front
        rw = None
        ws = [e["width"] for e in road_edges if e["width"]]
        if ws:
            w = min(ws)
            near = min(meta["widths"], key=lambda k: abs(k - w))
            if abs(near - w) <= (3.2 if key == "p2" else 1.2):
                rw = near
            elif key == "p3" and w > 45:
                rw = "main"
            stat_w[round(w)] += 1
        # sides, starting from the front edge
        if road_edges:
            k = edges.index(road_edges[0])
            edges = edges[k:] + edges[:k]
        L4 = [e["len"] for e in edges]
        reg = len(L4) == 4 and abs(L4[0] - L4[2]) < 0.4 and abs(L4[1] - L4[3]) < 0.4
        sides = [fmt_ft(x) for x in L4]
        stat_f[" & ".join(f"{d}({w})" for d, w in facing) or "none"] += 1
        # label anchor: the centroid when it sits comfortably inside, else the widest interior point
        c = polylabel(poly, tolerance=0.5)
        r = c.distance(poly.exterior)
        cen = poly.centroid
        if poly.contains(cen) and cen.distance(poly.exterior) >= 0.8 * r:
            c, r = cen, cen.distance(poly.exterior)
        plots.append(dict(n=p["label"], a=p["area"], pts=[T(*q) for q in v], c=T(c.x, c.y), r=r,
                          f=facing, tag=tag, rw=rw, sides=sides, reg=reg, front=bool(road_edges)))
    print(f"== {key}: plots {len(plots)}; side labels confirmed by plan text {matched}/{total_sides}")
    print("   facing:", dict(stat_f))
    print("   unconfirmed with no label nearby:", sum(1 for u in UNM if u[2] is None), "; with a differing label:", [u for u in UNM if u[2] is not None][:60])
    print("   raw road widths (ft):", sorted(stat_w.items()))
    print("   no road frontage:", [p["n"] for p in plots if not p["front"]])
    print("   road width unknown:", [p["n"] for p in plots if p["front"] and not p["rw"]])

    # ---- view transform ----
    rgeoms = list(roads.geoms) if hasattr(roads, "geoms") else [roads]
    xs, ys = [], []
    for p in plots:
        xs += [q[0] for q in p["pts"]]
        ys += [q[1] for q in p["pts"]]
    for g in rgeoms:
        for x, y in g.exterior.coords:
            tx, ty = T(x, y)
            xs.append(tx)
            ys.append(ty)
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    m = 0.035 * max(x1 - x0, y1 - y0)
    s = 1000 / (x1 - x0 + 2 * m)

    def V(q):
        return (round((q[0] - x0 + m) * s, 1), round((q[1] - y0 + m) * s, 1))

    min_hole = 0.5 * min(Polygon(p["pts"]).area for p in plots)
    road_d = []
    for g in rgeoms:
        g = g.simplify(0.4 / s)
        rings = [g.exterior] + [h for h in g.interiors if Polygon(h).area > min_hole]
        for ring in rings:
            pts = [V(T(x, y)) for x, y in ring.coords]
            road_d.append("M" + "L".join(f"{x},{y}" for x, y in pts[:-1]) + "Z")

    labels = []
    for l in raw["tlines"]:
        t = l["t"]
        if "RISHIKUL" in t or "PROPOSED" in t:
            continue
        text = None
        if "WIDE" in t:
            text = re.sub(r"\s+", " ", t).strip()
        elif "ENTRY" in t:
            text = "ENTRY"
        elif "MAIN KAMI" in t:
            text = "MAIN KAMI ROAD"
        elif "SONIPAT" in t and key == "p3":
            text = "TO SONIPAT"
        elif "GANAUR" in t and key == "p3":
            text = "TO GANAUR"
        if not text:
            continue
        dx, dy = Tv(*l["dir"])
        ang = math.degrees(math.atan2(dy, dx))
        if ang > 90:
            ang -= 180
        if ang <= -90:
            ang += 180
        x, y = V(T(*l["c"]))
        labels.append(dict(t=text, x=x, y=y, a=round(ang, 1)))

    # unique ids for labels that repeat on the plan
    # (where a number repeats, the smaller plot keeps the plain number and the larger gets "#2")
    plots.sort(key=lambda p: (natkey(p["n"]), p["a"] or 0, p["c"][1], p["c"][0]))
    seen = collections.Counter()
    res = []
    for p in plots:
        seen[p["n"]] += 1
        pid = p["n"] if seen[p["n"]] == 1 else f"{p['n']}#{seen[p['n']]}"
        cx, cy = V(p["c"])
        res.append(dict(id=pid, n=p["n"], a=p["a"], p=" ".join(f"{x},{y}" for x, y in map(V, p["pts"])),
                        c=[cx, cy], r=round(p["r"] * s, 1), f=p["f"], tag=p["tag"], rw=p["rw"],
                        sides=p["sides"], reg=p["reg"]))
    nv = Tv(*north)
    out[key] = dict(w=1000, h=round((y1 - y0 + 2 * m) * s, 1), north=round(math.degrees(math.atan2(nv[0], -nv[1])), 1),
                    roads="".join(road_d), labels=labels, plots=res)
    print("   viewBox", out[key]["w"], out[key]["h"], "north deg", out[key]["north"], "labels", len(labels),
          "dups", [r["id"] for r in res if "#" in r["id"]])

with open(outjs, "w", encoding="utf-8") as f:
    f.write("/* Generated from the layout-plan PDFs by tools/build.py - do not edit by hand. */\n")
    f.write("window.AP_MAPS = " + json.dumps(out, separators=(",", ":")) + ";\n")
print("wrote", outjs)

