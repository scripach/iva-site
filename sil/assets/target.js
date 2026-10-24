/* ============================================================
   SIL Course — target frequency and closure of the criterion (lesson 12)
   Root div has class "target" only; layout reuses the inner .lopa-*
   class names from course.css (same convention as pfd.js, lopa.js,
   moon.js, shared.js, assemble.js, bypass.js, dossier.js, module.js,
   tolerable.js — no CSS duplication, other widget roots untouched).

   Markup:
     <div class="target">
       <script type="application/json">
       {
         "title": "...", "instruction": "...",
         "source": { "label": "Откуда взята целевая частота", "options": [
             { "v": 1e-4, "label": "1·10⁻⁴ /год — пример прил. B", "selected": true },
             { "v": 1e-5, "label": "1·10⁻⁵ /год — критерий компании" } ] },
         "people": { "label": "Человек в зоне поражения", "options": [ ... ] },
         "fatal":  { "label": "Погибают в одном событии",  "options": [ ... ] },
         "scenarios": { "label": "Сценариев этого класса",  "options": [ ... ] },
         "initiator": { "label": "Частота инициатора",      "options": [ ... ] },
         "ipls": [ { "label": "Оператор по сигнализации", "pfd": 0.1, "checked": true } ]
       }
       </script>
     </div>

   Model. The target frequency belongs to a CLASS of consequences, not to
   one SIF. Splitting the class among m scenarios assigns responsibility;
   it does not reduce the total risk, therefore the closure below is
   independent of m — that cancellation is the lesson, not an accident.

     f_сц   = f_класс / m                                  [1/год]
     f_до   = f_иниц × Π PFD(IPL)                          [1/год]
     PFD    = f_сц / f_до        (what the SIF has to provide)
     RRF    = 1 / PFD

   Closure (замыкание): does the chosen class keep the individual risk
   within R_д? A class frequency f kills k of N people per event, so

     R_инд = f_класс · k / N         must be ≤ R_д
     f_max = R_д · N / k             the largest class frequency allowed

   R_д = 73/20/3 = 1,2167 ppm — the worked value of lesson 11 (нефтегазодобыча,
   средняя степень, отраслевой фон, новый объект, персонал). The widget
   fixes it rather than offering it, because lesson 11 already builds it.

   Why this widget exists: lesson 11 used to multiply R_д by the number of
   people and call the product a frequency. That product is deaths per
   year; the frequency is deaths ÷ killed-per-event. With k = N the missing
   divisor hid inside the multiplication. So the closure here divides by k
   explicitly and the widget prints f_max next to the chosen f_класс — a
   number above f_max fails, whatever SIL the SIF achieves.
   ============================================================ */
