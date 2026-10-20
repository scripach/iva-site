/* ============================================================
   SIL Course — beta-factor widget (Humphreys checklist)
   Root div has class "beta" only; layout reuses the inner .lopa-*
   class names from course.css (as pfd.js / moon.js / shared.js do:
   no CSS duplication, and the .lopa/.pfd/.moon/.shared roots stay
   untouched by those widgets).
   Markup:
     <div class="beta">
       <script type="application/json">
       {
         "title": "...", "instruction": "...",
         "subfactors": [
           { "label": "Разделение",
             "weights": [2400, 580, 140, 35, 8],
             "levels": ["общие кабели и шина", "...", "...", "...", "разные здания"],
             "selected": 1 },
           ... 8 subfactors, a..e in that order ...
         ],
         "lambda": 1e-6, "ti": 8760
       }
       </script>
     </div>
   Model (Humphreys 1987 checklist, as presented in Rausand &
   Lundteigen, ch. 10, slides 37-38):
     β        = Σ scores / 50 000          scores per subfactor, level a..e
                all "a" → β = 0,302;  all "e" → β = 0,001
     pi       = λ_DU · TI / 2              one copy, no redundancy
     p(1+1)   = [(1 − β)·pi]² + β·pi       β-model: the CCF term is a floor
   The lesson's point: β is a property of the project, not of the device —
   the checklist turns "we assume 5 %" into eight answers someone can audit.
   ============================================================ */
(function () {
  "use strict";

  var LEVELS = ["a", "b", "c", "d", "e"];
  var DIVISOR = 50000;

  function jsonOf(root) {
    var s = root.querySelector('script[type="application/json"]');
    return s ? JSON.parse(s.textContent) : null;
  }

  var F = window.SilFmt;
  var fmt = F.fmt;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
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

    /* Default: the worst level on every subfactor, so the widget opens on the
       anchoring point β = 0,302 and the reader climbs up from there. */
    var state = cfg.subfactors.map(function (s) {
      return typeof s.selected === "number" ? s.selected : 0;
    });

    function field(labelTxt) {
      var f = el("label", "lopa-field");
      f.appendChild(el("span", "lopa-label", labelTxt));
      left.appendChild(f);
      return f;
    }

    cfg.subfactors.forEach(function (sub, i) {
      var sel = el("select", "lopa-select");
      sub.levels.forEach(function (tag, j) {
        var op = el("option", null, LEVELS[j] + "\u00a0— " + tag);
        op.value = String(j);
        if (j === state[i]) op.selected = true;
        sel.appendChild(op);
      });
      sel.addEventListener("change", function () {
        state[i] = parseInt(sel.value, 10);
        recalc();
      });
      field(sub.label).appendChild(sel);
    });

    var out = el("div", "lopa-out");
    out.setAttribute("aria-live", "polite");
    right.appendChild(out);

    function line(label) {
      var d = el("div", "lopa-line");
      d.appendChild(el("span", "lopa-line-label", label));
      out.appendChild(d);
      return d;
    }

    function pct(x) {
      return String((100 * x).toFixed(x < 0.01 ? 2 : 1)).replace(".", ",") + "\u00a0%";
    }

    function recalc() {
      out.innerHTML = "";

      var scores = cfg.subfactors.map(function (sub, i) {
        return { label: sub.label, level: LEVELS[state[i]], score: sub.weights[state[i]] };
      });
      var total = scores.reduce(function (a, s) { return a + s.score; }, 0);
      var beta = total / DIVISOR;

      var lam = cfg.lambda;
      var ti = cfg.ti;
      var pi = lam * ti / 2;
      var indep = Math.pow((1 - beta) * pi, 2);
      var ccf = beta * pi;
      var p11 = indep + ccf;

      /* The subfactor that contributes most is where the money is: naming it
         turns the score into a design decision. */
      var worst = scores.slice().sort(function (a, b) { return b.score - a.score; })[0];

      function group(n) {
        return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
      }

      line("Сумма баллов")
        .appendChild(el("strong", null, group(total) + "\u00a0/\u00a050\u00a0000"));

      /* Labels are uppercased by CSS, which would turn β into Β and p into P:
         formulas live in the value and the note, never in the label. */
      var bLine = line("Фактор по чек-листу");
      bLine.appendChild(el("strong", "lopa-sil", "β\u00a0" + pct(beta)));
      var note;
      if (beta > 0.10) note = "выше типичного: чек-лист вскрыл системные слабости";
      else if (beta > 0.05) note = "диапазон полевых узлов по МЭК 61508-6 — для питания обычно";
      else if (beta > 0.005) note = "в диапазоне и логики, и полевых узлов";
      else note = "лучше диапазона МЭК: проверьте, не занижены ли оценки";
      bLine.appendChild(el("span", "lopa-note", note));

      line("Главный вклад: " + worst.label.toLowerCase())
        .appendChild(el("span", "lopa-note",
          worst.level + " — " + group(worst.score) + " из " + group(total) + " баллов"));

      line("PFD одной копии (без резерва)")
        .appendChild(el("strong", null, fmt(Number(pi.toPrecision(6)))));

      var indLine = line("Независимая часть");
      indLine.appendChild(el("span", "lopa-note",
        "[(1−β)·p]² = " + fmt(Number(indep.toPrecision(6)))));

      var ccfLine = line("Слагаемое общей причины");
      ccfLine.appendChild(el("strong", null, fmt(Number(ccf.toPrecision(6)))));
      ccfLine.appendChild(el("span", "lopa-note", "β·p"));

      line("PFD звена 1+1")
        .appendChild(el("strong", "lopa-sil", fmt(Number(p11.toPrecision(6)))));

      var gain = line("Выигрыш от второго блока");
      gain.appendChild(el("strong", null, "×\u00a0" + String((pi / p11).toFixed(1)).replace(".", ",")));
      gain.appendChild(el("span", "lopa-note",
        "при β 5\u00a0% из формулы урока — ×\u00a0" +
        String((pi / (((1 - 0.05) * pi) * ((1 - 0.05) * pi) + 0.05 * pi)).toFixed(1)).replace(".", ",")));

      var wrap = el("div", "lopa-formula-wrap");
      wrap.appendChild(el("span", "lopa-formula",
        "β = Σ баллов / 50 000; все «a» → 0,302, все «e» → 0,001. " +
        "Слагаемое β·p от числа блоков не зависит: " +
        "сколько копий ни ставьте, ниже β·λ·TI/2 звено не опустится."));
      out.appendChild(wrap);
    }

    recalc();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".beta").forEach(render);
  });
})();
