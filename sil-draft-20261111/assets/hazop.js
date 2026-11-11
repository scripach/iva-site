/* ============================================================
   SIL Course — HAZOP worksheet row judged for LOPA (lesson 13)
   Root div has class "hazop" only; layout reuses the inner .lopa-*
   class names from course.css (same convention as pfd.js, lopa.js,
   moon.js, shared.js, assemble.js, bypass.js, dossier.js, module.js,
   tolerable.js, target.js — no CSS duplication).

   Markup:
     <div class="hazop">
       <script type="application/json">
       {
         "title": "...", "instruction": "...",
         "consequenceCell": { "label": "...", "options": [ { "v": "consequence",
             "label": "...", "selected": true }, ... ] },
         "causeFrequency": { "label": "...", "options": [ ... ] },
         "causes":         { "label": "...", "options": [ ... ] },
         "safeguards":     { "label": "...", "options": [ ... ] }
       }
       </script>
     </div>

   Model — what the widget checks, and on whose authority.

   All clause numbers below are GOST R IEC 61511-3-2018, checked against the
   standard's text, not from memory:

     G.2.3  the hazardous event is described down to the worst credible
            consequence ASSUMING NO PROTECTION; the standard's own example is
            "above 1,5·MAWP → vessel damage and release within 5 min", while
            the controller failure that produced it is the CAUSE (G.2.4);
     G.2.4  the cause frequency is estimated WITHOUT ANY protection layer;
             in the worksheet record of the Annex G procedure the event
             frequency is the HIGHEST of the listed causes, one number for
             column 4. That is a rule of this calibrated procedure, not a
             general law of combining frequencies: a quantitative model adds
             distinct realizations (mutual exclusion does not prevent that;
             overlaps need a correction), and Annex G does not forbid it;
             a team that finds no credible cause writes the closed record;
     F.13.4 the standard's example follows each cause separately, so a LOPA
             scenario is a cause × event pair; the worksheet record does not
             replace that list;
     табл. F.1 — the six pairs HAZOP owes the layer analysis.

   Six outcomes, all reachable (smoke test drives every one):
     ready    — the row can be handed over; the G record is max(causes), the quantitative record is the sum;
     blocked  — a cause sits in the consequence cell;
     blocked  — a deviation sits in the consequence cell;
     closed   — the team closed the deviation as not credible (a record of the
                standard, not a blank cell);
     blocked  — an IPL was already subtracted inside the frequency;
     blocked  — no frequency at all (a band is not a number).

   Why a diagnostic and not a calculator: lessons 2 and 12 already compute PFD
   and the closure. The failure that ruins real projects happens one step
   earlier — the row cannot be used at all, and the reason is never arithmetic.
   The numbers printed are what LOPA will receive, so each defect shows its
   price: 0,1 /год gives RRF 4 000 (УПБ 3), while the same row with one layer
   folded into the frequency gives RRF 400 (УПБ 2) — a whole band softer,
   silently, for a row that still looks finished.
   ============================================================ */
