/* Task 30 — linked constructor for the final set.
 *
 * The reader changes one input; the widget recomputes the criterion, the
 * required PFD, the architecture ceiling, the time budget, the matrix row,
 * availability and the verdict, and writes the list of dependent documents
 * that were recalculated.  No input is graded here: the graded attempt is the
 * separate .case block.
 */
(function () {
  "use strict";

  var M = window.FinalModel;
  if (!M) return;

  var FIELDS = [
    {
      group: "Критерий и LOPA",
      id: "criterion",
      type: "select",
      label: "Критерий сценария",
      options: [
        { v: "K02", label: "K-02: бюджет класса 1·10⁻⁴ /год, m = 4" },
        { v: "K01", label: "K-01: критерий сценария 5·10⁻⁵ /год" },
        { v: "classNoM", label: "Бюджет класса без деления на m" },
      ],
    },
    { group: "Критерий и LOPA", id: "m", type: "number", label: "Сценариев в классе m", min: 1, max: 20, step: 1 },
    { group: "Критерий и LOPA", id: "layer", type: "checkbox", label: "Слой оператора PFD 0,1 зачтён" },
    { group: "Критерий и LOPA", id: "fInit", type: "number", label: "Частота инициатора", unit: "1 /год", step: 0.01 },
    { group: "Критерий и LOPA", id: "pfdModel", type: "select", label: "Модель PFD", options: [
      { v: "contract3", label: "Контракт, строка 3: 2oo3 / 1oo2 / 1oo2, β = 5 %" },
      { v: "contract4", label: "Контракт, строка 4: другие изделия, все 1oo2" },
      { v: "caseC6", label: "Вариант C: TI 6 мес, клапан 400 FIT, логика 100 FIT" },
      { v: "caseC12", label: "Вариант C: TI 12 мес — проверка реже" },
      { v: "single", label: "Одноцепная базовая модель" },
    ] },

    { group: "Архитектура и SC", id: "sc", type: "select", label: "Минимальная систематическая полнота", options: [
      { v: "2", label: "SC 2 — учебное значение клапана" },
      { v: "3", label: "SC 3 — гипотеза, сертификат не проверен" },
    ] },

    { group: "Время и безопасное состояние", id: "confirmation", type: "checkbox", label: "Подтверждение 0,3 с учтено" },
    { group: "Время и безопасное состояние", id: "valveTime", type: "number", label: "Полный ход клапана", unit: "с", step: 0.1 },
    { group: "Время и безопасное состояние", id: "pst", type: "number", label: "Время безопасности процесса PST", unit: "с", step: 0.1 },
    { group: "Время и безопасное состояние", id: "delta1", type: "text", label: "Δ1: отказ → уставка", unit: "с", placeholder: "не задано" },
    { group: "Время и безопасное состояние", id: "t4MinusT3", type: "text", label: "t4 − t3: приток позже полного хода", unit: "с", placeholder: "не задано" },
    { group: "Время и безопасное состояние", id: "safeCriterion", type: "select", label: "Критерий безопасного состояния", options: [
      { v: "both", label: "Закрытое положение и прекращение притока" },
      { v: "closed", label: "Только закрытое положение" },
    ] },
    { group: "Время и безопасное состояние", id: "closure", type: "checkbox", label: "Закрытое положение подтверждено" },
    { group: "Время и безопасное состояние", id: "inflow", type: "checkbox", label: "Прекращение притока подтверждено" },

    { group: "Матрица и доступность", id: "badPolicy", type: "select", label: "Политика BAD в 2oo3", options: [
      { v: "vote", label: "BAD — голос «сработал»" },
      { v: "exclude", label: "BAD исключается из голосования" },
    ] },
    { group: "Матрица и доступность", id: "falseTripModel", type: "select", label: "Модель ложных срабатываний", options: [
      { v: "mttr", label: "2oo3 с MTTR и β = 5 %" },
      { v: "legacy", label: "Старая оценка при β = 20 %" },
    ] },
    { group: "Матрица и доступность", id: "mttr", type: "number", label: "MTTR", unit: "ч", step: 1 },

    { group: "Подтверждение", id: "validation", type: "select", label: "Состояние доказательств", options: [
      { v: "none", label: "Валидация не проводилась" },
      { v: "plan", label: "План есть, подтверждения нет" },
      { v: "fat", label: "FAT на стенде" },
      { v: "sat", label: "SAT на объекте" },
    ] },
  ];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function fmt(x) {
    if (x === null || x === undefined) return "—";
    if (typeof x === "boolean") return x ? "да" : "нет";
    if (x === 0) return "0";
    var abs = Math.abs(x);
    if (abs < 0.1 || abs >= 10000) {
      var exp = Math.floor(Math.log10(abs));
      var mant = x / Math.pow(10, exp);
      mant = Math.round(mant * 10) / 10;
      if (Math.abs(mant) >= 10) { mant /= 10; exp += 1; }
      var sup = String(exp).replace("-", "⁻").replace(/[0-9]/g, function (d) {
        return "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)];
      });
      return String(mant).replace(".", ",") + "·10" + sup;
    }
    if (abs >= 1000) return Math.round(x).toLocaleString("ru-RU");
    return String(Math.round(x * 10) / 10).replace(".", ",");
  }

  function parse(v) {
    if (v === "" || v === null || v === undefined) return null;
    var n = Number(String(v).replace(",", "."));
    return isFinite(n) ? n : null;
  }

  function verdictTime(o) {
    if (o.timeVerdict === "fail-lower-bound") return "не выполнено: нижняя граница уже больше PST";
    if (o.timeVerdict === "fail-known") return "не выполнено: полное время больше PST";
    if (o.timeVerdict === "pass-known") return "выполнено условно: Δ заданы учебно";
    return "не доказано: полное время неизвестно";
  }

  function verdictSafe(s) {
    if (s === "confirmed") return "подтверждено обоими критериями";
    if (s === "not-confirmed") return "не подтверждено: нет одного из двух критериев";
    return "не достигнуто: закрытого положения недостаточно";
  }

  function render(root) {
    var mode = root.getAttribute("data-mode") || "negative";
    var state = mode === "corrected" ? M.corrected() : M.negative();

    root.innerHTML = "";
    root.classList.add("widget");
    root.appendChild(el("p", "widget-title", "Конструктор комплекта: измените вход — увидите, что пересчиталось"));
    root.appendChild(el("p", "instruction",
      "Этот конструктор не проверяет вас. Он показывает зависимости: критерий меняет LOPA, SRS, матрицу и вердикт; " +
      "SC меняет архитектурный потолок; подтверждение и Δ меняют время; политика BAD меняет строку матрицы. " +
      "Все числа учебные."));

    var grid = el("div", "calc-grid");
    var byGroup = {};
    var controls = {};

    FIELDS.forEach(function (f) {
      if (!byGroup[f.group]) {
        var fs = document.createElement("fieldset");
        fs.className = "calc-group";
        fs.appendChild(el("legend", null, f.group));
        byGroup[f.group] = fs;
        grid.appendChild(fs);
      }
      var label = el("label", "calc-field");
      label.appendChild(el("span", "calc-label", f.label));
      var control;
      if (f.type === "select") {
        control = document.createElement("select");
        control.className = "calc-select";
        (f.options || []).forEach(function (o) {
          var op = el("option", null, o.label);
          op.value = o.v;
          control.appendChild(op);
        });
      } else if (f.type === "checkbox") {
        control = document.createElement("input");
        control.type = "checkbox";
        control.className = "calc-check";
      } else {
        control = document.createElement("input");
        control.type = f.type === "number" ? "number" : "text";
        control.className = "calc-input";
        if (f.min !== undefined) control.min = f.min;
        if (f.max !== undefined) control.max = f.max;
        if (f.step !== undefined) control.step = f.step;
        if (f.placeholder) control.placeholder = f.placeholder;
      }
      control.id = "calc-" + f.id;
      control.setAttribute("aria-label", f.label);
      label.appendChild(control);
      if (f.unit) label.appendChild(el("span", "calc-unit", f.unit));
      byGroup[f.group].appendChild(label);
      controls[f.id] = control;
    });
    root.appendChild(grid);

    var actions = el("div", "calc-actions");
    var toCorrected = el("button", "btn", "Вернуть условный набор C");
    toCorrected.type = "button";
    var toNegative = el("button", "btn", "Сбросить в отрицательный");
    toNegative.type = "button";
    actions.appendChild(toCorrected);
    actions.appendChild(toNegative);
    root.appendChild(actions);

    var outputs = el("div", "calc-outputs");
    outputs.setAttribute("aria-live", "polite");
    root.appendChild(outputs);

    var log = el("p", "calc-log");
    log.setAttribute("aria-live", "polite");
    root.appendChild(log);

    function setControls(s) {
      controls.criterion.value = s.criterion;
      controls.m.value = s.m;
      controls.layer.checked = !!s.layer;
      controls.fInit.value = s.fInit;
      controls.pfdModel.value = s.pfdModel;
      controls.sc.value = String(s.sc);
      controls.confirmation.checked = !!s.confirmation;
      controls.valveTime.value = s.valveTime;
      controls.pst.value = s.pst;
      controls.delta1.value = s.delta1 === null ? "" : s.delta1;
      controls.t4MinusT3.value = s.t4MinusT3 === null ? "" : s.t4MinusT3;
      controls.safeCriterion.value = s.safeCriterion;
      controls.closure.checked = !!s.closure;
      controls.inflow.checked = !!s.inflow;
      controls.badPolicy.value = s.badPolicy;
      controls.falseTripModel.value = s.falseTripModel;
      controls.mttr.value = s.mttr;
      controls.validation.value = s.validation;
      syncDisabled();
    }

    function syncDisabled() {
      var crit = controls.criterion.value;
      controls.m.disabled = crit !== "K02";
      controls.mttr.disabled = controls.falseTripModel.value !== "mttr";
      var both = controls.safeCriterion.value === "both";
      controls.closure.disabled = !both;
      controls.inflow.disabled = !both;
    }

    function readState() {
      return {
        set: state.set,
        criterion: controls.criterion.value,
        m: parse(controls.m.value),
        layer: controls.layer.checked,
        fInit: parse(controls.fInit.value),
        pfdModel: controls.pfdModel.value,
        sc: Number(controls.sc.value),
        confirmation: controls.confirmation.checked,
        valveTime: parse(controls.valveTime.value),
        pst: parse(controls.pst.value),
        delta1: parse(controls.delta1.value),
        t4MinusT3: parse(controls.t4MinusT3.value),
        safeCriterion: controls.safeCriterion.value,
        closure: controls.closure.checked,
        inflow: controls.inflow.checked,
        badPolicy: controls.badPolicy.value,
        falseTripModel: controls.falseTripModel.value,
        mttr: parse(controls.mttr.value),
        validation: controls.validation.value,
      };
    }

    function row(label, value, note) {
      var tr = document.createElement("tr");
      tr.appendChild(el("th", null, label));
      var td = el("td", null, value);
      if (note) td.title = note;
      tr.appendChild(td);
      return tr;
    }

    function paint(o, changed) {
      var table = document.createElement("table");
      table.className = "calc-table";
      var tbody = document.createElement("tbody");

      var status = el("p", "calc-status " + (o.status === "negative" ? "is-negative" : "is-corrected"));
      status.textContent = o.status === "negative"
        ? "Отрицательный набор N: данные и статусы не согласованы."
        : o.status === "corrected-conditional"
          ? "Условно исправленный набор C: расчётные требования выполнены при учебных допущениях; доказательств для реального объекта нет."
          : "Свой набор: проверьте, какие зависимости изменились.";
      table.appendChild(tbody);
      tbody.appendChild(row("Цель сценария", fmt(o.target) + " 1/год"));
      tbody.appendChild(row("Требуемый PFD", fmt(o.requiredPfd)));
      tbody.appendChild(row("Требуемый RRF", fmt(o.rrf)));
      tbody.appendChild(row("Целевой УПБ", "SIL " + o.requiredSil));
      tbody.appendChild(row("Достигнутый PFD", o.pfdShort + " (полоса SIL " + o.pfdBandSil + ")"));
      tbody.appendChild(row("Отношение PFD к требуемому", fmt(o.pfdRatio) + " раза"));
      tbody.appendChild(row("Вердикт по PFD", o.pfdPassNumber ? "выполнено" : "не выполнено",
        "Полоса: " + (o.pfdPassBand ? "не ниже требуемой" : "ниже требуемой") + "; по полосе: " + (o.pfdPassBand ? "да" : "нет")));
      tbody.appendChild(row("Запас по PFD", fmt(o.pfdMargin) + " раза к требованию"));
      tbody.appendChild(row("Потолок по SC", "SIL " + o.scCeiling + "; структурный — SIL " + o.structuralCeiling));
      tbody.appendChild(row("Достижимый УПБ", "SIL " + o.achievableSil + (o.targetReachable ? " — цель достижима" : " — цель не достижима")));
      tbody.appendChild(row("t1 → t3", fmt(o.t1t3) + " с"));
      tbody.appendChild(row("Полное t0 → t_safe", o.timeKnown ? fmt(o.fullTime) + " с (Δ заданы учебно)" : "≥ " + fmt(o.fullTimeLower) + " с (Δ не заданы)"));
      tbody.appendChild(row("Запас по времени", o.timeMargin === null ? "не определён" : fmt(o.timeMargin) + " с"));
      tbody.appendChild(row("PST", fmt(o.pst) + " с"));
      tbody.appendChild(row("Вердикт по времени", verdictTime(o)));
      tbody.appendChild(row("BAD + HIGH + NORMAL", "голосов: " + o.matrixRow.votes + "; запрос: " + (o.matrixRow.request ? "да" : "нет") + "; структура: " + o.matrixRow.effective));
      tbody.appendChild(row("Ложные срабатывания", fmt(o.falseTrips) + " /год при цели 5,0·10⁻² /год"));
      tbody.appendChild(row("Безопасное состояние", verdictSafe(o.safeState)));
      tbody.appendChild(row("Валидация", o.validationStatus));
      outputs.innerHTML = "";
      outputs.appendChild(status);
      var tableWrap = el("div", "calc-table-wrap");
      tableWrap.appendChild(table);
      outputs.appendChild(tableWrap);

      var extra = el("div", "calc-notes");
      if (o.defects.length) {
        extra.appendChild(el("p", "calc-note-title", "Видимые дефекты отрицательного набора:"));
        var ul = document.createElement("ul");
        o.defects.forEach(function (d) { ul.appendChild(el("li", null, d)); });
        extra.appendChild(ul);
      }
      if (o.unresolved.length) {
        extra.appendChild(el("p", "calc-note-title", "Что осталось непроверенным в исправленном наборе:"));
        var ul2 = document.createElement("ul");
        o.unresolved.forEach(function (d) { ul2.appendChild(el("li", null, d)); });
        extra.appendChild(ul2);
      }
      outputs.appendChild(extra);

      if (changed === "corrected") {
        log.textContent = "Загружен условно исправленный набор C. Пересчитаны критерий, SRS, архитектура и SC, расчёт, матрица, время, доступность и вердикт; допущения C названы в таблице страницы.";
      } else if (changed === "negative") {
        log.textContent = "Загружен отрицательный набор N. Пересчитаны все поля; дефекты снова видны.";
      } else if (changed) {
        var deps = M.dependenciesFor(changed);
        log.textContent = "Изменено поле «" + changed + "». Пересчитаны зависимые документы: " +
          deps.join(", ") + ".";
      } else {
        log.textContent = "Измените любой вход: список пересчитанных документов появится здесь.";
      }
      root.__finalCalc = { state: readState(), output: o, log: log.textContent };
    }

    function update(changed) {
      var s = readState();
      state = s;
      var o = M.compute(s);
      paint(o, changed);
    }

    Object.keys(controls).forEach(function (id) {
      controls[id].addEventListener("change", function () {
        if (id === "criterion") {
          var c = M.CRITERIA[controls.criterion.value];
          if (c && c.defaultM !== null && c.defaultM !== undefined) controls.m.value = c.defaultM;
          if (c) controls.layer.checked = !!c.defaultLayer;
        }
        syncDisabled();
        update(id);
      });
      controls[id].addEventListener("input", function () {
        if (controls[id].type !== "checkbox" && controls[id].tagName !== "SELECT") update(id);
      });
    });

    toCorrected.addEventListener("click", function () {
      state = M.corrected();
      setControls(state);
      update("corrected");
    });
    toNegative.addEventListener("click", function () {
      state = M.negative();
      setControls(state);
      update("negative");
    });

    setControls(state);
    update("");
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".final-calc").forEach(render);
  });
})();
