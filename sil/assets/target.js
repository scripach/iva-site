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
    if (x >= 0.1) {
      var plain = Number(mant.replace(",", ".") + "e" + exp);
      if (plain >= 0.1 && plain < 1000) {
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

  /* Критерий печатается четырьмя знаками после запятой: 73 / 20 / 3 =
     1,2167 ppm — ровно то число, что стоит в прозе урока и на схеме.
     sci() даёт три значащие и превращает критерий в «1,22», после чего шаги
     перестают сходиться с текстом на глазах у читателя. */
  function ppm(x) {
    return Number(x).toFixed(4).replace(".", ",");
  }

  function criterion() {
    return ppm(R_D) + "·10⁻⁶";
  }

  /* Границы табл. 4 полуоткрыты: значение ровно на ней — нижняя полоса. */
  function onBandEdge(r) {
    return [10, 100, 1000, 10000].some(function (b) {
      return Math.abs(r - b) <= b * 1e-9;
    });
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
    /* правка 27: класс и реестр называются до чисел */
    if (cfg.classId) {
      root.appendChild(el("p", "instruction lopa-registry-meta",
        "Класс " + cfg.classId +
        (cfg.registry ? " · реестр " + cfg.registry : "")));
    }

    var grid = el("div", "lopa-grid");
    var left = el("div");
    var right = el("div");
    grid.appendChild(left);
    grid.appendChild(right);
    root.appendChild(grid);

    var state = {
      source: parseFloat(picked(cfg.source.options).v),
      people: parseFloat(picked(cfg.people.options).v),
      /* правка 27: модель «кого считаем» и люди вне зоны; поля могут
         отсутствовать в старой разметке — тогда безопасные значения */
      model: cfg.model ? picked(cfg.model.options).v : "group",
      outsiders: cfg.outsiders ? parseFloat(picked(cfg.outsiders.options).v) : 0,
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
    /* правка 27: выбор модели и списка вне зоны — только при наличии полей */
    if (cfg.model) select(cfg.model, state.model, function (v) { state.model = v; });
    if (cfg.outsiders) select(cfg.outsiders, state.outsiders, function (v) { state.outsiders = parseFloat(v); });
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

      value("Критерий на человека, Rд", ppm(R_D) + NB + "ppm",
        "73 / 20 / 3 — разбор урока 11, §5");

      value("Целевая частота класса", sci(state.source) + NB + "/год",
        state.source === 1e-4
          ? "пример прил. B ГОСТ Р МЭК 61511-3-2018; нормативом не является"
          : "корпоративный критерий: строже примера в десять раз");

      /* Деление на сценарии распределяет ответственность, а не снижает
         риск: сумма частот по сценариям остаётся равна классу. Поэтому
         в замыкании ниже m сокращается — и это стоит показать словами.
         Равные доли — допущение курса: доли задаёт методика предприятия
         (СТО, матрица «вероятность × тяжесть») или решение HAZOP/LOPA,
         и в документе их надо назвать. */
      var fClass = state.source;
      var fSc = fClass / state.scenarios;
      value("На один сценарий", sci(fSc) + NB + "/год",
        "класс " + state.scenarios + " " + plural(state.scenarios, "сценарий", "сценария", "сценариев") +
        " делится поровну — это допущение курса, иная доля задаётся методикой предприятия; " +
        "сумма по сценариям остаётся " + sci(fClass));

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

      /* Точный десятичный путь для вердикта и полосы: целевая частота,
         число сценариев, инициатор и PFD слоёв заданы десятичными
         значениями, поэтому отношение считается как рациональное число и
         граница табл. 4 узнаётся точно, без обратного RRF → PFD. */
      var decFSc = F.decDiv(F.decOf(fClass), F.decOf(state.scenarios));
      var decBefore = F.decOf(state.initiator);
      (cfg.ipls || []).forEach(function (ipl, i) {
        if (state.ipls[i]) decBefore = decBefore ? F.decMul(decBefore, F.decOf(ipl.pfd)) : null;
      });
      var decPfd = decFSc && decBefore ? F.decDiv(decFSc, decBefore) : null;
      var neededDec = decPfd
        ? F.decCmp(decPfd, F.decOf(1)) < 0
        : pfd < 1 - 1e-9;
      /* Та же семантика, что выше: PFD ≥ 1 — функция не требуется.
         Допуск только для не-десятичного запасного пути. */
      var needed = neededDec;

      value("Что должна дать SIF", needed ? "PFD ≤ " + sci(pfd) : "не требуется",
        needed
          ? "делим частоту сценария на частоту до SIF: " + sci(fSc) + " / " + sci(before)
          : "частота до SIF " + sci(before) + " ниже частоты сценария " + sci(fSc));

      /* правка 27: выше 10⁵ шкала УПБ заканчивается — «вне шкалы», это
         только отображение. Точные границы, включая ровно 10⁵, считает
         format.js задачи 21 по неокруглённому десятичному PFD. */
      var outOfScale = needed && (decPfd
        ? F.decCmp(decPfd, F.decOf(1e-5)) < 0
        : rrf > 1e5);
      var band = needed
        ? (decPfd ? F.silOfDec(decPfd) : F.silOfPfd(pfd))
        : { sil: "—", note: "слои до SIF уже дают нужную частоту" };
      var bandTitle = outOfScale ? "вне шкалы" : band.sil.replace("SIL", "УПБ");
      var bandNote = !needed ? band.note
        : outOfScale
          ? "RRF ≈ " + fmtRRF(rrf) + " — выше верхней границы 10⁵; значение вне шкалы УПБ"
          : onBandEdge(rrf)
            ? "RRF ≈ " + fmtRRF(rrf) + " — значение ровно на границе полосы; "
              + "табл. 4 полуоткрыта, поэтому оно относится к нижней полосе ("
              + band.sil.replace("SIL", "УПБ") + ")"
            : "RRF ≈ " + fmtRRF(rrf) + "; " + band.note.replace("RRF ", "полоса ").replace("SIL", "УПБ");
      value("Требуемый уровень", bandTitle, bandNote);

      /* ───── Замыкание критерия: кого считаем (правка 27) ─────
         f·k/N — учебная модель однородной группы: все N в зоне и у каждого
         p = k/N. Для конкретного работника риск равен f·p_i; добавление
         людей вне зоны не меняет ни f, ни p_i. f_max = Rд·N/k — предел
         для однородной группы, а не для списка людей. */
      var sep = el("div", "lopa-formula-wrap");
      sep.appendChild(el("span", "lopa-formula",
        "——— замыкание: средний риск группы и риск конкретного работника ———"));
      out.appendChild(sep);

      var N = state.people;
      var listN = N + state.outsiders;
      var pGroup = fatal / N;
      var pWorker = 1;
      /* Замыкание — по частоте класса, не по fSc: сценарная доля уже
         учтена в PFD, второй раз её здесь не делим. */
      var rGroup = fClass * pGroup;
      var rWorker = fClass * pWorker;
      var rList = fClass * fatal / listN;
      var fMaxGroup = R_D_YEAR * N / fatal;
      var fMaxWorker = R_D_YEAR / pWorker;

      value("Средний риск однородной группы", sci(rGroup) + NB + "/год",
        factor(fClass) + " × " + fatal + " / " + N +
        " — у каждого p = k/N; это среднее, а не верхняя граница",
        state.model === "group" && rGroup <= R_D_YEAR ? "lopa-sil" : null);

      value("Риск конкретного работника", sci(rWorker) + NB + "/год",
        factor(fClass) + " × 1 — он всегда в зоне и погибает при событии",
        state.model === "person" && rWorker <= R_D_YEAR ? "lopa-sil" : null);

      if (state.outsiders > 0) {
        value("Средний риск по списку", sci(rList) + NB + "/год",
          factor(fClass) + " × " + fatal + " / " + listN +
          " — люди вне зоны входят только в список, не в N; это не риск работника");
      }

      value("Предел для однородной группы", sci(fMaxGroup) + NB + "/год",
        "Rд × " + N + " / " + fatal + " — выше этой частоты средний риск группы больше Rд");

      value("Предел для работника", sci(fMaxWorker) + NB + "/год",
        "Rд / 1 — при p = 1 предел равен Rд; N и k на него не влияют");

      var ok = state.model === "group" ? rGroup <= R_D_YEAR : rWorker <= R_D_YEAR;
      var usedRisk = state.model === "group" ? rGroup : rWorker;
      var usedMax = state.model === "group" ? fMaxGroup : fMaxWorker;
      var usedWho = state.model === "group"
        ? "средний риск однородной группы"
        : "риск конкретного работника";

      var verdict = el("div", "lopa-note-block");
      if (ok) {
        verdict.textContent = "Замыкание проходит для выбранной модели (" + usedWho + "): " +
          sci(usedRisk) + " ниже Rд " + criterion() + " в " + sci(R_D_YEAR / usedRisk) +
          " раза. Класс можно брать; требование к функции считается отдельно и от замыкания не зависит.";
      } else {
        verdict.textContent = "Замыкание не проходит для выбранной модели (" + usedWho + "): " +
          sci(usedRisk) + " выше Rд " + criterion() + " в " + sci(usedRisk / R_D_YEAR) +
          " раза. Предел для этой модели — " + sci(usedMax) + " /год. " +
          "Функция безопасности этого не исправляет: частота задана до неё.";
      }
      out.appendChild(verdict);

      if (state.outsiders > 0) {
        var outNote = el("div", "lopa-note-block");
        outNote.textContent = "Люди вне зоны не входят в N: в опасной зоне " + N + " " +
          plural(N, "человек", "человека", "человек") + ", в списке " + listN + ". " +
          "Средний риск по списку " + sci(rList) + NB + "/год ниже, но это не риск работника: " +
          "его риск " + sci(rWorker) + NB + "/год и от длины списка не зависит.";
        out.appendChild(outNote);
      }

      /* m не входит в замыкание: деление бюджета на сценарии переставляет
         ответственность между функциями, а сумма остаётся классом. */
      var mNote = el("div", "lopa-note-block");
      mNote.textContent = "Число сценариев " + state.scenarios + " на замыкание не влияет: " +
        "средний риск f·k/N от него не зависит. " +
        "Деление на сценарии решает, какой функции какая доля принадлежит, " +
        "а не сколько риска остаётся у объекта.";
      out.appendChild(mNote);

      var note = el("div", "lopa-formula-wrap");
      note.appendChild(el("span", "lopa-formula",
        "f_сц = f_класс / m;  f_до = f_иниц × Π PFD;  PFD = f_сц / f_до;  " +
        "R_ср = f_класс · k / N — однородная группа;  R_i = f_класс · p_i — конкретный человек;  " +
        "f_max = Rд · N / k — только для однородной группы."));
      out.appendChild(note);
    }

    recalc();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".target").forEach(render);
  });
})();
