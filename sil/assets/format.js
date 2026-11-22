/* ============================================================
   SIL Course — shared number and SIL-band helpers
   Loaded before quiz/lopa/pfd/moon widgets. Exposes window.SilFmt:
     fmt(x)          result with at most one decimal: 2522,4 | 2,0·10⁻³ |
                     2,6·10⁻⁵ | 0,1 | 1. Small (< 0,1) and large (≥ 10⁵)
                     values use normalised scientific notation with a
                     coefficient rounded to tenths (U06).
     pct(x)          the same number with a non-breaking space and «%»
     rrf(x)          risk reduction factor: one decimal at most, thin-space
                     groups in the plain range: 2 522,4 | 8 300 | 2,5·10⁵
     bandOfPfd(pfd)  numeric SIL band by unrounded PFD, table 4:
                       1: 10⁻² ≤ PFD < 10⁻¹
                       2: 10⁻³ ≤ PFD < 10⁻²
                       3: 10⁻⁴ ≤ PFD < 10⁻³
                       4: 10⁻⁵ ≤ PFD < 10⁻⁴ (outside the course)
                       0: outside the supported scale
     silOfPfd(pfd)   { sil, note, band } for an achieved or required PFD
     decOf(x)        exact decimal {n, d} with BigInt, from the decimal value
     decMul/decDiv/decAdd/decSub/decCmp  exact decimal operations for source values
     decPow(dec, n)  exact non-negative integer power (β- and binomial models)
     bandOfDec(dec)  same table, exact decimal; no tolerance or snapping
     silOfDec(dec)   { sil, note, band } for an exact decimal PFD
     hftField(sil)     min HFT, ГОСТ Р МЭК 61511-1-2018 табл. 6, low demand
     hftByMode(sil,hi) same table, high-demand/continuous column when hi
     scope(root,opts)  «что проверено и что нет» for a numerical widget
     installReset(root) button that restores the example the page opened with
   Formatting contract: decimal comma, superscript exponents, no
   locale-dependent toLocaleString anywhere in the course.

   A numerical band is not, by itself, a confirmed SIL. Every calculator
   that prints a band or a verdict calls scope() next to its result: mode,
   units, what was calculated, what was not (architecture/HFT, systematic
   capability, response time, lifecycle) and the limit of the conclusion.
   The third outcome — the inputs do not allow a full conclusion — is shown
   as «не определено» with its reason, not as a green verdict.

   The table-4 boundaries are half-open: the lower PFD bound is included,
   the upper one is not. RRF = 1/PFD therefore reads with a strict lower
   bound and an inclusive upper bound (10 < RRF ≤ 100 for SIL 1). The old
   silOf(rrf)/bandOf(rrf) helpers moved RRF = 100 to SIL 2; they are gone.
   A deliberate assignment of a higher SIL is a separate design decision
   and must not be reported as the numerical band.

   There is deliberately no tolerance around a boundary. A PFD one
   representable double below 10⁻² is SIL 2, not SIL 1. Where a ratio is
   built from the course's decimal inputs (LOPA, target scenario, HFT by
   target), consumers use decOf/decMul/decDiv and bandOfDec, so an exact
   decimal boundary is recognised without snapping the binary result.
   ============================================================ */
