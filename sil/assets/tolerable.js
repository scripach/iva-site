/* ============================================================
   SIL Course — tolerable-risk calculator (РБ Ростехнадзора № 331)
   Root div has class "tolerable" only; layout reuses the inner
   .lopa-* class names from course.css (same convention as pfd.js,
   moon.js, shared.js, assemble.js, bypass.js, dossier.js, module.js —
   no CSS duplication, other widget roots untouched).

   Markup:
     <div class="tolerable">
       <script type="application/json">
       {
         "title": "...", "instruction": "...",
         "industry":  { "label": "Отрасль", "options": [ {"v": 73, "label": "...", "selected": true}, ... ] },
         "severity":  { "label": "Степень опасности аварии",
                        "options": [ {"v": "средняя", "label": "средняя — КЗ 20", "kz": 20, "selected": true}, ... ] },
         "background":{ "label": "Какой фон взят", "options": [ {"v": "industry", "label": "...", "selected": true},
                                                                {"v": "techno", "label": "..."} ] },
         "population":{ "label": "Для кого критерий", "options": [ {"v": 1, "label": "персонал", "selected": true},
                                                                  {"v": 100, "label": "население — в 100 раз меньше"} ] },
         "people":   { "label": "Сколько человек в зоне поражения", "options": [ {"v": 3, "label": "...", "selected": true}, ... ] },
         "fatal":    { "label": "Сколько из них погибают в одном событии",
                       "options": [ {"v": 3, "label": "все трое", "selected": true}, {"v": 1, "label": "один"} ] },
         "scenarios": { "label": "Доля на эту SIF", "options": [ {"v": 1, "label": "..."}, ... ] },
         "initiator": { "label": "Частота инициатора", "options": [ {"v": 0.1, "label": "...", "selected": true}, ... ] }
       }
       </script>
     </div>

   Model (РБ № 331, п. 14 — stage 7 of the procedure):
     Rд = Rф / КЗ                     [ppm = погибших на миллион рискующих]
     Rд_перс = Rд / 3  (проектируемый объект) · / 5 (устанавливаются новые требования)
     Rд_насел = Rд_перс / 100

   Units matter more than the arithmetic here: Rд is a risk per person
   (ppm killed out of a million exposed), NOT a frequency of an accident.
   Multiplying it by the number of people in the zone gives DEATHS PER
   YEAR (persons × risk per person), which is still not a frequency:
   an event that kills k of the N people exposed happens deaths/k times
   per year. Only then does the division by the number of scenarios
   sharing that level produce a frequency, and only that frequency is
   comparable with a target frequency from annex B.

   The earlier model stopped at deaths/year and labelled it "лимит на
   событие, 1/год". With k = N the missing divisor hid inside the
   multiplication and the answer looked right; with k < N the frequency
   came out N/k times too high, and the dimension "в год" looked
   correct the whole way. That is the failure this widget now blocks.

   The widget prints that ladder to the end on purpose: it always lands
   far above SIL 3, and that overshoot IS the lesson. A criterion on
   individual risk answers "how many deaths per million people", while a
   requirement on a SIF answers "how often may THIS scenario happen".
   The second question is what annex B of ГОСТ Р МЭК 61511-3 answers with
   a number like 1·10⁻⁴ /год — a frequency of the event, not a risk to a
   person. So a second block computes that route as well, and it does
   produce SIL 2 and SIL 3; the contrast between the two routes is the
   whole point, not a bug in either.

   The dB scale of the guide: RdB = 10·lg(R / R_ГЛ), R_ГЛ = 195 ppm
   (гибель при ДТП и пожарах, табл. 3 прил. 2). Zero dB means the risk
   equals dying in a road accident — that is the anchor, not a target.
   ============================================================ */