(function () {
  "use strict";

  var NB = "\u00a0";

  /* Частота каждой из двух причин сценария — 0,1 /год, по данным объекта
     (табл. G.3: MTBF полного контура управления 10 лет; в примере F.13.4
     прекращение подачи охлаждающей воды принято консервативно как 1 раз
     в 10 лет). */
  var F_CAUSE = 0.1;

  /* PFD слоя, который нельзя вычитать внутри частоты: G.2.4 требует оценивать
     частоту причины без учёта НСЗ, иначе АСЗ зачтёт тот же слой второй раз. */
  var IPL_PFD = 0.1;

  /* Доля сценария в бюджете класса — из урока 12: 1·10⁻⁴ /год на четыре
     сценария. Виджет не пересчитывает класс: он показывает, что получает АСЗ.
     Значение по умолчанию оставлено для страниц без реестра; если в JSON есть
     classFrequency и m, доля считается из них, а не берётся из подписи. */
  var F_SCENARIO = 2.5e-5;

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

  /* Две значащие цифры с ручным округлением полувверх: по U06 коэффициент
     не точнее десятых. Внутренние расчёты идут с полной точностью; это
     только подпись результата. */
  function sci(x) {
    if (!isFinite(x) || x === 0) return "0";
    var sign = x < 0 ? "−" : "";
    x = Math.abs(x);
    var parts = x.toExponential(15).split("e");
    var digits = parts[0].replace(".", "").split("");
    var exp = parseInt(parts[1], 10);
    if (digits[2] >= "5") {
      var i = 1;
      while (i >= 0) {
        if (digits[i] === "9") { digits[i] = "0"; i -= 1; }
        else { digits[i] = String(Number(digits[i]) + 1); break; }
      }
      if (i < 0) { digits.unshift("1"); digits.length = 2; exp += 1; }
    }
    var mant = digits.slice(0, 2).join("").replace(/0+$/, "");
    if (mant.length === 0) mant = "0";
    if (mant.length > 1) mant = mant[0] + "," + mant.slice(1);
    if (x >= 0.1) {
      var plain = Number(mant.replace(",", ".") + "e" + exp);
      if (plain >= 0.1 && plain < 1000) {
        return sign + String(Number(plain.toPrecision(3))).replace(".", ",");
      }
    }
    return sign + mant + "·10" + F.sup(exp);
  }

  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }

  /* Требование к функции из частоты и доли сценария. Те же число и полоса,
     что в уроке 12; здесь они печатаются как следствие строки HAZOP. */
  function requirement(fBefore, fScenario) {
    var pfd = fScenario / fBefore;
    return { pfd: pfd, rrf: 1 / pfd, band: F.silOfPfd(pfd) };
  }

  /* Полоса по RRF: точный десятичный PFD = 1/RRF (задача 21), чтобы
     значение ровно на границе не переезжало в соседнюю полосу. */
  function bandName(rrf) {
    var dec = F.decDiv(F.decOf(1), F.decOf(rrf));
    var rec = dec ? F.silOfDec(dec) : { sil: "вне шкалы" };
    return rec.sil.replace("SIL", "УПБ");
  }

  function render(root) {
    var cfg = jsonOf(root);
    if (!cfg) return;

    root.innerHTML = "";
    root.classList.add("widget");

    /* Доля сценария приходит из реестра: f_класс / m. Подпись причины на неё
       не влияет — перефразирование меняет текст, но не m и не ID. */
    var fScenario = (cfg.classFrequency && cfg.m)
      ? cfg.classFrequency / cfg.m
      : F_SCENARIO;
    if (cfg.m) root.setAttribute("data-m", String(cfg.m));
    if (cfg.scenarioId) root.setAttribute("data-scenario", cfg.scenarioId);

    if (cfg.title) root.appendChild(el("p", "widget-title", cfg.title));
    if (cfg.instruction) root.appendChild(el("p", "instruction", cfg.instruction));
    if (cfg.scenarioId) {
      root.appendChild(el("p", "instruction lopa-registry-meta",
        "Сценарий " + cfg.scenarioId +
        (cfg.classId ? " · класс " + cfg.classId : "") +
        (cfg.registry ? " · реестр " + cfg.registry : "") +
        (cfg.m ? " · m = " + cfg.m : "") +
        " · класс " + sci(fScenario) + NB + "/год на сценарий"));
    }

    var grid = el("div", "lopa-grid");
    var left = el("div");
    var right = el("div");
    grid.appendChild(left);
    grid.appendChild(right);
    root.appendChild(grid);

    var pickedCauses = picked(cfg.causes.options);
    var state = {
      consequenceCell: picked(cfg.consequenceCell.options).v,
      causeFrequency: picked(cfg.causeFrequency.options).v,
      causes: parseFloat(pickedCauses.v),
      causeMax: pickedCauses.max || F_CAUSE,
      causeSum: pickedCauses.sum || F_CAUSE * parseFloat(pickedCauses.v),
      causeAddends: pickedCauses.addends || "частоты причин",
      safeguards: picked(cfg.safeguards.options).v
    };

    function select(cfgObj, value, onPick) {
      var f = el("label", "lopa-field");
      f.appendChild(el("span", "lopa-label", cfgObj.label));
      var s = el("select", "lopa-select");
      cfgObj.options.forEach(function (o) {
        var v = String(o.v);
        var op = el("option", null, o.label !== undefined ? o.label : v);
        op.value = v;
        if (v === String(value)) op.selected = true;
        s.appendChild(op);
      });
      s.addEventListener("change", function () { onPick(s.value); recalc(); });
      f.appendChild(s);
      left.appendChild(f);
      return s;
    }

    select(cfg.consequenceCell, state.consequenceCell, function (v) { state.consequenceCell = v; });
    select(cfg.causeFrequency, state.causeFrequency, function (v) { state.causeFrequency = v; });
    select(cfg.causes, state.causes, function (v) {
      state.causes = parseFloat(v);
      var o = cfg.causes.options.filter(function (x) { return String(x.v) === String(v); })[0];
      state.causeMax = o && o.max ? o.max : F_CAUSE;
      state.causeSum = o && o.sum ? o.sum : F_CAUSE * state.causes;
      state.causeAddends = o && o.addends ? o.addends : "частоты причин";
    });
    select(cfg.safeguards, state.safeguards, function (v) { state.safeguards = v; });

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

    /* Шесть пар табл. F.1. Состояние каждой пары выводится из формы, а не
       задаётся отдельно: строка «не готова» обязана назвать конкретную пустую
       или испорченную графу, иначе читатель не знает, что писать в таблицу. */
    function pairs() {
      var realConsequence = state.consequenceCell === "consequence";
      var hasFrequency = state.causeFrequency === "data";
      var closed = state.causeFrequency === "none-recorded";
      var doubleCounted = state.safeguards === "inside";
      var cleanFrequency = hasFrequency && !doubleCounted;

      var freqCell, freqWhy;
      if (closed) { freqCell = "не требуется"; freqWhy = "команда закрыла отклонение"; }
      else if (!hasFrequency) { freqCell = "пусто"; freqWhy = "числа нет, полоса числом не является"; }
      else if (doubleCounted) { freqCell = "искажена"; freqWhy = "слой защиты уже вычтен из частоты"; }
      else { freqCell = "есть"; freqWhy = null; }

      var reductionCell, reductionWhy;
      if (!realConsequence) { reductionCell = "пусто"; reductionWhy = "без последствия и тяжести не считается"; }
      else if (closed) { reductionCell = "не требуется"; reductionWhy = null; }
      else if (!cleanFrequency) { reductionCell = "пусто"; reductionWhy = "считается после первых пяти"; }
      else { reductionCell = "есть"; reductionWhy = null; }

      return [
        ["Влияние события", realConsequence ? "есть" : "пусто",
          realConsequence ? null : "в графе не последствие"],
        ["Уровень тяжести", realConsequence ? "есть" : "пусто",
          realConsequence ? null : "без последствия M/S/E не назначается"],
        ["Исходная причина", state.consequenceCell === "cause" ? "в чужой графе" : "есть",
          state.consequenceCell === "cause" ? "причина записана как последствие" : null],
        ["Вероятность причины", freqCell, freqWhy],
        ["Слои защиты", doubleCounted ? "в частоте" : "есть",
          doubleCounted ? "меры защиты не в своей графе" : null],
        ["Требуемое ослабление", reductionCell, reductionWhy]
      ];
    }

    function recalc() {
      out.innerHTML = "";

      var hasFrequency = state.causeFrequency === "data";
      var closed = state.causeFrequency === "none-recorded";
      var doubleCounted = state.safeguards === "inside";
      var cleanFrequency = hasFrequency && !doubleCounted;
      var used = doubleCounted ? state.causeMax * IPL_PFD : state.causeMax;
      var sum = state.causeSum;

      var freqText, freqNote;
      if (closed) {
        freqText = "—";
        freqNote = "команда закрыла отклонение: вероятной причины нет";
      } else if (!hasFrequency) {
        freqText = "—";
        freqNote = "полоса «средняя» числом не является: примечание 1 к табл. F.3 " +
          "запрещает брать её для конкретной оценки";
      } else if (doubleCounted) {
        freqText = sci(used);
        freqNote = fmt(state.causeMax) + " × " + fmt(IPL_PFD) + " — слой защиты вычтен в частоте";
      } else {
        freqText = sci(used);
        freqNote = state.causes > 1
          ? "наибольшая из " + state.causes + " причин: одно число для графы 4 по G.2.4"
          : "одна причина; по табл. G.3 MTBF контура управления 10 лет";
      }
      value("Запись строки по G.2.4, 1 /год", freqText, freqNote);

      if (hasFrequency && state.causes > 1) {
        var qreq = requirement(sum, fScenario);
        value("Количественная сумма реализаций, 1 /год", sci(sum) + NB + "/год",
          state.causeAddends + ": складываются частоты отдельных реализаций; при общем " +
          "эпизоде нужна поправка на двойной счёт. Это вход другой процедуры, а не замена " +
          "записи G: при той же доле " + sci(fScenario) + NB + "/год сумма требует RRF " +
          fmtRRF(qreq.rrf) + ".");
      }

      /* ───── что видит АСЗ: шесть пар табл. F.1 ───── */
      var sep = el("div", "lopa-formula-wrap");
      sep.appendChild(el("span", "lopa-formula",
        "——— табл. F.1: что HAZOP обязан передать в анализ слоёв ———"));
      out.appendChild(sep);

      pairs().forEach(function (p) {
        var row = el("div", "lopa-note-block");
        row.textContent = p[0] + ": " + p[1] + (p[2] ? " — " + p[2] : "");
        out.appendChild(row);
      });

      /* Требование к функции печатается только для годной строки: иначе
         число выглядит как результат, хотя вход в него недостоверен. */
      if (cleanFrequency && state.consequenceCell === "consequence") {
        var req = requirement(used, fScenario);
        value("Что получит АСЗ", "PFD ≤ " + sci(req.pfd),
          "доля сценария " + sci(fScenario) + NB + "/год из реестра делится на " +
          sci(used) + NB + "/год; RRF ≈ " + fmtRRF(req.rrf) + " — " + bandName(req.rrf));
      }

      if (cleanFrequency && state.consequenceCell === "consequence" && state.causes > 1) {
        var q = requirement(sum, fScenario);
        value("Если считать количественно", "PFD ≤ " + sci(q.pfd),
          "сумма " + sci(sum) + NB + "/год и та же доля " + sci(fScenario) + NB +
          "/год дают RRF ≈ " + fmtRRF(q.rrf) + " — " + bandName(q.rrf) +
          ". Это другая процедура, не замена записи G.");
      }

      /* Цена дефекта: зачтённый в частоте слой делает требование мягче
         на целую полосу, и по документу этого не видно. */
      if (doubleCounted) {
        var soft = requirement(used, fScenario);
        value("Чем это обернётся", "PFD ≤ " + sci(soft.pfd),
          "RRF " + fmtRRF(soft.rrf) + ", " + bandName(soft.rrf) + " вместо " +
          bandName(requirement(state.causeMax, fScenario).rrf) + " — на целую полосу мягче");
      }

      /* ───── вердикт ─────
         Порядок проверок: дефект в графе последствия старше всего остального —
         без последствия остальные графы не имеют смысла. Закрытое отклонение
         проверяется раньше частоты: у него частоты и не должно быть. */
      var verdict = el("div", "lopa-note-block");

      if (state.consequenceCell === "cause") {
        verdict.textContent = "Строка не готова: в графе «Последствие» стоит причина. " +
          "До чего доходит процесс, если отказ случится, не записано, поэтому уровень тяжести " +
          "M/S/E назначить нельзя, а без него нет требуемого ослабления. Причину переносят " +
          "в свою графу, последствие дописывают заново — при допущении, что защит нет.";
        verdict.setAttribute("data-verdict", "blocked-cause");
        verdict.className += " lopa-sil";
      } else if (state.consequenceCell === "deviation") {
        verdict.textContent = "Строка не готова: в графе «Последствие» стоит отклонение — " +
          "то, с чего начался разбор, а не то, чем он кончается. Отклонение не описывает " +
          "ни одного последствия, поэтому ни тяжесть, ни допустимая частота для него " +
          "не определяются.";
        verdict.setAttribute("data-verdict", "blocked-deviation");
        verdict.className += " lopa-sil";
      } else if (closed) {
        verdict.textContent = "Отклонение закрыто командой: «нет никакой вероятной исходной " +
          "причины» с изложением, почему сценарий невозможен. Это запись стандарта, а не " +
          "пробел: в форму АСЗ строка не идёт, и пустая частота здесь ничего не ломает. " +
          "Без такого изложения та же пустая графа читалась бы как незаконченная работа.";
        verdict.setAttribute("data-verdict", "closed");
        verdict.className += " lopa-sil";
      } else if (doubleCounted) {
        verdict.textContent = "Строка не готова: частота уже умножена на PFD слоя защиты. " +
          "G.2.4 требует оценивать частоту причины без учёта НСЗ: иначе АСЗ зачтёт этот же " +
          "слой второй раз и требование к SIF выйдет в " + fmt(1 / IPL_PFD) + " раз мягче. " +
          "Меры защиты остаются в своей графе и в частоте не участвуют.";
        verdict.setAttribute("data-verdict", "blocked-double-count");
        verdict.className += " lopa-sil";
      } else if (!hasFrequency) {
        verdict.textContent = "Строка не готова: нет частоты причины. Пять пар из шести " +
          "табл. F.1 заполнены, шестая пуста; АСЗ не может ни умножить, ни сравнить. " +
          "Полосы табл. F.3 этого не заменяют: примечание 1 запрещает брать их " +
          "для конкретной оценки — число должно опираться на данные объекта.";
        verdict.setAttribute("data-verdict", "blocked-no-frequency");
        verdict.className += " lopa-sil";
      } else {
        verdict.setAttribute("data-verdict", "ready");
        verdict.textContent = "Строка готова: все шесть пар табл. F.1 заполнены, частота " +
          "оценена без учёта слоёв; в записи G из " + state.causes + " " +
          plural(state.causes, "причины", "причин", "причин") +
          " взята наибольшая. В LOPA каждая причина даёт свой сценарий, поэтому m берут " +
          "из реестра. Критерий класса: " + sci(fScenario) + NB + "/год / " + sci(used) +
          NB + "/год = PFD " + sci(requirement(used, fScenario).pfd) + ".";
        verdict.className += " lopa-sil";
      }
      out.appendChild(verdict);

      var note = el("div", "lopa-formula-wrap");
      note.appendChild(el("span", "lopa-formula",
        "f_запись = max(f_причин) по G.2.4;  f_колич. = Σ f_реализаций;  PFD = f_сц / (f_иниц × Π PFD(НСЗ))"));
      out.appendChild(note);
    }

    recalc();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".hazop").forEach(render);
  });
})();
