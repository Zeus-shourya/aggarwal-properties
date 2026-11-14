"""Extract plot polygons, areas, facing and road geometry from a layout-plan PDF.

usage: extract.py <pdf> <project-key> <out-dir>
"""
import sys, json, math, re, collections, random
import pymupdf
from shapely.geometry import LineString, Point, Polygon, MultiPolygon
from shapely.ops import unary_union, polygonize
from shapely import affinity
from PIL import Image, ImageDraw

path, key, outdir = sys.argv[1], sys.argv[2], sys.argv[3]

CFG = {
    "p1": dict(exclude=[], road=(0.78, 0.78, 0.79), ext=3.0, min_area=3000, widths=[20, 22], rotate=False,
               numrule="red"),
    "p2": dict(exclude=[(1.0, 0.92, 1.0), (0.18, 0.72, 0.0)],
               road=(0.78, 0.78, 0.79), ext=1.0, min_area=3000, widths=[20], rotate=False, numrule="box"),
    "p3": dict(exclude=[], road=(0.39, 0.39, 0.4), ext=0.1, min_area=300, widths=[16.5, 33, 38.5], rotate=True,
               numrule="alpha"),
}[key]

doc = pymupdf.open(path)
page = doc[0]
if page.rotation:
    page.remove_rotation()
W, H = page.rect.width, page.rect.height


def rc(c):
    return tuple(round(x, 2) for x in c) if c else None


# ---------- linework ----------
segs, road_polys = [], []
for d in page.get_drawings():
    col = rc(d.get("color"))
    fill = rc(d.get("fill"))
    pts_all = []
    for it in d["items"]:
        if it[0] == "l":
            a, b = (it[1].x, it[1].y), (it[2].x, it[2].y)
            pts_all.append([a, b])
        elif it[0] == "re":
            r = it[1]
            p = [(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)]
            pts_all += [[p[i], p[(i + 1) % 4]] for i in range(4)]
        elif it[0] == "qu":
            q = it[1]
            p = [(q.ul.x, q.ul.y), (q.ur.x, q.ur.y), (q.lr.x, q.lr.y), (q.ll.x, q.ll.y)]
            pts_all += [[p[i], p[(i + 1) % 4]] for i in range(4)]
    if d["type"] == "s":
        if col in CFG["exclude"]:
            continue
        segs += pts_all
    elif fill == CFG["road"] and pts_all:
        # closed fill path: chain the points
        rings, ring = [], []
        def near(p, q):
            return abs(p[0] - q[0]) < 0.02 and abs(p[1] - q[1]) < 0.02
        for a, b in pts_all:
            if ring and not near(ring[-1], a):
                rings.append(ring); ring = []
            if not ring:
                ring = [a]
            ring.append(b)
            if len(ring) > 3 and near(ring[0], b):
                rings.append(ring); ring = []
        if ring:
            rings.append(ring)
        for ring in rings:
            if len(ring) >= 3:
                try:
                    pg = Polygon(ring)
                    if not pg.is_valid:
                        pg = pg.buffer(0)
                    if pg.area > 0:
                        road_polys.append(pg)
                except Exception:
                    pass

ext = CFG["ext"]
lines = []
for a, b in segs:
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    if L < 1e-6:
        continue
    ux, uy = dx / L, dy / L
    a2 = (a[0] - ux * ext, a[1] - uy * ext)
    b2 = (b[0] + ux * ext, b[1] + uy * ext)
    lines.append(LineString([(round(a2[0], 2), round(a2[1], 2)), (round(b2[0], 2), round(b2[1], 2))]))
polys = [p for p in polygonize(unary_union(lines))]
print("segments", len(lines), "polygons", len(polys), "road tris", len(road_polys))

roads = unary_union([p.buffer(0.15) for p in road_polys]).buffer(-0.15)
print("roads area", round(roads.area), roads.geom_type)

# ---------- text ----------
spans, tlines = [], []
for b in page.get_text("dict")["blocks"]:
    for l in b.get("lines", []):
        txt = " ".join(s["text"].strip() for s in l["spans"] if s["text"].strip())
        if txt:
            x0, y0, x1, y1 = l["bbox"]
            tlines.append({"t": txt, "c": ((x0 + x1) / 2, (y0 + y1) / 2), "dir": l["dir"], "size": l["spans"][0]["size"]})
        for s in l["spans"]:
            t = s["text"].strip()
            if not t:
                continue
            x0, y0, x1, y1 = s["bbox"]
            spans.append({"t": t, "c": ((x0 + x1) / 2, (y0 + y1) / 2), "color": "%06x" % s["color"], "size": s["size"]})

# compass: north vector from N and S letters
ns = {s["t"]: s["c"] for s in spans if s["t"] in ("N", "S")}
north = None
if "N" in ns and "S" in ns:
    vx, vy = ns["N"][0] - ns["S"][0], ns["N"][1] - ns["S"][1]
    L = math.hypot(vx, vy)
    north = (vx / L, vy / L)
print("north vector (page coords)", north, "compass letters", [(s["t"], round(s["c"][0]), round(s["c"][1])) for s in spans if s["t"] in ("N","S","E","W","NE","NW","SE","SW","M","3")])

