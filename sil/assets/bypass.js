/* ============================================================
   SIL Course — bypass budget widget (lesson 8)
   Root div has class "bypass" only; layout reuses the inner
   .lopa-* class names from course.css (same convention as
   pfd.js, moon.js, shared.js, assemble.js — no CSS duplication,
   other widget roots untouched).

   Markup:
     <div class="bypass">
       <script type="application/json">
       {
         "title": "...", "instruction": "...",
         "base":   { "label": "PFD контура", "options": [ {"v": 0.00039, "label": "...", "selected": true}, ... ] },
         "target": { "label": "Требуемый RRF", "options": [ {"v": 200, "label": "...", "selected": true}, ... ] },
         "hours":  { "label": "Байпас включён", "options": [ {"v": 0, "label": "..."}, ... ] }
       }
       </script>
     </div>

   Model: a bypass is a period in which the loop, or part of it, is
   forced into the safe state by hand — that is, the loop answers no
   demand, so its PFD while bypassed is 1, not its calculated value.
   Time-averaged over a year:

     f      = h / 8 760                      fraction of the year in bypass
     p_eff  = (1 − f)·p_base + f·1  ≈  p_base + h/8 760

   The second form is used: for any realistic h the difference is
   below the third digit and the linear form is what an engineer can
   do in the head (1 hour = 1,14·10⁻⁴).

   Budget: the largest h per year that still meets the target,
     h_max = 8 760·(1/RRF_target − p_base)
   Negative when the loop misses the target without any bypass — the
   widget says so instead of printing a zero.
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

  var YEAR = 8760;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function picked(options) {
    return options.filter(function (x) { return x.selected; })[0] || options[0];
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
      base: parseFloat(picked(cfg.base.options).v),
      target: parseFloat(picked(cfg.target.options).v),
      hours: parseFloat(picked(cfg.hours.options).v)
    };

    function select(cfgObj, value, onPick) {
      var f = el("label", "lopa-field");
      f.appendChild(el("span", "lopa-label", cfgObj.label));
      var s = el("select", "lopa-select");
      cfgObj.options.forEach(function (o, i) {
        var key = o.v !== undefined ? String(o.v) : String(i);
        var op = el("option", null, o.label !== undefined ? o.label : key);
        op.value = key;
        if (key === String(value)) op.selected = true;
        s.appendChild(op);
      });
      s.addEventListener("change", function () { onPick(s.value); recalc(); });
      f.appendChild(s);
      left.appendChild(f);
    }

    select(cfg.base, state.base, function (v) { state.base = parseFloat(v); });
    select(cfg.target, state.target, function (v) { state.target = parseFloat(v); });
    select(cfg.hours, state.hours, function (v) { state.hours = parseFloat(v); });

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

      var f = state.hours / YEAR;
      var pEff = state.base + f;
      var rrfEff = 1 / pEff;

      var targetPfd = 1 / state.target;
      var budget = YEAR * (targetPfd - state.base);

      value("PFD контура без байпаса", fmt(state.base),
        "RRF ≈ " + fmtRRF(1 / state.base) + " — " + F.silOf(1 / state.base).sil);
      /* A fraction of the year must not be printed through fmt(): 8 h is
         9,1·10⁻⁴ of the calendar, which reads like a probability. Percent
         is what a procedure owner can check against a logbook. */
      var pct = 100 * f;
      var pctTxt = (pct === 0 ? "0" : pct.toFixed(pct < 1 ? 2 : 1).replace(/\.0$/, "").replace(".", ","));

      value("Доля года в байпасе", pctTxt + "\u00a0%",
        "байпас " + state.hours + "\u00a0ч/год; один час даёт 1,14·10⁻⁴");
      value("PFD с байпасом", fmt(Number(pEff.toPrecision(6))),
        "RRF ≈ " + fmtRRF(rrfEff) + " — " + F.silOf(rrfEff).sil,
        pEff <= targetPfd ? "lopa-sil" : "pfd-verdict bad");

      var bLine = line("Бюджет байпаса при цели RRF ≥ " + fmtRRF(state.target));
      var baseOk = state.base <= targetPfd;
      if (!baseOk) {
        bLine.appendChild(el("strong", "pfd-verdict bad", "бюджета нет"));
        bLine.appendChild(el("span", "lopa-note-block",
          "контур не проходит цель уже без байпаса: его PFD " + fmt(state.base) +
          " больше допустимого " + fmt(Number(targetPfd.toPrecision(4))) +
          ". Байпас тут не при чём — сначала число."));
      } else {
        bLine.appendChild(el("strong", "lopa-sil", fmtRRF(budget) + "\u00a0ч/год"));
        var spent = 100 * state.hours / budget;
        bLine.appendChild(el("span", "lopa-note-block",
          "израсходовано " + Math.round(spent) + "\u00a0% бюджета" +
          (spent > 100 ? " — часы байпаса вышли за предел цели" : "")));
      }

      var vLine = line("Вердикт");
      var ok = pEff <= targetPfd;
      vLine.appendChild(el("strong", "pfd-verdict " + (ok ? "ok" : "bad"),
        ok ? "цель держится" : "цель потеряна"));
      var why;
      if (!baseOk) {
        why = "контур не проходит цель и без байпаса: " + fmt(state.base) + " против " +
          fmt(Number(targetPfd.toPrecision(4))) + ". Процедура здесь ничего не решает.";
      } else if (ok) {
        why = state.hours === 0
          ? "байпаса не было: в протокол идёт расчётный PFD. Добавьте часы — увидите, сколько их держит цель."
          : "даже с " + state.hours + "\u00a0ч в году контур остаётся в полосе цели; в протокол идёт PFD с байпасом, а не расчётный.";
      } else {
        why = "байпас на " + state.hours + "\u00a0ч/год выводит контур из целевой полосы: либо короче, либо компенсирующие меры на время работ.";
      }
      vLine.appendChild(el("span", "lopa-note-block", why));

      var note = el("div", "lopa-formula-wrap");
      note.appendChild(el("span", "lopa-formula",
        "p_eff = p + h/8 760.  h_max = 8 760·(1/RRF − p)."));
      out.appendChild(note);
    }

    recalc();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".bypass").forEach(render);
  });
})();
