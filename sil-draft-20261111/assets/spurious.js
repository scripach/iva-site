/* ============================================================
   SIL Course — spurious-trip widget (lesson 7, file 0016)
   Markup:
     <div class="spurious">
       <script type="application/json">
       {
         "title": "...", "instruction": "...",
         "lambda": 5e-6, "beta": {"label": "...", "options": [...]}, "horizon": 8760, "target": 0.05,
         "archs": [ {"id": "1oo1", "label": "..."}, ... ],
         "mttr":  [ {"v": 4, "label": "...", "selected": true}, ... ]
       }
       </script>
     </div>

   Quantities, never mixed:
     P    = probability of at least one trip over the horizon, no repair
            (dimensionless); 1oo1: 1-exp(-λT); 1oo2: 1-exp(-(2-β)λT);
            2oo3: union of the independent 2-of-3 event and the CCF event; the independent part uses (1-β)λ.
     f    = rate of the repairable structure, 1/h; 1oo1: λ;
            1oo2: (2-β)λ; 2oo3: βλ + 6((1-β)λ)²·MTTR.
     N    = f·T — expected number over the horizon (dimensionless).
     f_year = f·8760 — rate per year (1/year).
     D    = N·MTTR — downtime over the horizon (hours).
     D_year = f_year·MTTR — downtime per year (hours/year).
     share = D/T (dimensionless); at T = 1 year it is also D_year/8760.

   The model and its assumptions are printed in the lesson; this widget only
   evaluates them for the learner's selected architecture and MTTR.
   ============================================================ */
