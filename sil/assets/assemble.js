/* ============================================================
   SIL Course — loop assembly widget (lesson 7)
   Root div has class "assemble" only; layout reuses the inner
   .lopa-* class names from course.css (same convention as pfd.js,
   moon.js, shared.js — no CSS duplication, other roots untouched).
   Markup:
     <div class="assemble">
       <script type="application/json">
       {
         "title": "...", "instruction": "...",
         "subsystems": [
           { "id": "sensor", "kind": "field", "label": "Датчик PSHH",
             "beta": 0.05,
             "data": [
               { "label": "3051S DA2 · 34 FIT · PTC 41 % · SC 3",
                 "lambda": 34e-9, "ptc": 0.41, "sc": 3 },
               ...
             ],
             "archs": [
               { "v": "1oo1", "hft": 0 },
               { "v": "1oo2", "hft": 1 },
               { "v": "2oo3", "hft": 1 }
             ] },
           ... 2–3 subsystems forming one SIF ...
         ],
         "ti":      { "options": [ {"v": 8760, "label": "1 год (8 760 ч)"}, ... ] },
         "mission": { "options": [ {"v": 175200, "label": "20 лет (175 200 ч)"}, ... ] },
         "target":  { "label": "Требуемый RRF (из LOPA)", "options": [...] }
       }
       </script>
     </div>
   Model (low demand; one element per subsystem):
     p_i = λ · [PTC·TI/2 + (1−PTC)·TL/2]
           PTC = proof test coverage, TL = mission (useful) time.
           The part a proof test cannot see lives the whole mission, so
           PTC = 100 % is the special case behind λ·TI/2.
     p_group = [(1−β)·p]^k + β·p        (1oo1: k → 0, i.e. p_group = p)
               (4/3)·[(1−β)·p]² + β·p  (1oo2)
               4·[(1−β)·p]² + β·p      (2oo3)
               2·[(1−β)·p]³ + β·p      (1oo3)
     PFD_loop = Σ p_group               (series, never averaged)
   Three independent gates, loop SIL = minimum:
     number      band of PFD_loop
     structure   required HFT by target SIL (табл. 6 field / табл. 5 logic)
     process     min SC across the chosen elements (систематическая полнота)
   ============================================================ */
