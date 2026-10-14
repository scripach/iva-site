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

  function silOf(rrf) {
    if (rrf <= 1)   return { sil: "—", note: "снижение риска не требуется" };
    if (rrf <= 10)  return { sil: "SIL не нормируется (< 10)", note: "обычная блокировка достаточна" };
    if (rrf <= 100) return { sil: "SIL 1", note: "RRF 10–100" };
    if (rrf <= 1000) return { sil: "SIL 2", note: "RRF 100–1 000" };
    if (rrf <= 10000) return { sil: "SIL 3", note: "RRF 1 000–10 000" };
    return { sil: "SIL 4 / пересмотр", note: "RRF > 10 000 — в процессной отрасли обычно пересматривают процесс, а не строят SIF" };
  }

  function render(root) {
    var cfg = jsonOf(root);
    if (!cfg) return;
    root.innerHTML = "";

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

    var state = {
      fInit: cfg.fInit.options[0].v,
      ipls: cfg.ipls.map(function (i) { return { cfg: i, on: !!i.checked }; }),
      target: cfg.targets[0].v
    };

    var gF = group(left, cfg.fInit.label || "Инициирующее событие");
    var selF = document.createElement("select");
    selF.className = "lopa-select";
    cfg.fInit.options.forEach(function (o) {
      var op = document.createElement("option");
      op.value = String(o.v);
      op.textContent = o.label;
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
      lab.appendChild(document.createTextNode(it.cfg.label + " (PFD " + it.cfg.pfd + ")"));
      box.appendChild(lab);
    });
    gI.appendChild(box);

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

    var vRes = document.createElement("strong"); line("", "Остаточная частота сценария", vRes);
    var formula = document.createElement("div"); formula.className = "lopa-formula";
    var vF = document.createElement("strong"); line("", "Требуемое снижение риска", vF);
    var vSil = document.createElement("strong"); vSil.className = "lopa-sil";
    var silLine = line("lopa-sil-line", "Требуемый уровень SIF", vSil);
    var vNote = document.createElement("span"); vNote.className = "lopa-note";
    silLine.appendChild(vNote);

    function update() {
      var pfd = 1;
      var names = [];
      state.ipls.forEach(function (it) {
        if (it.on) { pfd *= it.cfg.pfd; names.push(it.cfg.label + " (" + it.cfg.pfd + ")"); }
      });
      var fres = state.fInit * pfd;
      var rrf = fres / state.target;
      var sil = silOf(rrf);
      vRes.textContent = fmt(fres) + " /год";
      formula.textContent = fmt(state.fInit) +
        (names.length ? " × " + names.map(function (n) { return n.match(/\(([^)]+)\)/)[1]; }).join(" × ") : "") +
        " = " + fmt(fres) + " /год";
      vF.textContent = fmt(fres) + " / " + fmt(state.target) + " = RRF " + (rrf >= 10 ? fmt(rrf) : rrf.toFixed(1));
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