(function () {
  "use strict";

  /* Фоновый риск гибели при ДТП и пожарах, табл. 3 прил. 2 РБ 331:
     195 погибших на миллион рискующих за 2013–2022 гг. */
  var R_GL = 195;

  /* Дополнительные понижающие коэффициенты, п. 14 РБ 331. */
  var EXTRA = { existing: 1, new: 3, newreq: 5 };

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

  var NB = "\u00a0";

  /* ppm → индивидуальный риск, 1/год: 1 ppm = 10⁻⁶. */
  function perYear(ppm) { return ppm * 1e-6; }

  /* ppm живут в диапазоне 0,065…73. fmt() округляет всё выше 10 до одного
     знака, а ниже 0,1 уходит в степень: 0,0122 печаталось как 1,2·10⁻².
     Критерий — не вероятность, ему нужны три значащие в обычной записи. */
  function ppm(x) {
    if (x >= 0.001) return String(Number(x.toPrecision(3))).replace(".", ",");
    return sci(x);
  }

  function dbr(ppm) { return 10 * Math.log10(ppm / R_GL); }

  /* дБR — не вероятность: fmt() оставил бы «−12» вместо «−12,0» и
     потерял бы знак после нуля. Один знак после запятой, минус U+2212. */
  function db(x) {
    var s = Math.abs(x).toFixed(1).replace(".", ",");
    return (x < 0 ? "−" : x > 0 ? "+" : "") + s;
  }

  /* Отношение двух критериев: до десяти — один знак, дальше целое.
     «в 37,44 раза» в подписи читается как точность, которой нет. */
  function swapTxt(x) {
    if (x >= 10) return String(Math.round(x));
    return x.toFixed(1).replace(".", ",");
  }

  /* Отношение для вердикта замыкания: за 100 кратность печатается
     степенью, иначе «в 24658 раза» — число без порядка. */
  function ratioTxt(x) {
    if (!isFinite(x) || x === 0) return "0";
    if (x >= 100) return sci(x);
    return swapTxt(x);
  }

  /* Три значащие цифры в записи курса: 9,13·10⁻⁶. fmt() из format.js
     оставляет две — для критерия, который потом делят дальше, этого мало:
     1,22·10⁻⁶ и 1,2·10⁻⁶ дают разные PFD при обратном счёте.
     Считаем через toExponential: деление на 10ⁿ давало 9,124999… и
     округление шло вниз, хотя 9,125 округляется вверх. */
  function sci(x) {
    if (!isFinite(x) || x === 0) return "0";
    var sign = x < 0 ? "−" : "";
    x = Math.abs(x);

    /* Ручное округление полувверх по десятичной записи. Встроенные
       toPrecision и toExponential округляют к чётному: ровно 9,125 даёт
       9,12, а 9,1249999… — тоже 9,12, и два шага расчёта печатали разные
       числа (9,13·10⁻⁷ рядом с PFD 9,12·10⁻⁶). Здесь 9,125 → 9,13
       независимо от того, как легла двоичная дробь. */
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
      /* Обычная запись там, где степень небольшая: 1,22 вместо 1,22·10⁰. */
      var plain = Number(mant.replace(",", ".") + "e" + exp);
      if (plain >= 0.01 && plain < 1000) {
        return sign + String(Number(plain.toPrecision(6))).replace(".", ",");
      }
    }
    return sign + mant + "·10" + F.sup(exp);
  }


  /* Русское склонение после числа: 1 сценарий, 4 сценария, 10 сценариев. */
  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }

  /* Подпись, которая сходится при перемножении на калькуляторе:
     критерий печатается как 1,22, но считается от 1,21667, и 1,22 × 3
     даёт 3,66 вместо 3,65. Пять значащих — 1,2167, и 1,2167 × 3 = 3,6501,
     то есть в четырёхзначном ответе те же 3,65. */
  function factor(x) {
    if (!isFinite(x) || x === 0) return "0";
    var sign = x < 0 ? "−" : "";
    x = Math.abs(x);
    var parts = Number(x.toPrecision(12)).toExponential(5).split("e");
    var m = Number(Number(parts[0]).toPrecision(5)).toString()
      .replace(".", ",").replace(/(,\d*?)0+$/, "$1").replace(/,$/, "");
    return sign + m + "·10" + F.sup(parseInt(parts[1], 10));
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
      industry: picked(cfg.industry.options).v,
      severity: picked(cfg.severity.options),
      background: picked(cfg.background.options).v,
      extra: picked(cfg.extra.options).v,
      population: parseFloat(picked(cfg.population.options).v),
      people: parseFloat(picked(cfg.people.options).v),
      fatal: parseFloat(picked(cfg.fatal.options).v),
      scenarios: parseFloat(picked(cfg.scenarios.options).v),
      initiator: parseFloat(picked(cfg.initiator.options).v),
      target: parseFloat(picked(cfg.target.options).v)
    };

    var controls = {};

    function select(key, cfgObj, value, onPick) {
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
      controls[key] = s;
      return s;
    }

    select("industry", cfg.industry, state.industry, function (v) {
      state.industry = parseFloat(v);
    });
    select("severity", cfg.severity, state.severity.v, function (v) {
      state.severity = cfg.severity.options.filter(function (o) { return String(o.v) === v; })[0];
    });
    select("background", cfg.background, state.background, function (v) {
      state.background = v;
    });
    select("extra", cfg.extra, state.extra, function (v) { state.extra = v; });
    select("population", cfg.population, state.population, function (v) {
      state.population = parseFloat(v);
    });
    select("people", cfg.people, state.people, function (v) {
      state.people = parseFloat(v);
    });
    select("fatal", cfg.fatal, state.fatal, function (v) {
      state.fatal = parseFloat(v);
    });
    select("scenarios", cfg.scenarios, state.scenarios, function (v) {
      state.scenarios = parseFloat(v);
    });
    select("initiator", cfg.initiator, state.initiator, function (v) {
      state.initiator = parseFloat(v);
    });
    select("target", cfg.target, state.target, function (v) {
      state.target = parseFloat(v);
    });

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

      /* Фон берётся из прил. 2: отраслевой (RНГ) или техногенный (RГЛ).
         Фон своего объекта (RР) считается по нему самому и в виджете не
         выбирается — его подставляет проект, а не таблица. */
      var isTechno = state.background === "techno";
      var rf = isTechno ? R_GL : state.industry;
      var rfName = isTechno ? "RГЛ — гибель при ДТП и пожарах"
        : "RНГ — среднеотраслевой фон";

      /* КЗ привязан к тому, какой фон взят: у табл. 4 прил. 3 три колонки.
         Виджет берёт колонку по фону, значение — по степени опасности. */
      var kz = isTechno ? state.severity.kzTechno : state.severity.kz;

      var extra = EXTRA[state.extra];
      var base = rf / kz;
      var personal = base / extra;
      var adopted = personal / state.population;

      value("Фон, из которого считаем", ppm(rf) + NB + "ppm", rfName);

      value("КЗ", String(kz),
        isTechno ? "табл. 4, колонка «RФ = RГЛ»" : "табл. 4, колонка «RФ = RНГ»");

      value("Rд = Rф / КЗ", ppm(base) + NB + "ppm",
        "погибших на миллион рискующих за год");

      if (extra > 1) {
        value("Понижающий коэффициент", "÷" + extra,
          state.extra === "new" ? "объект проектируется заново"
            : "в обосновании ставятся новые требования");
      }

      var who = state.population === 100 ? "населения" : "персонала";
      var showStep = extra > 1 && state.population !== 1;
      if (showStep) {
        value("Rд для персонала", ppm(personal) + NB + "ppm", "после деления на " + extra);
      }
      value("Rд для " + who, ppm(adopted) + NB + "ppm",
        state.population === 100 ? "в 100 раз меньше, чем для персонала" : "критерий вашего объекта",
        "lopa-sil");

      /* Перевод в частоту события. Критерий задан на человека, а событие
         убивает всех, кто в зоне: лимит на событие = критерий × число
         людей. Затем он делится между сценариями одного уровня тяжести,
         иначе один лимит израсходуется дважды. */
      /* Считаем от полной точности, а не от напечатанного округления:
         73/20/3 = 1,21666…, и ÷3 ×3 возвращает ровно 3,65. Округление
         входа сдвигало шаг 4 на 3,66 и шаг 5 на 9,15 — при том что в
         таблице урока стоит 3,65. Печать округляет sci() на выходе. */
      var fPerson = perYear(adopted);
      value("То же в 1/год на человека", sci(fPerson),
        "индивидуальный риск, а не частота аварии");

      /* Подпись показывает сомножитель с четырьмя значащими: критерий
         печатается как 1,22, а считается от 1,2167, и читатель, умножив
         напечатанное, получил бы 3,66 вместо 3,65. Одна строка должна
         воспроизводиться на калькуляторе. */
      /* k не может быть больше N: один человек из зоны не даёт трёх
         погибших. Выбор «все трое» при N = 1 ужимается до одного. */
      var fatal = Math.min(state.fatal, state.people);

      var budget = fPerson * state.people;
      value("Допустимо смертей в год", sci(budget) + NB + "смертей/год",
        factor(fPerson) + " × " + state.people + " " +
        plural(state.people, "человек", "человека", "человек") + " в зоне поражения");

      /* Смертей в год — ещё не частота события. Событие убивает k человек
         из N, поэтому частота = бюджет / k. При k = N делитель совпадает
         с числом людей, и пропуск шага маскируется; при k < N частота
         завышается ровно в N/k раз. */
      var fEvent = budget / fatal;
      value("Частота события", sci(fEvent) + NB + "/год",
        fatal === state.people
          ? "в событии погибают все " + state.people + " " +
            plural(state.people, "человек", "человека", "человек") + ": ÷" + fatal
          : "в событии погибают " + fatal + " из " + state.people + ": ÷" + fatal);

      var fScenario = fEvent / state.scenarios;
      value("Частота на один сценарий", sci(fScenario) + NB + "/год",
        state.scenarios === 1 ? "весь лимит приходится на один сценарий"
          : "делим на " + state.scenarios + " " + plural(state.scenarios, "сценарий", "сценария", "сценариев") +
            " этого уровня тяжести");

      /* Шаг 7 — от полной точности шага 6, а не от напечатанного
         округления: sci() печатает 1,22·10⁻⁶, и деление этого числа на 0,1
         дало бы 1,2·10⁻⁵ вместо 1,21667·10⁻⁵. Ответ и подпись считаются
         от одной величины, поэтому совпадают. */
      var pfd = fScenario / state.initiator;
      var rrf = state.initiator / fScenario;
      value("Сколько остаётся на SIF", "PFD ≤ " + sci(pfd),
        "частота инициатора " + fmt(state.initiator) + NB + "/год, прочие слои уже учтены");

      var band = F.silOf(rrf);
      value("Требуемый уровень", band.sil,
        "RRF ≈ " + fmtRRF(rrf) + " — " + band.note);

      var dB = line("По шкале руководства");
      dB.appendChild(el("strong", null, db(dbr(adopted)) + NB + "дБR"));
      dB.appendChild(el("span", "lopa-note", "0 дБR — уровень гибели в ДТП и пожарах"));

      /* Та же степень опасности и та же отрасль, но другой фон:
         отраслевой против техногенного. Отношение показывает, во сколько
         раз строже критерий от одного только выбора фона — остальные
         входы (поправка п. 14, число людей, сценарии) не меняются.
         Коэффициент запаса при этом меняется в 10 раз, а критерий — в 3,7:
         различается и сам фон (73 против 195 ppm). Обе величины названы,
         иначе подпись «в 3,7 раза» читается как противоречие прозе урока,
         где речь о десятикратном росте КЗ. */
      var indCrit = state.industry / state.severity.kz;
      var techCrit = R_GL / state.severity.kzTechno;
      var swap = line("Сдвиг от выбора фона");
      swap.appendChild(el("strong", null, "в " + swapTxt(indCrit / techCrit) + " раза"));
      swap.appendChild(el("span", "lopa-note",
        "критерий — в " + swapTxt(indCrit / techCrit) + " раза, коэффициент запаса (КЗ " +
        state.severity.kz + " против " + state.severity.kzTechno + ") — в " +
        swapTxt(state.severity.kzTechno / state.severity.kz) + " раз: фон отрасли даёт " +
        ppm(indCrit) + NB + "ppm, техногенный — " + ppm(techCrit) +
        NB + "ppm; сейчас взят " + (isTechno ? "техногенный" : "отраслевой")));

      /* Второй путь: критерий задан на частоту события, а не на риск
         человека. Так работает прил. B ГОСТ 61511-3 — 1·10⁻⁴ /год для
         тяжёлого выброса. Здесь и получаются обычные SIL 2 и SIL 3. */
      var sep = el("div", "lopa-formula-wrap");
      sep.appendChild(el("span", "lopa-formula",
        "——— критерий на частоту события, прил. B ГОСТ Р МЭК 61511-3 ———"));
      out.appendChild(sep);

      var pfdEv = state.target / state.initiator;
      var rrfEv = state.initiator / state.target;
      value("PFD из целевой частоты", "PFD ≤ " + sci(pfdEv),
        "целевая частота события " + sci(state.target) + NB + "/год, инициатор " +
        fmt(state.initiator) + NB + "/год");

      var bandEv = F.silOf(rrfEv);
      var silEv = value("Уровень по этому пути", bandEv.sil,
        "RRF ≈ " + fmtRRF(rrfEv) + " — " + bandEv.note);

      var cmp = el("div", "lopa-note-block");
      cmp.textContent = bandEv.sil === band.sil
        ? "Оба пути дали одинаковый уровень. Сверьте размерность всё равно: " +
          "совпадение может быть случайным."
        : "Пути расходятся: по риску на человека вышло " + band.sil +
          ", по частоте события — " + bandEv.sil +
          ". Это не ошибка расчёта, а разные вопросы. Для перечня требований " +
          "безопасности нужен второй: он задаёт частоту сценария, из которой " +
          "получается PFD функции.";
      out.appendChild(cmp);

      /* ───── Замыкание критерия ─────
         Второй путь задаёт частоту события, но она не свободна: событие
         убивает k человек из N, поэтому индивидуальный риск от неё равен
         f · k / N, и он не должен превышать Rд. Тот же предел, решённый
         относительно частоты, — f_max = Rд · N / k. Это обратный ход той же
         цепочки, и именно он ловит целевую частоту, взятую «по привычке»:
         при смене в тысячу и трёх погибших предел равен 4,06·10⁻⁴ /год. */
      var clo = el("div", "lopa-formula-wrap");
      clo.appendChild(el("span", "lopa-formula",
        "——— замыкание: не превышает ли целевая частота критерий на человека ———"));
      out.appendChild(clo);

      var indivT = state.target * fatal / state.people;
      var fMax = fPerson * state.people / fatal;
      var okT = indivT <= fPerson;

      value("Индивидуальный риск от целевой частоты", sci(indivT) + NB + "/год",
        sci(state.target) + NB + "/год × " + fatal + " " +
        plural(fatal, "погибший", "погибших", "погибших") + " / " + state.people + " " +
        plural(state.people, "человек", "человека", "человек") + " в зоне",
        okT ? "lopa-sil" : null);

      value("Предел частоты при этих N и k", sci(fMax) + NB + "/год",
        "Rд × " + state.people + " / " + fatal +
        " — выше этой частоты критерий нарушается");

      var verdictT = el("div", "lopa-note-block");
      verdictT.textContent = okT
        ? "Замыкание проходит: " + sci(indivT) + " ниже Rд " + sci(fPerson) +
          " в " + ratioTxt(fPerson / indivT) + " раза, а целевая частота " +
          sci(state.target) + NB + "/год не превышает предела " + sci(fMax) + NB + "/год."
        : "Замыкание не проходит: " + sci(indivT) + " выше Rд " + sci(fPerson) +
          " в " + ratioTxt(indivT / fPerson) + " раза. При " + state.people + " " +
          plural(state.people, "человеке", "человеках", "человеках") + " в зоне и " +
          fatal + " " + plural(fatal, "погибшем", "погибших", "погибших") +
          " частота события не может быть выше " + sci(fMax) + NB +
          "/год — снижайте целевую частоту; предел поднимается только ростом N или снижением k.";
      out.appendChild(verdictT);

      var note = el("div", "lopa-formula-wrap");
      note.appendChild(el("span", "lopa-formula",
        "Rд = Rф / КЗ;  Rд(население) = Rд(персонал) / 100;  RdB = 10·lg(R / R_ГЛ),  R_ГЛ = 195" + NB +
        "ppm;  R_инд = f · k / N ≤ Rд,  f_max = Rд · N / k."));
      out.appendChild(note);
    }

    recalc();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".tolerable").forEach(render);
  });
})();