(function () {
  "use strict";

  function jsonOf(root) {
    var s = root.querySelector('script[type="application/json"]');
    return s ? JSON.parse(s.textContent) : null;
  }

  var F = window.SilFmt;
  var fmt = F.fmt;
  var fmtRRF = F.rrf;

  /* Which SIL a structure actually supports, rather than whether it passes.

     Two sources, and the order is set by п. 11.4.3 редакции 2018: a device
     assessed against МЭК 61508-2 — by п. 7.4.4.2 (способ 1H) or п. 7.4.4.3
     (способ 2H) — may carry its own structural rating in the certificate.
     The 3051S prints «SIL 2 @ HFT=0, SIL 3 @ HFT=1», and that rating governs.

     Only when no such rating exists does таблица 6 apply. Since 2018 that is
     ONE table for the whole safety function in low-demand mode:
       УПБ 1 → HFT 0, УПБ 2 → HFT 0, УПБ 3 → HFT 1, УПБ 4 → HFT 2.
     SFF is not in it: редакция 2011 had a separate табл. 5 for logic on
     programmable electronics keyed by SFF, and редакция 2018 merged the two
     into табл. 6. Inverting the table gives the ceiling a structure supports:
       HFT 0 → УПБ 2, HFT 1 → УПБ 3, HFT 2 → УПБ 4.

     The high-demand / continuous column of табл. 6 asks УПБ 2 → HFT 1. The
     course counts low demand throughout (п. 3.2.39: at most one demand a
     year), so the inversion above is the one in force here. */
  /* Required HFT by target SIL — ГОСТ Р МЭК 61511-1-2018, табл. 6, low
     demand (п. 3.2.39: at most one demand a year). Index = УПБ 1..4.
     NOTE: SilFmt.hftField() in assets/format.js still holds the retired
     редакция-2011 table (УПБ 2 → 1, УПБ 3 → 2). It is NOT used here: this
     widget would then report a structure one step stronger than табл. 6
     allows. See NOTES for the pending decision on the shared helper. */
  var HFT_NEEDED = [null, 0, 0, 1, 2];

  function tableCeiling(hft) {
    var best = 0;
    for (var sil = 1; sil <= 4; sil++) {
      if (hft >= HFT_NEEDED[sil]) best = sil;
    }
    return Math.min(best, 3); /* УПБ 4 — вне рамок курса */
  }

  function supportedStruct(hft, sil0) {
    /* sil0 = the SIL the element's own document allows at HFT 0; when the
       certificate prints no such rating the structural table decides. */
    if (typeof sil0 === "number") return Math.max(0, Math.min(3, sil0 + hft));
    return tableCeiling(hft);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function picked(options) {
    var o = options.filter(function (x) { return x.selected; })[0] || options[0];
    return o;
  }

  function render(root) {
    var cfg = jsonOf(root);
    if (!cfg) return;
    root.innerHTML = "";
    root.classList.add("widget");

    if (cfg.title) root.appendChild(el("p", "widget-title", cfg.title));
    if (cfg.instruction) root.appendChild(el("p", "instruction", cfg.instruction));

    var grid = el("div", "lopa-grid");
    var left = el("div");
    var right = el("div");
    grid.appendChild(left);
    grid.appendChild(right);
    root.appendChild(grid);

    var state = {
      data: cfg.subsystems.map(function (s) { return picked(s.data); }),
      arch: cfg.subsystems.map(function (s) { return s.archs[0].v; }),
      ti: parseFloat(picked(cfg.ti.options).v),
      mission: parseFloat(picked(cfg.mission.options).v),
      target: parseFloat(picked(cfg.target.options).v)
    };

    function field(labelTxt) {
      var f = el("label", "lopa-field");
      f.appendChild(el("span", "lopa-label", labelTxt));
      left.appendChild(f);
      return f;
    }

    function select(fieldEl, opts, value, onPick) {
      var s = el("select", "lopa-select");
      opts.forEach(function (o, i) {
        var key = o.v !== undefined ? String(o.v) : String(i);
        /* Architecture rows carry no label: their value is the label. */
        var op = el("option", null, o.label !== undefined ? o.label : key);
        op.value = key;
        if (key === String(value)) op.selected = true;
        s.appendChild(op);
      });
      s.addEventListener("change", function () { onPick(s.value); recalc(); });
      fieldEl.appendChild(s);
    }

    cfg.subsystems.forEach(function (sub, i) {
      /* The select's value must be the index of the DEFAULT data row, not the
         subsystem's own index — otherwise a subsystem whose index happens to
         match another option silently starts on the wrong element data. */
      var start = sub.data.indexOf(picked(sub.data));
      select(field(sub.label + " · данные"), sub.data, start,
        function (v) { state.data[i] = sub.data[+v]; });
      select(field(sub.label + " · архитектура"), sub.archs, sub.archs[0].v,
        function (v) { state.arch[i] = v; });
    });

    select(field(cfg.ti.label), cfg.ti.options, state.ti,
      function (v) { state.ti = parseFloat(v); });
    select(field(cfg.mission.label), cfg.mission.options, state.mission,
      function (v) { state.mission = parseFloat(v); });
    select(field(cfg.target.label), cfg.target.options, state.target,
      function (v) { state.target = parseFloat(v); });

    var out = el("div", "lopa-out");
    out.setAttribute("aria-live", "polite");
    right.appendChild(out);

    function line(label) {
      var d = el("div", "lopa-line");
      d.appendChild(el("span", "lopa-line-label", label));
      out.appendChild(d);
      return d;
    }

    function value(label, text, note, cls) {
      var d = line(label);
      d.appendChild(el("strong", cls || null, text));
      if (note) d.appendChild(el("span", "lopa-note", note));
      return d;
    }

    function recalc() {
      out.innerHTML = "";

      var targetSil = F.bandOf(state.target);

      var parts = cfg.subsystems.map(function (sub, i) {
        var d = state.data[i];
        var arch = sub.archs.filter(function (a) { return a.v === state.arch[i]; })[0];
        var p = d.lambda * (d.ptc * state.ti / 2 + (1 - d.ptc) * state.mission / 2);
        var beta = typeof sub.beta === "number" ? sub.beta : 0.05;
        var pg = p;
        if (state.arch[i] === "1oo2") pg = 4 / 3 * Math.pow((1 - beta) * p, 2) + beta * p;
        if (state.arch[i] === "2oo3") pg = 4 * Math.pow((1 - beta) * p, 2) + beta * p;
        if (state.arch[i] === "1oo3") pg = 2 * Math.pow((1 - beta) * p, 3) + beta * p;
        return { sub: sub, d: d, arch: arch, p: p, pg: pg, beta: beta };
      });

      var total = parts.reduce(function (a, t) { return a + t.pg; }, 0);
      var rrf = 1 / total;

      parts.slice().sort(function (a, b) { return b.pg - a.pg; }).forEach(function (t) {
        var d = line(t.sub.label + " · " + t.arch.v);
        d.appendChild(el("strong", null, fmt(Number(t.pg.toPrecision(6)))));
        d.appendChild(el("span", "lopa-note",
          Math.round(100 * t.pg / total) + "\u00a0% контура · p одной копии " + fmt(Number(t.p.toPrecision(6)))));
      });

      value("PFD контура (Σ подсистем)", fmt(Number(total.toPrecision(6))),
        "последовательное соединение: складываем, не усредняем");
      value("RRF контура", "≈ " + fmtRRF(Number(rrf.toPrecision(6))));

      /* Gate 1 — the number. */
      var band = F.silOf(rrf);
      var bandSil = F.bandOf(rrf);
      value("Гейт 1 · полоса по PFD", band.sil, "— " + band.note, "lopa-sil");

      /* Gate 2 — architecture. Each subsystem's structure has a ceiling: the
         highest SIL its HFT supports. The loop cannot claim more than the
         weakest ceiling. Редакция 2018 gives one table (табл. 6) for field
         devices and logic alike, and п. 11.4.6 — the «смягчённое» successor
         of п. 11.4.4 — lowers it only with a written justification, which a
         widget cannot assume, so no relief is modelled here. */
      var ceilings = parts.map(function (t) {
        return { sub: t.sub, arch: t.arch, base: supportedStruct(t.arch.hft, t.d.sil0), sil0: t.d.sil0 };
      });
      var weakest = ceilings.slice().sort(function (a, b) { return a.base - b.base; })[0];
      var structSil = weakest.base;
      var structLine = line("Гейт 2 · потолок структуры (HFT)");
      structLine.appendChild(el("strong", structSil >= 1 ? "lopa-sil" : "pfd-verdict bad",
        structSil >= 1 ? "SIL " + structSil : "ниже SIL 1"));
      structLine.appendChild(el("span", "lopa-note-block",
        "держит " + weakest.sub.label + " " + weakest.arch.v + " (HFT " + weakest.arch.hft +
        (typeof weakest.sil0 === "number"
          ? ", SIL " + weakest.sil0 + " при HFT 0 из собственной оценки"
          : ", табл. 6 ред. 2018: HFT " + weakest.arch.hft + " даёт SIL " + structSil) + ")"));

      /* Gate 3 — systematic capability ceiling. No number buys SIL above it. */
      var scMin = Math.min.apply(null, parts.map(function (t) { return t.d.sc; }));
      var scHolder = parts.filter(function (t) { return t.d.sc === scMin; })[0];
      value("Гейт 3 · потолок систематической полноты",
        scMin >= 4 ? "SIL 4" : "SIL " + scMin,
        "держит " + scHolder.sub.label + " (SC " + scMin + ")",
        scMin < 4 ? "lopa-sil" : null);

      /* Loop SIL = minimum of the three gates. */
      var loopSil = Math.min(bandSil, scMin, structSil);
      var holders = [];
      if (bandSil === loopSil) holders.push("число (PFD)");
      if (structSil === loopSil) holders.push("структура (HFT)");
      if (scMin === loopSil) holders.push("процесс (SC)");
      var holder = holders.length === 3 ? "все три совпали"
        : (holders.length === 2 ? holders[0] + " и " + holders[1] : holders[0]);
      var vLine = line("SIL контура — минимум трёх гейтов");
      vLine.appendChild(el("strong", "pfd-verdict " + (loopSil >= targetSil ? "ok" : "bad"),
        loopSil >= 1 ? "SIL " + loopSil : "ниже SIL 1"));
      vLine.appendChild(el("span", "lopa-note-block",
        (loopSil >= targetSil ? "требование выполнено" : "требование не выполнено") +
        (holders.length === 3 ? ": все три гейта сошлись на одном SIL"
                              : "; держит гейт «" + holder + "»") +
        ". Паспорт каждого элемента сам по себе ничего не доказывает."));

      var note = el("div", "lopa-formula-wrap");
      note.appendChild(el("span", "lopa-formula",
        "p = λ·[PTC·TI/2 + (1−PTC)·TL/2].  1oo2: (4/3)[(1−β)p]² + βp.  2oo3: 4[(1−β)p]² + βp.  1oo3: 2[(1−β)p]³ + βp.  " +
        "PFD = Σ подсистем."));
      out.appendChild(note);
    }

    recalc();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".assemble").forEach(render);
  });
})();
