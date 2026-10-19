/* ============================================================
   SIL Course — shared-path (common equipment) widget
   Root div has class "shared" only; layout reuses the inner
   .lopa-* class names from course.css (as pfd.js and moon.js do:
   no CSS duplication, and the .lopa/.pfd/.moon roots stay
   untouched by those widgets).
   Markup:
     <div class="shared">
       <script type="application/json">
       {
         "title": "...", "instruction": "...",
         "segments": [
           { "id": "feeder", "label": "Фидер 220 В, автомат, кабель",
             "lambda": 1e-7,
             "options": [
               { "v": "1oo1", "label": "один, без резерва" },
               { "v": "b10",  "label": "1+1, β 10 %" },
               { "v": "b5",   "label": "1+1, β 5 %", "selected": true },
               { "v": "b1",   "label": "1+1, β 1 %" }
             ] },
           ... 2–5 segments forming one shared path ...
         ],
         "ti":   { "label": "TI общей части", "options": [...] },
         "loop": { "label": "PFD контура без общей части", "options": [...] },
         "target": { "label": "Требуемый RRF (из LOPA)", "options": [...] }
       }
       </script>
     </div>
   Model (low demand; every segment is one link of the shared path):
     p_i      = λ_i · TI / 2                         (1oo1 — no redundancy)
     p_i      = [(1−β)·λ_i·TI/2]² + β·λ_i·TI/2       (1+1 — β-factor model)
     PFD_path = Σ p_i                                (one link fails ⇒ the
                                                      whole path fails, and
                                                      every channel with it)
     PFD_loop = PFD_without_shared + PFD_path        (series: added, never
                                                      divided by voting)
   The lesson's point, visible in the widget: the β·λ·TI/2 term does not
   depend on how many units you put in parallel, so the path keeps a floor.
   ============================================================ */
(function () {
  "use strict";

  var BETA = { "1oo1": null, b10: 0.10, b5: 0.05, b1: 0.01 };

  function jsonOf(root) {
    var s = root.querySelector('script[type="application/json"]');
    return s ? JSON.parse(s.textContent) : null;
  }

  var F = window.SilFmt;
  var fmt = F.fmt;
  var fmtRRF = F.rrf;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function picked(options) {
    var o = options.filter(function (x) { return x.selected; })[0] || options[0];
    return o.v;
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
      picks: cfg.segments.map(function (s) { return picked(s.options); }),
      /* TI is fixed unless the lesson offers a choice: PFD_loop comes from
         an earlier lesson and is only valid for the TI it was computed at. */
      ti: cfg.ti ? parseFloat(picked(cfg.ti.options)) : 8760,
      loop: parseFloat(picked(cfg.loop.options)),
      target: parseFloat(picked(cfg.target.options))
    };

    function field(labelTxt) {
      var f = el("label", "lopa-field");
      f.appendChild(el("span", "lopa-label", labelTxt));
      left.appendChild(f);
      return f;
    }

    function select(fieldEl, opts, value, onPick) {
      var s = el("select", "lopa-select");
      opts.forEach(function (o) {
        var op = el("option", null, o.label);
        op.value = String(o.v);
        if (String(o.v) === String(value)) op.selected = true;
        s.appendChild(op);
      });
      s.addEventListener("change", function () { onPick(s.value); recalc(); });
      fieldEl.appendChild(s);
    }

    cfg.segments.forEach(function (seg, i) {
      select(field(seg.label), seg.options, state.picks[i],
        function (v) { state.picks[i] = v; });
    });
    select(field(cfg.loop.label), cfg.loop.options, state.loop,
      function (v) { state.loop = parseFloat(v); });
    if (cfg.ti) {
      select(field(cfg.ti.label), cfg.ti.options, state.ti,
        function (v) { state.ti = parseFloat(v); });
    }
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

    function recalc() {
      var ti = state.ti;
      out.innerHTML = "";

      var terms = cfg.segments.map(function (seg, i) {
        var mode = state.picks[i];
        var beta = BETA[mode];
        var pi = seg.lambda * ti / 2;
        var p = beta === null ? pi : Math.pow((1 - beta) * pi, 2) + beta * pi;
        return { label: seg.label, p: p, beta: beta };
      });
      var path = terms.reduce(function (a, t) { return a + t.p; }, 0);

      /* Per-segment terms, largest first: the weak link owns most of the
         path, and its PFD is what the next design step must address. */
      terms.slice().sort(function (a, b) { return b.p - a.p; }).forEach(function (t) {
        var d = line(t.label);
        d.appendChild(el("strong", null, fmt(Number(t.p.toPrecision(6)))));
        d.appendChild(el("span", "lopa-note",
          (t.beta === null ? "без резерва" : "1+1, β " + Math.round(t.beta * 100) + "\u00a0%") +
          " · " + Math.round(100 * t.p / path) + "\u00a0% трассы"));
      });

      line("PFD общей части (Σ звеньев)")
        .appendChild(el("strong", null, fmt(Number(path.toPrecision(6)))));

      var loopLine = line("PFD контура без общей части");
      loopLine.appendChild(el("span", "lopa-note",
        fmt(Number(state.loop.toPrecision(6))) + " — принято из урока 5"));

      var total = Number((path + state.loop).toPrecision(6));
      line("PFD контура всего")
        .appendChild(el("strong", null, fmt(total)));

      var rrf = Number((1 / total).toPrecision(6));
      line("RRF контура").appendChild(el("strong", null, "≈ " + fmtRRF(rrf)));

      var band = F.silOf(rrf);
      var sil = line("Полоса по PFD");
      sil.appendChild(el("strong", "lopa-sil", band.sil));
      sil.appendChild(el("span", "lopa-note", "— " + band.note));

      var ok = rrf >= state.target;
      var vLine = line("Проверка требования");
      vLine.appendChild(el("strong", "pfd-verdict " + (ok ? "ok" : "bad"),
        "RRF ≥ " + fmtRRF(state.target) + " — " + (ok ? "выполняется" : "не выполняется")));
      vLine.appendChild(el("span", "lopa-note",
        "нужно PFD ≤ " + fmt(Number((1 / state.target).toPrecision(6)))));

      var note = el("div", "lopa-formula-wrap");
      note.appendChild(el("span", "lopa-formula",
        "1oo1: p = λ·TI/2.  1+1: p = [(1−β)·λ·TI/2]² + β·λ·TI/2.  " +
        "Второе слагаемое от числа параллельных блоков не зависит — " +
        "поэтому третий блок пол не сдвигает."));
      out.appendChild(note);
    }

    recalc();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".shared").forEach(render);
  });
})();
