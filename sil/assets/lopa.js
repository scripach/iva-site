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

    /* Сценарий и критерий называются до чисел: это вход, а не результат.
       m печатается только как ссылка на реестр; в арифметике этого листа
       его нет, потому что критерий K-01 задан на сценарий. (правка 27) */
    if (cfg.scenarioId || cfg.criterionId) {
      var meta = document.createElement("p");
      meta.className = "instruction lopa-registry-meta";
      var bits = [];
      if (cfg.scenarioId) bits.push("Сценарий " + cfg.scenarioId);
      if (cfg.classId) bits.push("класс " + cfg.classId);
      if (cfg.registry) bits.push("реестр " + cfg.registry);
      if (cfg.criterionId) bits.push("критерий " + cfg.criterionId);
      if (cfg.m) bits.push(cfg.mNote || "m = " + cfg.m);
      meta.textContent = bits.join(" · ");
      root.appendChild(meta);
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
      var fres = state.fInit * pfd;
      var rrf = fres === 0 ? Infinity : fres / state.target;
      var requiredPfd = fres === 0 ? Infinity : state.target / fres;

      /* Точный десятичный путь (правка 21/22): 1e-4 / (0,1 × 0,1) — ровно
         1e-2 и SIL 1, а значение на один представимый double ниже границы —
         SIL 2. Обратного пересчёта RRF → PFD нет: он ломал границу. */
      var decPfd = F.decOf(1);
      state.ipls.forEach(function (it) {
        if (it.on) decPfd = decPfd ? F.decMul(decPfd, F.decOf(it.cfg.pfd)) : null;
      });
      var decFres = decPfd ? F.decMul(F.decOf(state.fInit), decPfd) : null;
      var decTarget = F.decOf(state.target);
      var noReduction = decFres && decTarget
        ? F.decCmp(decFres, decTarget) <= 0
        : rrf <= 1;
      var decRequired = decFres && decTarget ? F.decDiv(decTarget, decFres) : null;
      var sil = noReduction
        ? { sil: "—", note: "снижение риска не требуется" }
        : (decRequired ? F.silOfDec(decRequired) : F.silOfPfd(requiredPfd));

      vRes.textContent = fmt(fres) + " /год";
      formula.textContent = fmt(state.fInit) +
        (parts.length ? " × " + parts.join(" × ") : "") +
        " = " + fmt(fres) + " /год";
      vF.textContent = fmt(fres) + " / " + fmt(state.target) + " = RRF " +
        (rrf >= 10 ? fmtRRF(rrf) : fmt(rrf));
      vSil.textContent = sil.sil;
      vNote.textContent = "— " + sil.note +
        (sil.sil === "—" ? "" : "; назначение SIL фиксируют отдельным решением");

      /* Границы утверждений тренажёра (правка 22, T05/V06): что проверено
         числами и что остаётся вне расчёта. */
      F.scope(out, {
        status: "requirement",
        mode: "низкая частота запросов; слои до SIF взяты как независимые",
        units: "частота\u00a0— 1/год; PFD и RRF\u00a0— безразмерные отношения",
        checked: [
          "остаточная частота f_ост = f_инит × Π PFD(enabled IPL)",
          "отношение f_ост / f_цель и числовая полоса требования"
        ],
        unchecked: [
          "независимость и реальные PFD слоёв защиты",
          "полнота сценария и частота инициатора",
          "HFT и архитектура будущей функции",
          "систематическая полнота SC",
          "время реакции и жизненный цикл"
        ],
        conclusion: noReduction
          ? "По введённым числам снижение риска не требуется. Это вывод LOPA; SIL функции требует отдельных проверок архитектуры, SC, времени реакции и жизненного цикла."
          : "Требование рассчитано как числовая полоса. Назначенный SIL и подтверждение функции требуют отдельных проверок: HFT/архитектура, SC, время реакции и жизненный цикл."
      });
    }
    update();
    F.installReset(root);
    var fWrap = document.createElement("div");
    fWrap.className = "lopa-formula-wrap";
    fWrap.appendChild(formula);
    out.insertBefore(fWrap, out.children[1]);
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".lopa").forEach(render);
  });
})();