(function () {
  "use strict";

  var NB = "\u00a0";

  /* Rд для персонала: 73 / 20 = 3,65 ppm, ÷3 для нового объекта = 1,2167 ppm.
     Урок 11, §5. Виджет не предлагает менять фон: он про другую половину
     задачи — как с этим критерием обращаться. */
  var R_D = 73 / 20 / 3;
  var R_D_YEAR = R_D * 1e-6;

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

  /* Три значащие с ручным округлением полувверх — та же функция, что
     в tolerable.js: критерий делят дальше, и двух значащих не хватает,
     чтобы шаги сходились с печатью. */
  function sci(x) {
    if (!isFinite(x) || x === 0) return "0";
    var sign = x < 0 ? "−" : "";
    x = Math.abs(x);
    var parts = x.toExponential(15).split("e");
    var digits = parts[0].replace(".", "").split("");
    var exp = parseInt(parts[1], 10);
    if (digits[3] >= "5") {
      var i = 2;
      while (i >= 0) {
        if (digits[i] === "9") { digits[i] = "0"; i -= 1; }
        else { digits[i] = String(Number(digits[i]) + 1); break; }
      }
      if (i < 0) { digits.unshift("1"); digits.length = 3; exp += 1; }
    }
    var mant = digits.slice(0, 3).join("").replace(/0+$/, "");
    if (mant.length === 0) mant = "0";
    if (mant.length > 1) mant = mant[0] + "," + mant.slice(1);
    if (x >= 0.01) {
      var plain = Number(mant.replace(",", ".") + "e" + exp);
      if (plain >= 0.01 && plain < 1000) {
        return sign + String(Number(plain.toPrecision(6))).replace(".", ",");
      }
    }
    return sign + mant + "·10" + F.sup(exp);
  }

  /* Пять значащих для подписи: печатается округлённое, а считается от
     полной точности, и читатель должен суметь воспроизвести строку. */
  function factor(x) {
    if (!isFinite(x) || x === 0) return "0";
    var sign = x < 0 ? "−" : "";
    x = Math.abs(x);
    var parts = Number(x.toPrecision(12)).toExponential(5).split("e");
    var m = Number(Number(parts[0]).toPrecision(5)).toString()
      .replace(".", ",").replace(/(,\d*?)0+$/, "$1").replace(/,$/, "");
    return sign + m + "·10" + F.sup(parseInt(parts[1], 10));
  }

  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
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
      source: parseFloat(picked(cfg.source.options).v),
      people: parseFloat(picked(cfg.people.options).v),
      fatal: parseFloat(picked(cfg.fatal.options).v),
      scenarios: parseFloat(picked(cfg.scenarios.options).v),
      initiator: parseFloat(picked(cfg.initiator.options).v),
      ipls: (cfg.ipls || []).map(function (x) { return x.checked === true; })
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

    select(cfg.source, state.source, function (v) { state.source = parseFloat(v); });
    select(cfg.people, state.people, function (v) { state.people = parseFloat(v); });
    select(cfg.fatal, state.fatal, function (v) { state.fatal = parseFloat(v); });
    select(cfg.scenarios, state.scenarios, function (v) { state.scenarios = parseFloat(v); });
    select(cfg.initiator, state.initiator, function (v) { state.initiator = parseFloat(v); });

    /* Слои, уже стоящие до SIF. Галочка, а не select: их можно включать
       по одному и видеть, как требование к функции падает. */
    if (cfg.ipls && cfg.ipls.length) {
      var box = el("div", "lopa-field");
      box.appendChild(el("span", "lopa-label", "Слои защиты до SIF"));
      var list = el("div", "lopa-ipls");
      cfg.ipls.forEach(function (ipl, i) {
        var lab = el("label", "lopa-ipl");
        var cb = el("input");
        cb.type = "checkbox";
        cb.checked = state.ipls[i];
        cb.addEventListener("change", function () {
          state.ipls[i] = cb.checked;
          recalc();
        });
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(
          ipl.label + " — PFD " + fmt(ipl.pfd)));
        list.appendChild(lab);
      });
      box.appendChild(list);
      left.appendChild(box);
    }

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

      /* k не может превышать N: из трёх человек в зоне не погибают пятеро. */
      var fatal = Math.min(state.fatal, state.people);

      value("Критерий на человека, Rд", sci(R_D) + NB + "ppm",
        "73 / 20 / 3 — разбор урока 11, §5");

      value("Целевая частота класса", sci(state.source) + NB + "/год",
        state.source === 1e-4
          ? "пример прил. B ГОСТ Р МЭК 61511-3; нормативом не является"
          : "корпоративный критерий: строже примера в десять раз");

      /* Деление на сценарии распределяет ответственность, а не снижает
         риск: сумма частот по сценариям остаётся равна классу. Поэтому
         в замыкании ниже m сокращается — и это стоит показать словами. */
      var fClass = state.source;
      var fSc = fClass / state.scenarios;
      value("На один сценарий", sci(fSc) + NB + "/год",
        "класс " + state.scenarios + " " + plural(state.scenarios, "сценарий", "сценария", "сценариев") +
        " делится поровну; сумма по сценариям остаётся " + sci(fClass));

      var before = state.initiator;
      var applied = [];
      (cfg.ipls || []).forEach(function (ipl, i) {
        if (state.ipls[i]) { before *= ipl.pfd; applied.push(ipl); }
      });

      if (applied.length) {
        value("Частота до SIF", sci(before) + NB + "/год",
          fmt(state.initiator) + " × " + applied.map(function (x) { return fmt(x.pfd); }).join(" × ") +
          " — инициатор и " + applied.length + " " +
          plural(applied.length, "слой", "слоя", "слоёв") + " защиты");
      } else {
        value("Частота до SIF", sci(before) + NB + "/год",
          "слоёв не зачтено: только инициатор " + fmt(state.initiator) + NB + "/год");
      }

      var pfd = fSc / before;
      var rrf = before / fSc;

      /* PFD ≥ 1 значит, что слои до SIF уже укладываются в целевую частоту:
         функция не требуется, и печатать «PFD ≤ 1» нельзя — это читается
         как требование, а не как его отсутствие. */
      /* Допуск: 1·10⁻⁴ / (0,1 × 0,1 × 0,01) даёт 1,0000000000000002, и
         строгое < 1 объявило бы функцию нужной ровно там, где она не
         требуется. PFD — величина порядка единицы, 1e−9 относительной
         погрешности на порядки меньше любого физического различия. */
      var needed = pfd < 1 - 1e-9;
      value("Что должна дать SIF", needed ? "PFD ≤ " + sci(pfd) : "не требуется",
        needed
          ? "делим частоту сценария на частоту до SIF: " + sci(fSc) + " / " + sci(before)
          : "частота до SIF " + sci(before) + " ниже частоты сценария " + sci(fSc));

      var band = needed ? F.silOf(rrf) : { sil: "—", note: "слои до SIF уже дают нужную частоту" };
      value("Требуемый уровень", band.sil,
        needed ? "RRF ≈ " + fmtRRF(rrf) + " — " + band.note : band.note);

      /* ───── Замыкание критерия ─────
         Класс f даёт f·k/N индивидуального риска: событий в год, умноженных
         на погибших в событии, делённых на число людей, которые этому риску
         подвержены. Сравниваем с Rд. */
      var sep = el("div", "lopa-formula-wrap");
      sep.appendChild(el("span", "lopa-formula",
        "——— замыкание: не нарушает ли выбранная частота критерий на человека ———"));
      out.appendChild(sep);

      var indiv = fClass * fatal / state.people;
      var fMax = R_D_YEAR * state.people / fatal;
      var ok = indiv <= R_D_YEAR;

      var riskLine = value("Индивидуальный риск от класса", sci(indiv) + NB + "/год",
        factor(fClass) + " × " + fatal + " " + plural(fatal, "погибший", "погибших", "погибших") +
        " / " + state.people + " " + plural(state.people, "человек", "человека", "человек") +
        " в зоне", ok ? "lopa-sil" : null);

      value("Предел для такого класса", sci(fMax) + NB + "/год",
        "Rд × " + state.people + " / " + fatal + " — выше этой частоты критерий нарушается");

      var verdict = el("div", "lopa-note-block");
      if (ok) {
        verdict.textContent = "Замыкание проходит: " + sci(indiv) + " ниже Rд " + sci(R_D_YEAR) +
          " в " + (R_D_YEAR / indiv).toFixed(1).replace(".", ",") + " раза. " +
          "Класс можно брать; требование к функции считается отдельно и от замыкания не зависит.";
      } else {
        verdict.textContent = "Замыкание не проходит: " + sci(indiv) + " выше Rд " + sci(R_D_YEAR) +
          " в " + (indiv / R_D_YEAR).toFixed(1).replace(".", ",") + " раза. " +
          "При " + state.people + " " + plural(state.people, "человеке", "человеках", "человеках") +
          " в зоне класс не может быть чаще " + sci(fMax) + " /год. " +
          "Функция безопасности этого не исправляет: частота задана до неё.";
      }
      out.appendChild(verdict);

      /* m не входит в замыкание: деление бюджета на сценарии переставляет
         ответственность между функциями, а сумма остаётся классом. */
      var mNote = el("div", "lopa-note-block");
      mNote.textContent = "Число сценариев " + state.scenarios + " на замыкание не влияет: " +
        "произведение «частота класса × погибших / людей» от него не зависит. " +
        "Деление на сценарии решает, какой функции какая доля принадлежит, " +
        "а не сколько риска остаётся у объекта.";
      out.appendChild(mNote);

      var note = el("div", "lopa-formula-wrap");
      note.appendChild(el("span", "lopa-formula",
        "f_сц = f_класс / m;  f_до = f_иниц × Π PFD;  PFD = f_сц / f_до;  " +
        "R_инд = f_класс · k / N ≤ R_д"));
      out.appendChild(note);
    }

    recalc();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".target").forEach(render);
  });
})();
