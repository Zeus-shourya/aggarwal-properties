# Aggarwal Properties

Live at https://zeus-shourya.github.io/aggarwal-properties/ (GitHub Pages, `main` branch).

The planned domain is aggarwalpropertiess.com, not bought yet. When it is: add a
`CNAME` file containing the domain, set the DNS records, and replace the
`zeus-shourya.github.io/aggarwal-properties/` URLs in the four HTML files,
`sitemap.xml` and `robots.txt` with the domain.

Static site (no build step). Four pages: `index.html` (Home), `about.html`,
`projects.html` (interactive plot maps), `investors.html`.

## Preview

    powershell -ExecutionPolicy Bypass -File serve.ps1      ->  http://localhost:4411/

## Things you will actually edit

| What | Where |
| --- | --- |
| **Mark a plot sold / available** | `data/status.js` — list the sold plot numbers per project. Or open `projects.html?edit=1`, click plots to flip them, press **Copy status file**, paste into `data/status.js`. |
| Project names, type, location, blurb | `data/projects.js` (p1 = MANSA - 06, p2 = MANSA - 05, p3 = MANSA - 04) |
| WhatsApp / phone number | `assets/js/plotmap.js` (`AP.PHONE`) and the `wa.me/…` / `tel:` links in the four HTML files |
| Page text | the HTML files |

Green = available, red (hatched) = sold. Every plot not listed in
`data/status.js` is green.

## Where the maps come from

`assets/js/plots-data.js` is generated from the three layout-plan PDFs:

| Key | Project | Plots |
| --- | --- | --- |
| p1 | MANSA - 06 | 175 residential |
| p2 | MANSA - 05 (near Rishikul World Academy, Dewru Road) | 122 residential |
| p3 | MANSA - 04 (Village Jawahari, Sonipat) | 28 industrial |

`tools/extract.py` reads the vector linework and text out of a PDF (plot
outlines, plot numbers, stated areas, road shapes). `tools/build.py` turns that
into the data file: plot polygons, side lengths in feet, which sides touch a
road, compass facing and the road width in front. Needs Python with
`pymupdf shapely pillow`.

    python tools/extract.py "<plan.pdf>" p1 <work-dir>      (repeat for p2, p3)
    python tools/build.py <work-dir> assets/js/plots-data.js

Adding a 4th project means adding its settings to the `CFG` / `META` tables at
the top of both scripts and an entry in `data/projects.js` and `data/status.js`.

### Notes from the plans

* Areas shown are the figures printed on the plans. Side lengths are measured
  from the plan geometry and agree with the printed dimensions wherever the
  plan prints one.
* Where a plan repeats a plot number, the smaller plot keeps the plain number
  and the larger one is addressed with `#2` in `data/status.js`:
  * MANSA - 05 (p2) prints **97** twice: `97` is the 141.6 sq yd plot, `97#2` the
    145.2 sq yd plot just below it.
  * MANSA - 04 (p3) prints **C-5, C-6, C-7** twice: the plain numbers are the row of
    seven 1260.4 sq yd plots (C-1..C-7); `C-5#2`, `C-6#2`, `C-7#2` are the
    larger plots in the block shared with D-2..D-4.
* MANSA - 05's compass is rotated: north points to the upper-left of the sheet,
  so plots facing the top of the sheet are North-East facing.
* MANSA - 04 is rotated a quarter-turn from the PDF so that north is up.
