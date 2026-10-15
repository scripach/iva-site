/* ============================================================
   SIL Course — PFDavg calculator widget
   Root div has class "pfd" only; layout reuses the inner .lopa-*
   class names from course.css (deliberately: no CSS duplication,
   and lopa.js — which hooks ".lopa" roots — leaves this widget alone).
   Markup:
     <div class="pfd">
       <script type="application/json">
       {
         "title": "...", "instruction": "...",
         "elements": [
           { "name": "Датчик", "label": "Датчик (PSHH): λ_DU",
             "options": [ {"v": 2.5e-6, "label": "2,5·10⁻⁶ /ч — ...", "selected": true}, ... ] },
           ... 2–4 series elements ...
         ],
         "ti": { "label": "Интервал проверки TI",
                 "options": [ {"v": 8760, "label": "1 год (8 760 ч)"}, ... ] },
         "target": { "label": "Требуемый RRF (из LOPA)",
                     "options": [ {"v": 200, "label": "RRF ≥ 200 — сепаратор (урок 2)"}, ... ] }
       }
       </script>
     </div>
   Instantly recomputes (1oo1, low demand, simplified):
     PFD_i   ≈ λ_DU,i × TI / 2
     PFD     = Σ PFD_i          (series: any failed element fails the SIF)
     RRF     = 1 / PFD          → achieved SIL band + verdict vs required RRF
   ============================================================ */