(function (global) {
  "use strict";

  var SUP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
              "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };

  function sup(n) {
    return String(n).split("").map(function (c) { return SUP[c] || c; }).join("");
  }

  function comma(s) { return s.replace(".", ","); }

  var NB = "\u00a0";
  var SCI_SMALL = 0.1;
  var SCI_LARGE = 100000;

  /* Round a positive finite plain number to one decimal place, half up on
     its decimal representation. Returns a dot-decimal string without a
     trailing «.0». Decimal half-up is deliberate: (1.95).toFixed(1) reads
     the binary value and gives 1.9, while the course prints 2.0. */
  function plain1(x) {
    var s = x.toFixed(15);
    var dot = s.indexOf(".");
    var intPart = dot < 0 ? s : s.slice(0, dot);
    var frac = dot < 0 ? "000" : s.slice(dot + 1) + "000";
    var digits = intPart + frac.charAt(0);
    if (frac.charAt(1) >= "5") {
      var arr = digits.split("");
      var i = arr.length - 1;
      while (i >= 0) {
        if (arr[i] === "9") { arr[i] = "0"; i -= 1; }
        else { arr[i] = String(Number(arr[i]) + 1); break; }
      }
      if (i < 0) arr.unshift("1");
      digits = arr.join("");
    }
    var cut = digits.length - 1;
    var head = digits.slice(0, cut).replace(/^0+(?=\d)/, "");
    var tail = digits.slice(cut);
    return tail === "0" ? head : head + "." + tail;
  }

  /* Normalised scientific form with a coefficient rounded to tenths:
     1,95·10⁻³ → 2,0·10⁻³; 2,578·10⁻⁵ → 2,6·10⁻⁵; 9,99·10⁻⁵ → 1,0·10⁻⁴.
     The coefficient always keeps one decimal, so a rounded 10.0 is
     renormalised to 1.0 with the next exponent. */
  function sci1(x) {
    var parts = x.toExponential(15).split("e");
    var digits = parts[0].replace(".", "").split("");
    var exp = parseInt(parts[1], 10);
    var keep = Number(digits[0] + digits[1]);
    if (digits[2] >= "5") keep += 1;
    if (keep >= 100) { keep = 10; exp += 1; }
    return comma(String(Math.floor(keep / 10)) + "." + String(keep % 10)) +
      "·10" + sup(exp);
  }

  /* U06: a published result carries at most one decimal. The threshold is
     a readability choice, not a change of model: the unrounded value keeps
     driving every band and verdict. */
  function fmt(x) {
    if (!isFinite(x)) return "—";
    if (x === 0) return "0";
    var sign = x < 0 ? "−" : "";
    var a = Math.abs(x);
    if (a < SCI_SMALL || a >= SCI_LARGE) return sign + sci1(a);
    var plain = plain1(a);
    /* A value just below the large threshold can round up to six digits:
       99 999,99 → 1,0·10⁵ rather than a bare 100000. */
    if (parseFloat(plain) >= SCI_LARGE) return sign + sci1(a);
    return sign + comma(plain);
  }

  /* Percent is a result too, but it reads better in plain form: 0,0913 %
     is «0,1 %», not «9,1·10⁻² %». The scientific fallback is used only when
     the plain tenth would be zero, so a small nonzero share never becomes
     «0,0 %». */
  function pct(x) {
    if (!isFinite(x)) return "—";
    if (x === 0) return "0" + NB + "%";
    var sign = x < 0 ? "−" : "";
    var a = Math.abs(x);
    if (a < SCI_LARGE) {
      var plain = plain1(a);
      if (parseFloat(plain) !== 0) return sign + comma(plain) + NB + "%";
    }
    return sign + sci1(a) + NB + "%";
  }

  /* RRF is a ratio, not a probability: same one-decimal rule, with
     thin-space groups for a readable plain value. */
  function rrf(x) {
    if (!isFinite(x) || x <= 0) return "—";
    if (x >= SCI_LARGE) return sci1(x);
    var s = plain1(x);
    if (parseFloat(s) >= SCI_LARGE) return sci1(x);
    if (parseFloat(s) === 0) return sci1(x);
    var dot = s.indexOf(".");
    var head = dot < 0 ? s : s.slice(0, dot);
    var tail = dot < 0 ? "" : s.slice(dot);
    return head.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + comma(tail);
  }

  /* Exact decimal arithmetic over the decimal values the course actually
     supplies (JSON option values), not over the binary approximations.
     A rational n/d with BigInt keeps 0,1 as 1/10 and 1e-4 as 1/10000, so
     0,1 × 0,1 is exactly 1/100 and 1e-4 / (0,1 × 0,1) is exactly 1e-2.
     There is no tolerance and no snapping: a PFD strictly below 10⁻² is
     SIL 2 even when it is only one representable double below the boundary. */
  var DEC = {
    p1e1: null, p1e2: null, p1e3: null, p1e4: null, p1e5: null
  };

  function decOf(x) {
    if (typeof x !== "number" || !isFinite(x)) return null;
    var s = String(x);
    var sign = 1n;
    if (s.charAt(0) === "-") { sign = -1n; s = s.slice(1); }
    var m = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(s);
    if (!m) return null;
    var frac = m[2] || "";
    var digits = (m[1] + frac).replace(/^0+/, "") || "0";
    var n = BigInt(digits) * sign;
    var exp = (m[3] ? parseInt(m[3], 10) : 0) - frac.length;
    var d = 1n;
    if (exp >= 0) n *= 10n ** BigInt(exp);
    else d = 10n ** BigInt(-exp);
    return { n: n, d: d };
  }

  DEC.p1e1 = decOf(0.1);
  DEC.p1e2 = decOf(0.01);
  DEC.p1e3 = decOf(0.001);
  DEC.p1e4 = decOf(0.0001);
  DEC.p1e5 = decOf(0.00001);

  function decMul(a, b) { return { n: a.n * b.n, d: a.d * b.d }; }

  function decDiv(a, b) {
    if (!a || !b || b.n === 0n) return null;
    var n = a.n * b.d, d = a.d * b.n;
    if (d < 0n) { n = -n; d = -d; }
    return { n: n, d: d };
  }

  function decAdd(a, b) {
    return { n: a.n * b.d + b.n * a.d, d: a.d * b.d };
  }

  function decSub(a, b) {
    return { n: a.n * b.d - b.n * a.d, d: a.d * b.d };
  }

  /* Exact non-negative integer power. The affected widgets only use integer
     powers (the β-factor and binomial models); a non-integer exponent has no
     finite decimal representation and must not be guessed, so it returns
     null and the caller reports that the side of the boundary is unproven. */
  function decPow(a, n) {
    if (!a || !isFinite(n) || n < 0 || Math.floor(n) !== n) return null;
    var r = { n: 1n, d: 1n };
    var base = a;
    while (n > 0) {
      if (n % 2 === 1) r = decMul(r, base);
      base = decMul(base, base);
      n = Math.floor(n / 2);
    }
    return r;
  }

  function decCmp(a, b) {
    var left = a.n * b.d, right = b.n * a.d;
    return left < right ? -1 : left > right ? 1 : 0;
  }

  function bandOfDec(pfd) {
    if (!pfd || pfd.n < 0n) return 0;
    if (decCmp(pfd, DEC.p1e2) >= 0 && decCmp(pfd, DEC.p1e1) < 0) return 1;
    if (decCmp(pfd, DEC.p1e3) >= 0 && decCmp(pfd, DEC.p1e2) < 0) return 2;
    if (decCmp(pfd, DEC.p1e4) >= 0 && decCmp(pfd, DEC.p1e3) < 0) return 3;
    if (decCmp(pfd, DEC.p1e5) >= 0 && decCmp(pfd, DEC.p1e4) < 0) return 4;
    return 0;
  }

  function silRecord(band) {
    if (band === 1) return { sil: "SIL 1", band: 1, note: "PFD 10⁻²…10⁻¹ (нижняя граница включена)" };
    if (band === 2) return { sil: "SIL 2", band: 2, note: "PFD 10⁻³…10⁻² (нижняя граница включена)" };
    if (band === 3) return { sil: "SIL 3", band: 3, note: "PFD 10⁻⁴…10⁻³ (нижняя граница включена)" };
    if (band === 4) return { sil: "SIL 4", band: 4, note: "PFD 10⁻⁵…10⁻⁴ — вне рамок курса" };
    return { sil: "—", band: 0, note: "PFD вне шкалы" };
  }

  function silOfPfd(pfd) {
    var d = decOf(pfd);
    if (!d || d.n < 0n) return { sil: "—", band: 0, note: "PFD вне шкалы" };
    var band = bandOfDec(d);
    if (band) return silRecord(band);
    if (decCmp(d, DEC.p1e1) >= 0) return { sil: "—", band: 0, note: "PFD ≥ 10⁻¹ — ниже SIL 1" };
    return { sil: "—", band: 0, note: "PFD < 10⁻⁵ — за верхней границей шкалы УПБ 4" };
  }

  function silOfDec(pfd) {
    if (!pfd || pfd.n < 0n) return { sil: "—", band: 0, note: "PFD вне шкалы" };
    var band = bandOfDec(pfd);
    if (band) return silRecord(band);
    if (decCmp(pfd, DEC.p1e1) >= 0) return { sil: "—", band: 0, note: "PFD ≥ 10⁻¹ — ниже SIL 1" };
    return { sil: "—", band: 0, note: "PFD < 10⁻⁵ — за верхней границей шкалы УПБ 4" };
  }

  function bandOfPfd(pfd) {
    var d = decOf(pfd);
    return d ? bandOfDec(d) : 0;
  }

  /* ГОСТ Р МЭК 61511-1-2018, п. 11.4.5 и табл. 6 — минимальная HFT для
     заданного УПБ. С 2018 года это ОДНА таблица на всю функцию безопасности,
     без деления на поле и логику и без SFF (тот был только в табл. 5
     редакции 2011, отменённой).

     Режим низкой частоты запросов (п. 3.2.39: не более одного запроса в год)
     — сквозное допущение курса:
       УПБ 1 → 0, УПБ 2 → 0, УПБ 3 → 1, УПБ 4 → 2.
     В редакции 2018 табл. 6 делит УПБ 2 по режиму: низкая частота → 0,
     высокая частота или непрерывный режим → 1. УПБ 1, 3 и 4 — «любой режим»,
     поэтому оговорки не требуют: четвёртый уровень даёт HFT 2 в обоих
     столбцах. Для высокого спроса вызывайте hftByMode(sil, true).

     Четвёртый уровень записан числом, а не отсылкой к МЭК 61508, как было
     в табл. 5 и 6 редакции 2011 (п. 11.4.2–11.4.3): отменённую формулировку
     этот файл не воспроизводит, снятые таблицы стоят в
     reference/normative-register.html, §2 (#hft-tables-2011), и урок 4
     ссылается туда.

     null возвращается только для УПБ вне шкалы 1..4.

     История: до 2026-10-30 здесь лежала таблица редакции 2011
     (УПБ 2 → 1, УПБ 3 → 2) — на две ступени строже действующей, и урок 4
     из-за неё завышал требуемый HFT. */
  var HFT_LOW_DEMAND = { 1: 0, 2: 0, 3: 1, 4: 2 };
  var HFT_HIGH_DEMAND = { 1: 0, 2: 1, 3: 1, 4: 2 };

  function hftByMode(sil, highDemand) {
    var row = highDemand ? HFT_HIGH_DEMAND : HFT_LOW_DEMAND;
    return Object.prototype.hasOwnProperty.call(row, sil) ? row[sil] : null;
  }

  /* Умолчание курса — низкая частота запросов. */
  function hftField(sil) {
    return hftByMode(sil, false);
  }

  /* ------------------------------------------------------------
     The claim boundary of a numerical trainer.

     `opts`:
       status     "numeric-pass" | "numeric-fail" | "inconclusive"
                  | "requirement" | "diagnostic" | "calculated"
       mode       free text; the course default is low demand
       units      free text
       checked    array of what the widget really computed
       unchecked  array of what it did not prove
       conclusion one or two sentences, no «SIL достигнут»
     ------------------------------------------------------------ */
  var SCOPE_MODE = "низкая частота запросов: не более одного запроса в год (п. 3.2.39)";
  var SCOPE_UNITS = "PFDavg\u00a0— безразмерная вероятность; RRF\u00a0— безразмерное отношение; λ\u00a0— 1/ч; TI, TL\u00a0— ч";

  function scope(root, opts) {
    if (!root || typeof document === "undefined") return null;
    opts = opts || {};
    var box = null;
    var existing = root.children || [];
    for (var ci = 0; ci < existing.length; ci++) {
      var cls = String(existing[ci].className || "");
      if (cls.split(/\s+/).indexOf("widget-scope") >= 0) { box = existing[ci]; break; }
    }
    if (!box) {
      box = document.createElement("div");
      root.appendChild(box);
    } else {
      box.innerHTML = "";
    }
    box.className = "widget-scope lopa-formula-wrap";
    box.setAttribute("data-scope-status", opts.status || "inconclusive");

    function row(label, text) {
      var p = document.createElement("p");
      p.className = "scope-line lopa-note-block";
      var strong = document.createElement("strong");
      strong.textContent = label + " ";
      p.appendChild(strong);
      var value = document.createElement("span");
      value.textContent = text || "—";
      p.appendChild(value);
      box.appendChild(p);
      return p;
    }

    row("Режим:", opts.mode || SCOPE_MODE);
    row("Единицы:", opts.units || SCOPE_UNITS);
    row("Проверено:", (opts.checked || []).join("; "));
    row("Не проверено:", (opts.unchecked || []).join("; "));

    var verdict = document.createElement("p");
    verdict.className = "scope-verdict lopa-note-block";
    verdict.textContent = opts.conclusion || "";
    box.appendChild(verdict);

    return box;
  }

  /* Restore the inputs the page opened with. Widgets listen to change/input
     on their own selects and checkboxes, so restoring the DOM values and
     dispatching the same events is enough: no second copy of widget state,
     no silent "reset" that only repaints the labels. */
  function installReset(root) {
    if (!root || typeof document === "undefined") return null;
    var existing = root.children || [];
    for (var bi = 0; bi < existing.length; bi++) {
      var cls = String(existing[bi].className || "");
      if (cls.split(/\s+/).indexOf("widget-reset") >= 0) return existing[bi];
    }
    var controls = [];
    (function walk(node) {
      var tag = String(node.tag || node.tagName || "").toLowerCase();
      if (tag === "select" || tag === "input") {
        controls.push({ el: node, value: node.value, checked: node.checked });
      }
      var kids = node.children || [];
      for (var i = 0; i < kids.length; i++) walk(kids[i]);
    })(root);

    var button = document.createElement("button");
    button.type = "button";
    button.className = "btn widget-reset";
    button.textContent = "Вернуть исходный пример";
    button.addEventListener("click", function () {
      controls.forEach(function (c) {
        var isCheck = String(c.el.type || "").toLowerCase() === "checkbox";
        if (isCheck) c.el.checked = c.checked;
        else c.el.value = c.value;
        if (!c.el.dispatchEvent) return;
        c.el.dispatchEvent(new Event("input", { bubbles: true }));
        c.el.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
    root.appendChild(button);
    return button;
  }

  global.SilFmt = {
    fmt: fmt, pct: pct, rrf: rrf, bandOfPfd: bandOfPfd, silOfPfd: silOfPfd,
    bandOfDec: bandOfDec, silOfDec: silOfDec, decOf: decOf,
    decMul: decMul, decDiv: decDiv, decAdd: decAdd, decSub: decSub,
    decPow: decPow, decCmp: decCmp,
    hftField: hftField, hftByMode: hftByMode, sup: sup,
    scope: scope, installReset: installReset
  };
})(window);
