/* ============================================================
   SIL Course — shared number and SIL-band helpers
   Loaded before quiz/lopa/pfd/moon widgets. Exposes window.SilFmt:
     fmt(x)        probability/lambda: 2,0·10⁻² | 0,001 | 0,1 | 1
     rrf(x)        risk reduction factor: integer, thin-space groups: 8 300
     silOf(rrf)    { sil, note } — RRF ≥ 10ⁿ ⇒ SIL n (project rounding up)
     bandOf(rrf)   numeric SIL of a required/achieved RRF (0 when < 10)
     hftField(sil)     min HFT, ГОСТ Р МЭК 61511-1-2018 табл. 6, low demand
     hftByMode(sil,hi) same table, high-demand/continuous column when hi
   Formatting contract: decimal comma, superscript exponents, no
   locale-dependent toLocaleString anywhere in the course.
   ============================================================ */
(function (global) {
  "use strict";

  var SUP = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
              "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };

  function sup(n) {
    return String(n).split("").map(function (c) { return SUP[c] || c; }).join("");
  }

  function comma(s) { return s.replace(".", ","); }

  /* 2 significant digits, exponent form below 0,1: 1,095e-2 → 1,1·10⁻² */
  function fmt(x) {
    if (!isFinite(x)) return "—";
    if (x === 0) return "0";
    var sign = x < 0 ? "−" : "";
    x = Math.abs(x);
    if (x >= 0.1) {
      var plain = x.toFixed(x >= 10 ? 1 : 3).replace(/0+$/, "").replace(/\.$/, "");
      return sign + comma(plain);
    }
    var e = Math.floor(Math.log10(x));
    var m = x / Math.pow(10, e);
    var ms = m.toFixed(1).replace(/\.0$/, "");
    if (ms === "10") { ms = "1"; e += 1; }
    return sign + comma(ms) + "·10" + sup(e);
  }

  /* integer with thin-space thousand groups: 8272 → 8 300 (rounded to 2 s.f.? no: plain rounding) */
  function rrf(x) {
    if (!isFinite(x) || x <= 0) return "—";
    var n = Math.round(x);
    if (n >= 100000) {
      var e = Math.floor(Math.log10(n));
      return comma((n / Math.pow(10, e)).toFixed(1)) + "·10" + sup(e);
    }
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  /* RRF band. Boundaries read upward: RRF ≥ 100 ⇒ SIL 2 — project practice,
     the strict IEC table needs PFD < 10⁻² for SIL 2; the lesson says to fix
     the choice in the safety justification. */
  function silOf(r) {
    if (r >= 10000) return { sil: "SIL 4", note: "RRF ≥ 10 000 — вне рамок курса" };
    if (r >= 1000) return { sil: "SIL 3", note: "RRF 1 000–10 000" };
    if (r >= 100) return { sil: "SIL 2", note: "RRF 100–1 000" };
    if (r >= 10) return { sil: "SIL 1", note: "RRF 10–100" };
    return { sil: "—", note: "RRF < 10 — SIL не назначается" };
  }

  function bandOf(r) {
    if (r >= 10000) return 4;
    if (r >= 1000) return 3;
    if (r >= 100) return 2;
    if (r >= 10) return 1;
    return 0;
  }

  /* ГОСТ Р МЭК 61511-1-2018, п. 11.4.5 и табл. 6 — минимальная HFT для
     заданного УПБ. С 2018 года это ОДНА таблица на всю функцию безопасности,
     без деления на поле и логику и без SFF (тот был только в табл. 5
     редакции 2011, отменённой).

     Режим низкой частоты запросов (п. 3.2.39: не более одного запроса в год)
     — сквозное допущение курса:
       УПБ 1 → 0, УПБ 2 → 0, УПБ 3 → 1, УПБ 4 → 2.
     В редакции 2018 табл. 6 делит УПБ 2 по режиму: низкая частота → 0,
     высокая частота или непрерывный режим → 1. УПБ 1 и 3 — «любой режим»,
     поэтому оговорки не требуют. Для высокого спроса вызывайте
     hftByMode(sil, true). УПБ 4 — специальные требования МЭК 61508, поэтому
     null (не 2: подставлять значение из чужой рамки нельзя).

     История: до 2026-10-30 здесь лежала таблица редакции 2011
     (УПБ 2 → 1, УПБ 3 → 2) — на две ступени строже действующей, и урок 4
     из-за неё завышал требуемый HFT. */
  var HFT_LOW_DEMAND = { 1: 0, 2: 0, 3: 1 };
  var HFT_HIGH_DEMAND = { 1: 0, 2: 1, 3: 1 };

  function hftByMode(sil, highDemand) {
    var row = highDemand ? HFT_HIGH_DEMAND : HFT_LOW_DEMAND;
    return Object.prototype.hasOwnProperty.call(row, sil) ? row[sil] : null;
  }

  /* Умолчание курса — низкая частота запросов. */
  function hftField(sil) {
    return hftByMode(sil, false);
  }

  global.SilFmt = { fmt: fmt, rrf: rrf, silOf: silOf, bandOf: bandOf,
                  hftField: hftField, hftByMode: hftByMode, sup: sup };
})(window);