(function () {
  "use strict";

  function jsonOf(root) {
    var s = root.querySelector('script[type="application/json"]');
    return s ? JSON.parse(s.textContent) : null;
  }

  function fmt(x) {
    if (x === 0) return "0";
    var e = Math.floor(Math.log10(x));
    if (e >= -1) return x.toFixed(e >= 2 ? 0 : 2);
    var m = x / Math.pow(10, e);
    return m.toFixed(1).replace(/\.0$/, "") + "·10" + sup(e);
  }
  function sup(n) {
    var map = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
    return String(n).split("").map(function (c) { return map[c] || c; }).join("");
  }

  /* SIL band by achieved RRF; boundaries read as “RRF ≥ 100 ⇒ SIL 2”. */
  function silOf(rrf) {
    if (rrf >= 10000) return { sil: "SIL 4", note: "RRF ≥ 10 000" };
    if (rrf >= 1000)  return { sil: "SIL 3", note: "RRF 1 000–10 000" };
    if (rrf >= 100)   return { sil: "SIL 2", note: "RRF 100–1 000" };
    if (rrf >= 10)    return { sil: "SIL 1", note: "RRF 10–100" };
    return { sil: "—", note: "RRF < 10 — вне шкалы SIL" };
  }

  function render(root) {
    var cfg = jsonOf(root);
    if (!cfg) return;
    root.innerHTML = "";

    var title = document.createElement("p");
    title.className = "widget-title";
    title.textContent = cfg.title || "PFD-калькулятор";
    root.appendChild(title);

    if (cfg.instruction) {
      var ins = document.createElement("p");
      ins.className = "instruction";
      ins.textContent = cfg.instruction;
      root.appendChild(ins);
    }

    var grid = document.createElement("div");
    grid.className = "lopa-grid";
    root.appendChild(grid);

    var left = document.createElement("div");
    var right = document.createElement("div");
    grid.appendChild(left); grid.appendChild(right);

    var state = {
      lambdas: cfg.elements.map(function (el) {
        var sel = el.options.filter(function (o) { return o.selected; })[0] || el.options[0];
        return sel.v;
      }),
      ti: (cfg.ti.options.filter(function (o) { return o.selected; })[0] || cfg.ti.options[0]).v,
      target: (cfg.target.options.filter(function (o) { return o.selected; })[0] || cfg.target.options[0]).v
    };

    function group(parent, labelTxt) {
      var g = document.createElement("label");
      g.className = "lopa-field";
      var l = document.createElement("span");
      l.className = "lopa-label";
      l.textContent = labelTxt;
      g.appendChild(l);
      parent.appendChild(g);
      return g;
    }
    function select(groupEl, options, initial, onPick) {
      var s = document.createElement("select");
      s.className = "lopa-select";
      options.forEach(function (o) {
        var op = document.createElement("option");
        op.value = String(o.v);
        op.textContent = o.label;
        s.appendChild(op);
      });
      s.value = String(initial);
      s.addEventListener("change", function () { onPick(parseFloat(s.value)); });
      groupEl.appendChild(s);
    }

    cfg.elements.forEach(function (el, i) {
      var g = group(left, el.label);
      select(g, el.options, state.lambdas[i], function (v) { state.lambdas[i] = v; update(); });
    });
    var gT = group(left, cfg.ti.label || "Интервал проверки TI");
    select(gT, cfg.ti.options, state.ti, function (v) { state.ti = v; update(); });
    var gR = group(left, cfg.target.label || "Требуемый RRF");
    select(gR, cfg.target.options, state.target, function (v) { state.target = v; update(); });

    /* ---- output ---- */
    var out = document.createElement("div");
    out.className = "lopa-out";
    right.appendChild(out);

    function line(cls, label, valueEl) {
      var d = document.createElement("div");
      d.className = "lopa-line " + (cls || "");
      var lt = document.createElement("span");
      lt.className = "lopa-line-label";
      lt.textContent = label;
      d.appendChild(lt);
      d.appendChild(valueEl);
      out.appendChild(d);
      return d;
    }

    var elVals = cfg.elements.map(function (el) {
      var v = document.createElement("strong");
      line("", el.name, v);
      return v;
    });
    var formula = document.createElement("div"); formula.className = "lopa-formula";
    var vSum = document.createElement("strong"); line("", "PFD контура (Σ ветвей)", vSum);
    var vRRF = document.createElement("strong"); line("", "Достигнутое снижение риска", vRRF);
    var vSil = document.createElement("strong"); vSil.className = "lopa-sil";
    var silLine = line("lopa-sil-line", "Достигнутый уровень", vSil);
    var vNote = document.createElement("span"); vNote.className = "lopa-note";
    silLine.appendChild(vNote);
    var vVerdict = document.createElement("strong");
    var verdictLine = line("", "Вердикт", vVerdict);

    function update() {
      var pfds = state.lambdas.map(function (l) { return l * state.ti / 2; });
      var sum = Number(pfds.reduce(function (a, b) { return a + b; }, 0).toPrecision(6));
      var rrf = Number((1 / sum).toPrecision(6));
      var sil = silOf(rrf);
      var need = 1 / state.target;
      pfds.forEach(function (p, i) { elVals[i].textContent = fmt(Number(p.toPrecision(6))); });
      formula.textContent = pfds.map(function (p) { return fmt(Number(p.toPrecision(6))); }).join(" + ") +
        " = " + fmt(sum) + "   (каждая ветвь: λ_DU·TI/2)";
      vSum.textContent = fmt(sum);
      vRRF.textContent = "RRF ≈ " + (rrf >= 10 ? fmt(rrf) : rrf.toFixed(1));
      vSil.textContent = sil.sil;
      vNote.textContent = "— " + sil.note;
      verdictLine.firstChild.textContent = "Требуется PFD ≤ " + fmt(Number(need.toPrecision(6))) +
        " (RRF ≥ " + fmt(state.target) + ")";
      vVerdict.className = "pfd-verdict " + (rrf >= state.target ? "ok" : "bad");
      vVerdict.textContent = rrf >= state.target ? "проходит" : "не проходит";
    }
    update();
    var fWrap = document.createElement("div");
    fWrap.className = "lopa-formula-wrap";
    fWrap.appendChild(formula);
    out.insertBefore(fWrap, out.children[cfg.elements.length]);
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".pfd").forEach(render);
  });
})();
