/* ============================================================
   SIL Course — MooN architecture configurator widget
   Root div has class "moon" only; layout reuses the inner .lopa-*
   class names from course.css (like pfd.js: no CSS duplication,
   and lopa.js/pfd.js — which hook ".lopa"/".pfd" roots — leave
   this widget alone).
   Markup:
     <div class="moon">
       <script type="application/json">
       {
         "title": "...", "instruction": "...",
         "archs": [
           { "id": "2oo3", "label": "2oo3 — голосование двух из трёх",
             "m": 2, "n": 3, "hft": 1,
             "spurious": "ложные — сильно реже, как у 2oo2",
             "ccf": true },
           ... "m" = votes to trip, "n" = channels ...
         ],
         "lambda": { "label": "λ_DU одного канала",
                     "options": [ {"v": 2.5e-6, "label": "...", "selected": true}, ... ] },
         "ti":     { "label": "Интервал проверки TI",
                     "options": [ {"v": 8760, "label": "1 год (8 760 ч)", "selected": true}, ... ] },
         "target": { "label": "Требуемый RRF (из LOPA)",
                     "options": [ {"v": 200, "label": "RRF ≥ 200", "selected": true}, ... ] }
       }
       </script>
     </div>
   Idealized math (low demand, perfect proof test, independent
   channels — NO common-cause failures):
     p      = λ_DU × TI / 2                       (one channel, lesson 3)
     PFD    = Σ_{k=n−m+1..n} C(n,k)·pᵏ·(1−p)ⁿ⁻ᵏ   (fewer than m healthy
                                                     channels = SIF silent)
     RRF    = 1 / PFD  → achieved SIL band + verdict vs required RRF
     HFT    = n − m    (shown, judged in the lesson text, not here)
   ============================================================ */