(function () {
  "use strict";

  function jsonOf(root) {
    var s = root.querySelector('script[type="application/json"]');
    return s ? JSON.parse(s.textContent) : null;
  }

  var F = window.SilFmt;

  /* U06: the shared printer, one decimal at most. No local rounding:
     every verdict below still uses the unrounded value. */
  function fmt(x) { return F.fmt(x); }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function makeSelect(options, oninput) {
    var s = el("select", "lopa-select");
    var anySelected = false;
    options.forEach(function (o) {
      var opt = el("option", null, o.label);
      opt.value = o.v;
      if (o.selected) { opt.selected = true; anySelected = true; s.value = o.v; }
      s.appendChild(opt);
    });
    if (!anySelected && options.length) s.value = options[0].v;
    s.addEventListener("input", oninput);
    return s;
  }

  function render(root) {
    var data = jsonOf(root);
    if (!data) return;
    root.innerHTML = "";
    root.classList.add("widget");

    var wrap = el("div", "");
    if (data.title) wrap.appendChild(el("p", "widget-title", data.title));
    if (data.instruction) wrap.appendChild(el("p", "instruction", data.instruction));

    var grid = el("div", "lopa-grid");
    var left = el("div");
    var right = el("div");
    var out = el("div", "lopa-out");
    out.setAttribute("aria-live", "polite");
    right.appendChild(out);

    var archField = el("label", "lopa-field");
    archField.appendChild(el("span", "lopa-label", "Архитектура"));
    var archSel = makeSelect(data.archs.map(function (a, i) {
      return { v: i, label: a.label, selected: i === 0 };
    }), function () { recalc(); });
    archField.appendChild(archSel);
    left.appendChild(archField);

    var mttrField = el("label", "lopa-field");
    mttrField.appendChild(el("span", "lopa-label", "Время восстановления MTTR"));
    var mttrSel = makeSelect(data.mttr, function () { recalc(); });
    mttrField.appendChild(mttrSel);
    left.appendChild(mttrField);

    var betaField = el("label", "lopa-field");
    betaField.appendChild(el("span", "lopa-label", data.beta.label));
    var betaSel = makeSelect(data.beta.options, function () { recalc(); });
    betaField.appendChild(betaSel);
    left.appendChild(betaField);

    grid.appendChild(left);
    grid.appendChild(right);
    wrap.appendChild(grid);
    root.appendChild(wrap);

    function line(label, value, unit, metric, raw, note) {
      var d = el("div", "lopa-line");
      d.appendChild(el("span", "lopa-line-label", label));
      var strong = el("strong", null, value);
      if (metric) {
        strong.setAttribute("data-metric", metric);
        strong.setAttribute("data-value", String(raw));
      }
      d.appendChild(strong);
      if (unit) d.appendChild(el("span", "lopa-note", " " + unit));
      if (note) d.appendChild(el("span", "lopa-note", " " + note));
      return d;
    }

    function recalc() {
      var a = data.archs[+archSel.value];
      var mttr = +mttrSel.value;
      var lam = +data.lambda;
      var beta = +betaSel.value;
      var T = +data.horizon;
      var target = +data.target;

      var pAll = 1 - Math.exp(-lam * T);
      var pIndep = 1 - Math.exp(-(1 - beta) * lam * T);
      var pTrip;
      if (a.id === "1oo1") {
        pTrip = pAll;
      } else if (a.id === "1oo2") {
        pTrip = 1 - Math.exp(-(2 - beta) * lam * T);
      } else {
        var pInd = 3 * pIndep * pIndep * (1 - pIndep) + pIndep * pIndep * pIndep;
        var pCcf = 1 - Math.exp(-beta * lam * T);
        pTrip = 1 - (1 - pInd) * (1 - pCcf);
      }

      var rate;
      if (a.id === "1oo1") rate = lam;
      else if (a.id === "1oo2") rate = (2 - beta) * lam;
      else rate = beta * lam + 6 * Math.pow((1 - beta) * lam, 2) * mttr;

      var N = rate * T;
      var fYear = rate * 8760;
      var D = N * mttr;
      var DYear = fYear * mttr;
      var share = D / T;
      var ok = fYear <= target;

      out.innerHTML = "";
      out.appendChild(line("Вероятность хотя бы одного останова за 1 год",
        fmt(pTrip), "безразмерная", "p", pTrip,
        "горизонт 8 760 ч; без восстановления"));
      out.appendChild(line("Ожидаемое число остановов за горизонт",
        fmt(N), "безразмерное", "n", N,
        "N = f·T"));
      out.appendChild(line("Частота",
        fmt(fYear), "1/год", "fyear", fYear,
        "f_year = f·8 760 ч/год"));
      out.appendChild(line("Простой за горизонт",
        fmt(D), "ч", "d", D,
        "D = N·MTTR"));
      out.appendChild(line("Простой за год",
        fmt(DYear), "ч/год", "dyear", DYear,
        "D_year = f_year·MTTR"));
      out.appendChild(line("Доля простоя",
        fmt(share * 100), "%", "share", share,
        "D / T"));
      out.appendChild(el("div", "lopa-line",
        '<span class="lopa-line-label">Цель ' + fmt(target) + ' /год (допущение)</span>' +
        '<span class="pfd-verdict ' + (ok ? "ok" : "bad") + '">' +
        (ok ? "проходит" : "не проходит") + "</span>"));

      if (a.id === "2oo3") {
        out.appendChild(el("div", "lopa-note",
          "Из чего сложилась f: βλS = " + fmt(beta * lam) +
          " 1/ч; 6(1−β)²λS²·MTTR = " + fmt(6 * Math.pow((1 - beta) * lam, 2) * mttr) + " 1/ч."));
      }
    }

    recalc();

    if (F.scope) {
      F.scope(root, {
        status: "calculated",
        mode: "низкая частота запросов: не более одного запроса в год (учебное условие); горизонт 1 год = 8 760 ч",
        units: "P(≥1) безразмерна; N безразмерно; f_year — 1/год; D, D_year — часы; доля простоя безразмерна; MTTR — ч",
        checked: [
          "частота ремонтируемой структуры по выбранной архитектуре и β",
          "ожидаемое число и простой при выбранном MTTR",
          "сравнение f_year с целью 0,05 /год по неокруглённому значению"
        ],
        unchecked: [
          "HFT и архитектурные ограничения",
          "систематическая полнота (SC)",
          "время реакции",
          "жизненный цикл",
          "происхождение λS, β, MTTR и цели",
          "опасная сторона PFD"
        ],
        conclusion: "Это расчёт доступности узла, а не подтверждение SIL функции."
      });
    }
    if (F.installReset) F.installReset(root);
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".spurious").forEach(render);
  });
})();
