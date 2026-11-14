/* ─────────────────────────────────────────────────────────────────────────
   SOLD PLOTS — the only file to touch when a plot is sold (or comes back).

   Put the plot numbers that are SOLD inside the brackets for that project,
   in quotes, separated by commas. Every plot not listed here shows GREEN
   (available); every plot listed shows RED (sold).

       p1: ["12", "45", "128"],

   Two plan drawings repeat a number. The larger plot is written with "#2":
       p2 (MANSA - 05)  ->  "97" (141.6 sq yd)  and  "97#2" (145.2 sq yd)
       p3 (MANSA - 04)  ->  "C-5", "C-6", "C-7" (row of seven, 1260.4 sq yd each)
                      "C-5#2", "C-6#2", "C-7#2" (the block next to D-2..D-4)

   Easier way: open  projects.html?edit=1  in the browser, click plots to
   flip them red/green, press "Copy status file" and paste the result here.
   ───────────────────────────────────────────────────────────────────────── */
window.AP_SOLD = {
  p1: [],   // MANSA - 06
  p2: [],   // MANSA - 05
  p3: []    // MANSA - 04
};