small = [p for p in polys if p.area < CFG["min_area"]]
big = sorted([p for p in polys if p.area >= CFG["min_area"]], key=lambda p: p.area)
big_filled = [Polygon(p.exterior) for p in big]


def is_plotnum(s):
    t = s["t"]
    if CFG["numrule"] == "red":
        return s["color"] == "ff0000" and re.fullmatch(r"\d{1,3}", t)
    if CFG["numrule"] == "alpha":
        return re.fullmatch(r"[A-D]-\d+", t)
    if CFG["numrule"] == "box":
        if not re.fullmatch(r"\d{1,3}B?", t):
            return False
        pt = Point(s["c"])
        return any(b.contains(pt) for b in small if 100 < b.area)
    return False


nums = [s for s in spans if is_plotnum(s)]
print("plot-number spans", len(nums))

page_area = W * H
assign = collections.defaultdict(list)  # polygon index -> labels
unplaced = []
for s in nums:
    pt = Point(s["c"])
    hit = None
    for i, pf in enumerate(big_filled):
        if pf.area > page_area * 0.2:
            continue
        if pf.contains(pt):
            hit = i
            break
    if hit is None:
        unplaced.append(s["t"])
    else:
        assign[hit].append(s["t"]); s["isnum"] = True
print("unplaced numbers", unplaced)
multi = {i: v for i, v in assign.items() if len(v) > 1}
print("polygons holding >1 number:", len(multi), list(multi.values())[:40])

# ---------- areas ----------
plots = []
for i, labels in assign.items():
    pf = big_filled[i]
    inside = [s for s in spans if pf.contains(Point(s["c"]))]
    area = None
    for s in inside:
        m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*Sq\.?\s*Yds?\.?", s["t"])
        if m:
            area = float(m.group(1))
    if area is None:
        sq = [s for s in inside if re.fullmatch(r"Sq\.?\s*Yds?\.?", s["t"])]
        cand = [s for s in inside if re.fullmatch(r"\d+(?:\.\d+)?", s["t"]) and not s.get("isnum")]
        if sq and cand:
            q = sq[0]["c"]
            cand.sort(key=lambda s: math.hypot(s["c"][0] - q[0], s["c"][1] - q[1]))
            area = float(cand[0]["t"])
    plots.append({"label": labels[0], "labels": labels, "poly": pf, "area": area})

ratios = [p["area"] * 9 / p["poly"].area for p in plots if p["area"] and len(p["labels"]) == 1]
ratios.sort()
ft2_per_u2 = ratios[len(ratios) // 2] if ratios else 1
ft_per_u = math.sqrt(ft2_per_u2)
print("plots", len(plots), "with area", sum(1 for p in plots if p["area"]), "ft per unit", round(ft_per_u, 5))
bad = [(p["label"], p["area"], round(p["poly"].area * ft2_per_u2 / 9, 1)) for p in plots
       if p["area"] and len(p["labels"]) == 1 and abs(p["area"] * 9 / p["poly"].area / ft2_per_u2 - 1) > 0.03]
print("area mismatches (label, stated, computed):", bad)
print("no area:", [p["label"] for p in plots if not p["area"]])
lab_count = collections.Counter(p["label"] for p in plots)
print("duplicate labels:", [k for k, v in lab_count.items() if v > 1])

json.dump({"ft_per_u": ft_per_u, "north": north, "W": W, "H": H,
           "plots": [{"label": p["label"], "labels": p["labels"], "area": p["area"],
                      "poly": [list(c) for c in p["poly"].exterior.coords]} for p in plots],
           "roads": roads.wkt, "spans": [{"t": s["t"], "c": s["c"], "num": bool(s.get("isnum"))} for s in spans],
           "tlines": [{"t": l["t"], "c": l["c"], "dir": l["dir"], "size": l["size"]} for l in tlines]},
          open(f"{outdir}/{key}_raw.json", "w"))

# ---------- debug render ----------
sc = 2000 / max(W, H)
img = Image.new("RGB", (int(W * sc), int(H * sc)), "white")
dr = ImageDraw.Draw(img)
geoms = roads.geoms if hasattr(roads, "geoms") else [roads]
for g in geoms:
    dr.polygon([(x * sc, y * sc) for x, y in g.exterior.coords], fill=(200, 200, 200))
    for h in g.interiors:
        dr.polygon([(x * sc, y * sc) for x, y in h.coords], fill=(255, 255, 255))
for p in plots:
    ok = len(p["labels"]) == 1 and p["area"]
    dr.polygon([(x * sc, y * sc) for x, y in p["poly"].exterior.coords],
               fill=(150, 220, 150) if ok else (240, 140, 140), outline=(0, 0, 0))
    c = p["poly"].representative_point()
    dr.text((c.x * sc - 8, c.y * sc - 5), ",".join(p["labels"]), fill=(0, 0, 0))
img.save(f"{outdir}/{key}_debug.png")
print("saved debug")
for l in tlines:
    if re.search(r"WIDE|ENTRY|MAIN|KAM|ROAD|STREET|SONIPAT|GANAUR|G$", l["t"]) and len(l["t"]) < 40:
        print("LABEL", repr(l["t"]), [round(v) for v in l["c"]], [round(v, 2) for v in l["dir"]], round(l["size"], 1))



