/* ============================================================
   SIL Course — voted group on shared input modules (lesson 10)
   Root div has class "module" only; layout reuses the inner
   .lopa-* class names from course.css (same convention as pfd.js,
   moon.js, shared.js, assemble.js, bypass.js, dossier.js — no CSS
   duplication, other widget roots untouched).

   Markup:
     <div class="module">
       <script type="application/json">
       {
         "title": "...", "instruction": "...",
         "channel": { "label": "PFD одного канала", "options": [ {"v": 5.2e-4, "label": "...", "selected": true}, ... ] },
         "arch":    { "label": "Голосование",        "options": [ {"v": "2oo3", "label": "2oo3 — два из трёх", "m": 2, "n": 3}, ... ] },
         "modules": { "label": "Сколько модулей ввода делят каналы",
                      "options": [ {"v": 1, "label": "один модуль на всю группу"}, ... ] },
         "module":  { "label": "PFD модуля ввода",   "options": [ {"v": 2e-5, "label": "2,0·10⁻⁵ — F-DI, паспорт"}, ... ] },
         "beta":    { "label": "β между каналами",   "options": [ {"v": 0.05, "label": "5 %", "selected": true}, ... ] }
       }
       </script>
     </div>

   Model. A channel is one measurement path: its dangerous failures are
   averaged as p (already includes PTC, TI, TL — the lesson-7 formula).
   Channels are voted m-of-n and share beta of their failures.

     q      = (1 − β)·p
     G(n)   = Σ_{j=n−m+1..n} C(n,j)·q^j·(1−q)^(n−j) + β·p        (dangerous: fewer than m alive)

   Sharing a module is NOT a beta of the channels: the module is one
   piece of hardware whose failure kills every channel wired to it at
   once. It is modelled by enumeration over the modules that failed:

     PFD = Σ_{S ⊆ modules} [∏_{i∈S} q_m · ∏_{i∉S} (1 − q_m)] · G(channels alive after S)

   G(alive < m) = 1: the group cannot trip, it is already dead.
   Channels are spread over the available modules as evenly as possible,
   which is the best case of the sharing being asked about.

   This is why 2oo3 on one module is not 2oo3: a module failure removes
   all three channels at once, so the vote only ever runs on channel
   failures, and the module's own PFD lands in the answer whole.
   β between channels stays in the model as well: channels on different
   modules still share field wiring, process tapping and proof-test
   procedure. Counting both is conservative, and the widget says so.
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

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function picked(options) {
    return options.filter(function (x) { return x.selected; })[0] || options[0];
  }

  function C(n, k) {
    if (k < 0 || k > n) return 0;
    var r = 1;
    for (var i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return r;
  }

  /* PFD of a voted group of `n` channels, CCF included. n = 0 → the group
     is already gone whenever m ≥ 1, so the conditional probability is 1. */
  function groupPfd(m, n, p, beta) {
    if (n < m) return 1;
    var q = (1 - beta) * p;
    var sum = 0;
    for (var j = n - m + 1; j <= n; j++) {
      sum += C(n, j) * Math.pow(q, j) * Math.pow(1 - q, n - j);
    }
    return sum + beta * p;
  }

  /* Even spread: channels 0, k, 2k… land on module 0. For 2oo3 with two
     modules that gives 2 + 1, which is what a cabinet actually looks like. */
  function owner(i, k) { return i % k; }

  function sharedPfd(m, n, p, beta, k, qm) {
    var masks = 1 << k;
    var total = 0;
    for (var mask = 0; mask < masks; mask++) {
      var pr = 1;
      for (var i = 0; i < k; i++) pr *= (mask & (1 << i)) ? qm : (1 - qm);
      var alive = 0;
      for (var c = 0; c < n; c++) {
        if (!(mask & (1 << owner(c, k)))) alive++;
      }
      total += pr * groupPfd(m, alive, p, beta);
    }
    return total;
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
      p: parseFloat(picked(cfg.channel.options).v),
      arch: picked(cfg.arch.options),
      k: parseFloat(picked(cfg.modules.options).v),
      qm: parseFloat(picked(cfg.module.options).v),
      beta: parseFloat(picked(cfg.beta.options).v)
    };

    var controls = {};

    function select(key, cfgObj, value, onPick) {
      var f = el("label", "lopa-field");
      f.appendChild(el("span", "lopa-label", cfgObj.label));
      var s = el("select", "lopa-select");
      cfgObj.options.forEach(function (o, i) {
        var key2 = o.v !== undefined ? String(o.v) : String(i);
        var op = el("option", null, o.label !== undefined ? o.label : key2);
        op.value = key2;
        if (key2 === String(value)) op.selected = true;
        s.appendChild(op);
      });
      s.addEventListener("change", function () { onPick(s.value); recalc(); });
      f.appendChild(s);
      left.appendChild(f);
      controls[key] = { field: f, select: s, cfg: cfgObj };
      return s;
    }

    function syncModules() {
      /* A 1oo1 group has one channel: two modules are not an option. */
      var n = state.arch.n;
      var ctl = controls.modules;
      var keep = null;
      Array.prototype.slice.call(ctl.select.children).forEach(function (op) {
        var over = parseFloat(op.value) > n;
        op.hidden = over;
        op.disabled = over;
      });
      if (state.k > n) {
        state.k = n;
        Array.prototype.slice.call(ctl.select.children).forEach(function (op) {
          if (parseFloat(op.value) === n) { op.selected = true; keep = op; }
        });
      }
      return keep;
    }

    select("channel", cfg.channel, state.p, function (v) { state.p = parseFloat(v); });
    select("arch", cfg.arch, state.arch.v, function (v) {
      state.arch = cfg.arch.options.filter(function (o) { return String(o.v) === v; })[0];
      syncModules();
    });
    select("modules", cfg.modules, state.k, function (v) { state.k = parseFloat(v); });
    select("module", cfg.module, state.qm, function (v) { state.qm = parseFloat(v); });
    select("beta", cfg.beta, state.beta, function (v) { state.beta = parseFloat(v); });
    syncModules();

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

      var m = state.arch.m, n = state.arch.n;
      var p = state.p, beta = state.beta, k = state.k, qm = state.qm;

      /* The rival structure an engineer actually weighs against this one:
         2oo3 ↔ 1oo2 (same channel count is what a cabinet price compares).
         Printing both is the point — on one module they come out equal. */
      var altM = n === 3 ? 1 : 2, altN = n === 3 ? 2 : 3;
      var alt = sharedPfd(altM, altN, p, beta, k, qm);
      var altName = altM + "oo" + altN;
      var otherArchTxt = n === 1
        ? ""
        : altName + " при тех же модулях (" + fmt(Number(alt.toPrecision(3))) + ")";

      var ideal = groupPfd(m, n, p, beta);
      var actual = sharedPfd(m, n, p, beta, k, qm);
      var one = p + qm;                       /* a single unprotected channel */
      var rrf = 1 / actual;
      var band = F.silOf(rrf);

      value("PFD канала", fmt(p), "уже включает PTC, TI и срок службы");
      value("Группа " + state.arch.v + " без общей части",
        fmt(Number(ideal.toPrecision(4))),
        "вклад β " + Math.round(beta * 100) + "\u00a0%");
      /* SIL 4 is not a brag here: in the process industry it is not
         assigned at all, and a computed band that high usually means λ was
         taken too low or the common part was left out. Say so in place. */
      var bandTxt = "RRF ≈ " + fmtRRF(rrf) + " — " + band.sil;
      if (band.sil === "SIL 4") bandTxt += ", полоса вне рамок курса";
      value("Группа с модулями", fmt(Number(actual.toPrecision(4))), bandTxt,
        actual <= ideal * 1.15 ? "lopa-sil" : "pfd-verdict bad");

      /* An odd number of modules cannot spread evenly, so the worst-hit
         module decides: one failure removes ceil(n/k) channels at once. */
      var dead = Math.ceil(n / k);
      var alive = n - dead;
      var survives = alive >= m;

      var share = 100 * (actual - ideal) / actual;
      var dShare = line("Вклад отказа модуля");
      var shareTxt = qm === 0 ? "нет общей части"
        : share < 0.5 ? "меньше 0,5\u00a0% PFD группы"
        : Math.round(share) + "\u00a0% PFD группы";
      dShare.appendChild(el("strong", survives || n === 1 ? null : "pfd-verdict bad", shareTxt));
      var shareWhy;
      if (n === 1) {
        shareWhy = "Резервировать нечего: модуль обслуживает единственный канал, и его отказ " +
          "складывается с отказом канала без всякого голосования.";
      } else if (qm === 0) {
        shareWhy = "Модуль в этой настройке не отказывает, поэтому в PFD группы нет его " +
          "слагаемого. Слагаемое появится, как только вернуть настоящее значение из паспорта.";
      } else if (survives) {
        shareWhy = "Отказ одного модуля снимает " + dead + " из " + n + " каналов; живыми " +
          "остаются " + alive + ", этого хватает кворуму " + m + " из " + n +
          ". Модуль входит в ответ отдельным слагаемым, а не через β.";
      } else {
        shareWhy = "Отказ одного модуля снимает " + dead + " из " + n + " каналов; живыми " +
          "остаются " + alive + ", а кворуму " + state.arch.v + " нужно " + m +
          ". Группа не срабатывает, и модуль входит в ответ как полная единица.";
      }
      dShare.appendChild(el("span", "lopa-note-block", shareWhy));

      var vLine = line("Что это значит для структуры");
      var better = one / actual;
      var hasGain = n > 1 && survives && actual < one * 0.8;
      vLine.appendChild(el("strong", hasGain ? "lopa-sil" : "pfd-verdict bad",
        n === 1 ? "это и есть один канал"
          : "лучше одиночного в " + better.toFixed(1).replace(".", ",") + " раза"));
      var why;
      if (n === 1) {
        why = "Голосовать нечего: PFD группы — это PFD канала плюс PFD модуля. Резерв " +
          "начинается со второго канала.";
      } else if (qm === 0) {
        why = "Общей части в этой настройке нет: модуль не отказывает, и группа голосует " +
          "только по каналам. Это верхняя граница, а не проектное число.";
      } else if (!survives) {
        why = "Число каналов внутри общего модуля покупает отказ канала, а не отказ модуля: " +
          "пока модуль один, " + state.arch.v + " не переживает его отказ. " +
          "Та же группа " + otherArchTxt + " — разница в пределах процента.";
      } else if (k >= n) {
        why = "У каждого канала свой модуль: отказ выбивает один канал, и группа доживает до " +
          "второго. Дальше выигрыш ограничивает β, а не число каналов.";
      } else {
        why = "Каналы разложены на " + k + " модуля: отказ одного группа переживает, отказ " +
          "двух — уже нет. Это промежуточная цена между одним модулем и модулем на канал.";
      }
      vLine.appendChild(el("span", "lopa-note-block", why));

      var note = el("div", "lopa-formula-wrap");
      note.appendChild(el("span", "lopa-formula",
        "G = Σ C(n,j)·q^j·(1−q)^(n−j) + β·p,  q = (1−β)·p;  отказ модуля снимает все его каналы."));
      out.appendChild(note);
    }

    recalc();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".module").forEach(render);
  });
})();