(function () {
  "use strict";

  function jsonOf(root) {
    var s = root.querySelector('script[type="application/json"]');
    return s ? JSON.parse(s.textContent) : null;
  }

  var F = window.SilFmt;
  var sup = F.sup;
  var fmt = F.fmt;
  var fmtRRF = F.rrf;
  function silOf(rrf) { return F.silOf(rrf).sil; }

  function C(n, k) {
    var r = 1;
    for (var i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return Math.round(r * 1e9) / 1e9;
  }

  /* PFD of a MooN voted group: dangerous when healthy channels < m. */
  function pfdOf(m, n, p) {
    var s = 0;
    for (var k = n - m + 1; k <= n; k++) s += C(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
    return s;
  }

  var FORMULAS = {
    "1oo1": "p",
    "1oo2": "p²",
    "2oo2": "2p − p²",
    "2oo3": "3p² − 2p³",
    "1oo3": "p³"
  };

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function select(field, value, oninput) {
    var s = el("select", "lopa-select");
    field.options.forEach(function (o) {
      var opt = el("option", null, o.label);
      opt.value = o.v;
      if (o.selected) opt.selected = true;
      s.appendChild(opt);
    });
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

    var state = {};

    function field(labelTxt, fieldData, key) {
      var f = el("label", "lopa-field");
      f.appendChild(el("span", "lopa-label", labelTxt || fieldData.label));
      f.appendChild(select(fieldData, null, function () { recalc(); }));
      left.appendChild(f);
      state[key] = f.querySelector("select");
    }

    var archField = el("label", "lopa-field");
    archField.appendChild(el("span", "lopa-label", "Архитектура MooN"));
    var archSel = el("select", "lopa-select");
    data.archs.forEach(function (a, i) {
      var opt = el("option", null, a.label);
      opt.value = i;
      archSel.appendChild(opt);
    });
    archSel.addEventListener("input", recalc);
    archField.appendChild(archSel);
    left.appendChild(archField);

    field(null, data.lambda, "lambda");
    field(null, data.ti, "ti");
    field(null, data.target, "target");

    var out = el("div", "lopa-out");
    out.setAttribute("aria-live", "polite");
    right.appendChild(out);

    grid.appendChild(left);
    grid.appendChild(right);
    wrap.appendChild(grid);
    root.appendChild(wrap);

    function line(label, html, cls) {
      var d = el("div", "lopa-line" + (cls ? " " + cls : ""));
      d.appendChild(el("span", "lopa-line-label", label));
      d.innerHTML += html;
      return d;
    }

    function recalc() {
      var a = data.archs[+archSel.value];
      var lam = +state.lambda.value;
      var ti = +state.ti.value;
      var target = +state.target.value;

      var p = lam * ti / 2;
      var pfd = pfdOf(a.m, a.n, p);
      var rrf = 1 / pfd;

      out.innerHTML = "";
      out.appendChild(line("Вероятность отказа одного канала",
        "p = λ<sub>DU</sub>·TI/2 = <strong>" + fmt(p) + "</strong>"));
      out.appendChild(line("Отказоустойчивость HFT = N − M",
        "<strong>" + a.hft + "</strong>" +
        (a.hft === 0 ? " — любой отказ канала глушит SIF"
                     : a.hft === 1 ? " — держит один отказ канала"
                                   : " — держит " + a.hft + " отказа")));
      out.appendChild(line("PFD<sub>avg</sub> узла",
        "<strong>" + fmt(pfd) + "</strong>" +
        ' <span class="lopa-note">формула: ' + (FORMULAS[a.id] || "Σ C(n,k)·pᵏ") +
        (a.ccf ? "; идеализация: каналы независимы, без CCF" : "") + "</span>"));
      out.appendChild(line("RRF узла", "<strong>≈ " + fmtRRF(rrf) + "</strong>"));
      var band = F.bandOf(rrf);
      out.appendChild(line("Полоса по PFD (без HFT)",
        '<span class="lopa-sil"><strong>' + silOf(rrf) + '</strong></span>' +
        (band === 4 ? ' <span class="lopa-note">вне рамок курса</span>' : "") +
        ' <span class="lopa-note">число вероятности, структура — ниже</span>'));

      /* Table 6 fixes the minimum HFT by the SIL of the SIF, i.e. by the
         target from LOPA — not by the band the node happens to reach: a node
         whose PFD is better than required must not be failed by the gate. */
      var need = F.hftField(F.bandOf(target));
      var gateText = need === null
        ? '<span class="pfd-verdict bad">целевой SIL 4 — вне рамок курса</span>'
        : (a.hft >= need
            ? '<span class="pfd-verdict ok">проходит: HFT ' + a.hft + " ≥ " + need + "</span>"
            : '<span class="pfd-verdict bad">не проходит: HFT ' + a.hft + " &lt; " + need + "</span>");
      out.appendChild(line("Структурный гейт (полевой узел, табл. 6)",
        gateText +
        ' <span class="lopa-note">' + (need === null
          ? "для целевого SIL 4 стандарт отправляет к МЭК 61508"
          : "для целевого SIL " + F.bandOf(target) + " нужно HFT " + need +
            (a.hft === 1 && need === 2 ? "; 11.4.4 допускает HFT 1 при четырёх условиях" : "")) + "</span>"));
      out.appendChild(line("Ложные срабатывания", a.spurious));

      var ok = rrf >= target;
      out.appendChild(line("Проверка требования",
        "RRF ≥ " + fmtRRF(target) + " — " +
        (ok ? '<span class="pfd-verdict ok">выполняется</span>'
            : '<span class="pfd-verdict bad">не выполняется</span>')));
      out.appendChild(el("div", "lopa-formula-wrap",
        '<span class="lopa-formula">SIF проходит на требуемый SIL, только если выполнены ОДНОВРЕМЕННО ' +
        "и\u00a0вероятность (RRF), и\u00a0структурные ограничения по\u00a0HFT — см. урок, §3.</span>"));
    }

    recalc();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".moon").forEach(render);
  });
})();
