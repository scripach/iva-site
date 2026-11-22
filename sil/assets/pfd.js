/* ============================================================
   SIL Course — PFDavg calculator widget (ticket 17; PTC/TL from 19)
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
             "options": [ {"v": 2.5e-6, "ptc": 1.0,
                           "label": "2,5·10⁻⁶ /ч — ...", "selected": true}, ... ] },
           ... 2–4 series elements ...
         ],
         "ti": { "label": "Интервал проверки TI",
                 "options": [ {"v": 8760, "label": "1 год (8 760 ч)"}, ... ] },
         "tl": { "label": "Срок службы до полного восстановления TL",
                 "options": [ {"v": 175200, "label": "20 лет", "selected": true}, ... ] },
         "target": { "label": "Требуемый RRF (из LOPA)",
                     "options": [ {"v": 200, "label": "RRF ≥ 200 — ..."}, ... ] }
       }
       </script>
     </div>
   Instantly recomputes (one channel per link, low demand):
     PFD_i   ≈ λ_DU,i·[PTC_i·TI/2 + (1−PTC_i)·TL/2]
     PFD     = Σ PFD_i          (series, first-order approximation)
     RRF     = 1 / PFD          — shown for reading; the SIL band is
                                   classified from the unrounded PFD itself

   PTC belongs to the procedure, TL to the element's full restoration.
   A missing "tl" block or a missing "ptc" on an option reproduces the
   old full-coverage behaviour (λ·TI/2). Option values are the option
   index, not λ, because the same λ appears with different procedures.
   The model is named in the UI (cfg.model / cfg.verdictNote); the
   verdict is computed from the unrounded PFD against 1/targetRRF,
   never from the printed value.
   ============================================================ */
(function () {
  "use strict";

  function jsonOf(root) {
    var s = root.querySelector('script[type="application/json"]');
    return s ? JSON.parse(s.textContent) : null;
  }

  var F = window.SilFmt;
  var M = window.SilPfd;
  if (!M) throw new Error("pfd-model.js must be loaded before pfd.js");
  var fmt = F.fmt;
  var fmtRRF = F.rrf;

  function picked(options) {
    return options.filter(function (o) { return o.selected; })[0] || options[0];
  }

  function render(root) {
    var cfg = jsonOf(root);
    if (!cfg) return;
    root.innerHTML = "";
    root.classList.add("widget");

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
      picks: cfg.elements.map(function (el) { return picked(el.options); }),
      ti: picked(cfg.ti.options),
      tl: cfg.tl ? picked(cfg.tl.options) : { v: 0 },
      target: picked(cfg.target.options)
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

    /* Value = option index: one λ may be paired with several procedures,
       so the displayed value alone cannot identify the choice. */
    function select(groupEl, options, initial, onPick) {
      var s = document.createElement("select");
      s.className = "lopa-select";
      options.forEach(function (o, i) {
        var op = document.createElement("option");
        op.value = String(i);
        op.textContent = o.label;
        s.appendChild(op);
      });
      s.value = String(options.indexOf(initial));
      s.addEventListener("change", function () {
        onPick(options[parseInt(s.value, 10)]);
        update();
      });
      groupEl.appendChild(s);
    }

    cfg.elements.forEach(function (el, i) {
      var g = group(left, el.label);
      select(g, el.options, state.picks[i], function (o) { state.picks[i] = o; });
    });
    var gT = group(left, cfg.ti.label || "Интервал проверки TI");
    select(gT, cfg.ti.options, state.ti, function (o) { state.ti = o; });
    if (cfg.tl) {
      var gL = group(left, cfg.tl.label || "Срок службы TL");
      select(gL, cfg.tl.options, state.tl, function (o) { state.tl = o; });
    }
    var gR = group(left, cfg.target.label || "Требуемый RRF");
    select(gR, cfg.target.options, state.target, function (o) { state.target = o; });

    /* ---- output ---- */
    var out = document.createElement("div");
    out.className = "lopa-out";
    out.setAttribute("aria-live", "polite");
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
      var d = line("", el.name, v);
      var note = document.createElement("span");
      note.className = "lopa-note";
      d.appendChild(note);
      return { value: v, note: note };
    });
    var formula = document.createElement("div"); formula.className = "lopa-formula";
    var vSum = document.createElement("strong"); line("", "PFDavg контура (приближение: Σ средних)", vSum);
    var vRRF = document.createElement("strong"); line("", "Достигнутое снижение риска", vRRF);
    var vSil = document.createElement("strong"); vSil.className = "lopa-sil";
    var silLine = line("lopa-sil-line", "Достигнутый уровень", vSil);
    var vNote = document.createElement("span"); vNote.className = "lopa-note";
    silLine.appendChild(vNote);
    var vVerdict = document.createElement("strong");
    var verdictLine = line("", "Вердикт", vVerdict);
    var modelNote = document.createElement("p");
    modelNote.className = "lopa-note widget-model";
    out.appendChild(modelNote);
    var verdictNote = document.createElement("p");
    verdictNote.className = "lopa-note widget-verdict-note";
    out.appendChild(verdictNote);

    function update() {
      var ti = state.ti.v;
      var tl = cfg.tl ? state.tl.v : 0;
      var branch = state.picks.map(function (o) {
        var ptc = typeof o.ptc === "number" ? o.ptc : 1;
        var mean = ptc * ti / 2 + (1 - ptc) * tl / 2;
        return { p: M.branchAverage(o.v, ti, ptc, tl), mean: mean, ptc: ptc };
      });
      var pfds = branch.map(function (b) { return b.p; });
      var sum = M.seriesSum(pfds);
      var verdict = M.verdictOf(sum, state.target.v);
      var rrf = verdict.rrf;
      var sil = F.silOfPfd(sum);
      var need = 1 / state.target.v;
      pfds.forEach(function (p, i) {
        elVals[i].value.textContent = fmt(p);
        var b = branch[i];
        elVals[i].note.textContent = "PTC " + fmtRRF(100 * b.ptc) + " % · средняя наработка " +
          fmtRRF(b.mean) + " ч";
      });
      formula.textContent = pfds.map(fmt).join(" + ") +
        " = " + fmt(sum) + " (каждая ветвь: λ·[PTC·TI/2 + (1−PTC)·TL/2]; сумма средних — первый порядок)";
      vSum.textContent = fmt(sum);
      vRRF.textContent = "RRF ≈ " + (rrf >= 10 ? fmtRRF(rrf) : fmt(rrf));
      vSil.textContent = sil.sil;
      vNote.textContent = "— " + sil.note;
      verdictLine.firstChild.textContent = "Требуется PFD ≤ " + fmt(need) +
        " (RRF ≥ " + fmt(state.target.v) + ")";
      vVerdict.className = "pfd-verdict " + (verdict.passes ? "ok" : "bad");
      vVerdict.textContent = verdict.passes ? "проходит" : "не проходит";
      modelNote.textContent = cfg.model
        ? (cfg.model.label ? cfg.model.label + ": " : "") + cfg.model.note
        : "";
      verdictNote.textContent = cfg.verdictNote || "";
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
