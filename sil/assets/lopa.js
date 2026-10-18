/* ============================================================
   SIL Course — LOPA calculator widget
   Markup:
     <div class="lopa">
       <script type="application/json">
       {
         "fInit":   { "label": "...", "options": [ {"v": 1, "label": "1 /год"}, ... ] },
         "ipls":    [ {"label": "...", "pfd": 0.1, "checked": false}, ... ],
         "targets": [ {"v": 1e-3, "label": "10⁻³ /год"}, ... ],
         "targetLabel": "..."
       }
       </script>
     </div>
   Instantly recomputes:
     f_res  = f_init × Π PFD(enabled IPLs)
     RRF_req = f_res / f_target          → SIL table (low demand)
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

  function silOf(rrf) {
    if (rrf <= 1) return { sil: "—", note: "снижение риска не требуется" };
    return F.silOf(rrf);
  }

  function render(root) {
    var cfg = jsonOf(root);
    if (!cfg) return;
    root.innerHTML = "";
    root.classList.add("widget");

    var title = document.createElement("p");
    title.className = "widget-title";
    title.textContent = cfg.title || "LOPA-калькулятор";
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

    /* ---- controls ---- */
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

    function picked(list) {
      var hit = list.filter(function (o) { return o.selected; })[0];
      return hit || list[0];
    }

    var state = {
      fInit: picked(cfg.fInit.options).v,
      ipls: cfg.ipls.map(function (i) { return { cfg: i, on: !!i.checked }; }),
      target: picked(cfg.targets).v
    };

    var gF = group(left, cfg.fInit.label || "Инициирующее событие");
    var selF = document.createElement("select");
    selF.className = "lopa-select";
    cfg.fInit.options.forEach(function (o) {
      var op = document.createElement("option");
      op.value = String(o.v);
      op.textContent = o.label;
      if (o.selected) op.selected = true;
      selF.appendChild(op);
    });
    selF.addEventListener("change", function () { state.fInit = parseFloat(selF.value); update(); });
    gF.appendChild(selF);

    var gT = group(left, cfg.targetLabel || "Допустимая частота");
    var selT = document.createElement("select");
    selT.className = "lopa-select";
    cfg.targets.forEach(function (o) {
      var op = document.createElement("option");
      op.value = String(o.v);
      op.textContent = o.label;
      if (o.selected) op.selected = true;
      selT.appendChild(op);
    });
    selT.addEventListener("change", function () { state.target = parseFloat(selT.value); update(); });
    gT.appendChild(selT);

    var gI = group(left, "Независимые слои защиты (IPL)");
    var box = document.createElement("div");
    box.className = "lopa-ipls";
    state.ipls.forEach(function (it, idx) {
      var lab = document.createElement("label");
      lab.className = "lopa-ipl";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = it.on;
      cb.addEventListener("change", function () { state.ipls[idx].on = cb.checked; update(); });
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(it.cfg.label + " (PFD " + fmt(it.cfg.pfd) + ")"));
      box.appendChild(lab);
    });
    gI.appendChild(box);

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

    var vRes = document.createElement("strong"); line("", "Остаточная частота сценария", vRes);
    var formula = document.createElement("div"); formula.className = "lopa-formula";
    var vF = document.createElement("strong"); line("", "Требуемое снижение риска", vF);
    var vSil = document.createElement("strong"); vSil.className = "lopa-sil";
    var silLine = line("lopa-sil-line", "Требуемый уровень SIF", vSil);
    var vNote = document.createElement("span"); vNote.className = "lopa-note";
    silLine.appendChild(vNote);

    function update() {
      var pfd = 1;
      var parts = [];
      state.ipls.forEach(function (it) {
        if (it.on) { pfd *= it.cfg.pfd; parts.push(fmt(it.cfg.pfd)); }
      });
      var fres = Number((state.fInit * pfd).toPrecision(6));
      var rrf = Number((fres / state.target).toPrecision(6));
      var sil = silOf(rrf);
      vRes.textContent = fmt(fres) + " /год";
      formula.textContent = fmt(state.fInit) +
        (parts.length ? " × " + parts.join(" × ") : "") +
        " = " + fmt(fres) + " /год";
      vF.textContent = fmt(fres) + " / " + fmt(state.target) + " = RRF " +
        (rrf >= 10 ? fmtRRF(rrf) : fmt(rrf));
      vSil.textContent = sil.sil;
      vNote.textContent = "— " + sil.note;
    }
    update();
    var fWrap = document.createElement("div");
    fWrap.className = "lopa-formula-wrap";
    fWrap.appendChild(formula);
    out.insertBefore(fWrap, out.children[1]);
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".lopa").forEach(render);
  });
})();
