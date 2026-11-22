/* Task 30 — pure model for the final case.
 *
 * This file is used twice:
 *   1. in the browser, by assets/final-calc.js, to recalculate the dependent
 *      fields when the reader changes an input;
 *   2. in Node, by tests/final-model.test.mjs, so the arithmetic is checked
 *      without a DOM.
 *
 * All numbers are educational.  The model does not contain a passport,
 * certificate, plant measurement or a validation result.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FinalModel = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PFD_MODELS = {
    contract3: {
      value: 0.001948689,
      label: "Контракт, строка 3: 2oo3 / 1oo2 / 1oo2, β = 5 %, реальная проверка",
      short: "1,948689·10⁻³",
    },
    contract4: {
      value: 0.000401251,
      label: "Контракт, строка 4: другие изделия, все подсистемы 1oo2",
      short: "4,01251·10⁻⁴",
    },
    caseC6: {
      value: 0.00017572967032871545,
      label: "Вариант C: 2oo3 / 1oo2 / 1oo2, TI 6 мес, улучшенные клапан и логика",
      short: "1,7573·10⁻⁴",
    },
    caseC12: {
      value: 0.00023781357459257534,
      label: "Вариант C при TI 12 мес: тот же контур, но реже проверка",
      short: "2,3781·10⁻⁴",
    },
    single: {
      value: 0.020148,
      label: "Одноцепная базовая модель: по одному каналу, без резерва",
      short: "2,0148·10⁻²",
    },
  };

  var CRITERIA = {
    K02: {
      label: "K-02: бюджет класса 1·10⁻⁴ /год, m = 4, слой не зачтён",
      target: 2.5e-5,
      defaultM: 4,
      defaultLayer: false,
    },
    K01: {
      label: "K-01: критерий сценария 5·10⁻⁵ /год, слой оператора PFD 0,1",
      target: 5e-5,
      defaultM: null,
      defaultLayer: true,
    },
    classNoM: {
      label: "Бюджет класса 1·10⁻⁴ /год без деления на m — ошибка",
      target: 1e-4,
      defaultM: 1,
      defaultLayer: false,
    },
  };

  var DEFAULTS = {
    set: "custom",
    criterion: "K02",
    fInit: 0.1,
    m: 4,
    layer: false,
    pfdModel: "contract3",
    sc: 2,
    confirmation: true,
    valveTime: 3.0,
    safeCriterion: "both",
    closure: false,
    inflow: false,
    delta1: null,
    t4MinusT3: null,
    pst: 3.0,
    badPolicy: "vote",
    falseTripModel: "mttr",
    mttr: 4,
    validation: "plan",
  };

  function corrected() {
    return Object.assign({}, DEFAULTS, {
      set: "corrected",
      criterion: "K02",
      m: 4,
      layer: false,
      pfdModel: "caseC6",
      sc: 3,
      confirmation: true,
      valveTime: 1.5,
      safeCriterion: "both",
      closure: false,
      inflow: false,
      delta1: 0.1,
      t4MinusT3: 0.3,
      badPolicy: "vote",
      falseTripModel: "mttr",
      mttr: 4,
      validation: "plan",
    });
  }

  function negative() {
    return Object.assign({}, DEFAULTS, {
      set: "negative",
      criterion: "classNoM",
      m: 1,
      layer: false,
      pfdModel: "contract3",
      sc: 3,
      confirmation: false,
      valveTime: 3.0,
      safeCriterion: "closed",
      closure: true,
      inflow: true,
      delta1: 0,
      t4MinusT3: 0,
      badPolicy: "exclude",
      falseTripModel: "legacy",
      mttr: 4,
      pst: 4.0,
      validation: "fat",
    });
  }

  function bandSil(pfd) {
    if (!isFinite(pfd) || pfd <= 0) return 0;
    if (pfd < 1e-4) return 4;
    if (pfd < 1e-3) return 3;
    if (pfd < 1e-2) return 2;
    if (pfd < 1e-1) return 1;
    return 0;
  }

  function silCeiling(sc) {
    if (Number(sc) >= 3) return 3;
    if (Number(sc) >= 2) return 2;
    return 1;
  }

  function safeState(input) {
    if (!input || input.safeCriterion !== "both") return "not-safe";
    if (!input.closure || !input.inflow) return "not-confirmed";
    return "confirmed";
  }

  function badVote(policy, state) {
    if (state === "HIGH") return true;
    if (state === "BAD") return policy === "vote";
    return false;
  }

  function badRow(policy, a, b, c) {
    var states = [a, b, c];
    var votes = states.filter(function (s) { return badVote(policy, s); }).length;
    var badCount = states.filter(function (s) { return s === "BAD"; }).length;
    var highCount = states.filter(function (s) { return s === "HIGH"; }).length;
    return {
      votes: votes,
      request: votes >= 2,
      badCount: badCount,
      highCount: highCount,
      effective: policy === "exclude" && badCount ? "2oo2" : "2oo3",
    };
  }

  function badCombinations(policy) {
    var states = ["NORMAL", "HIGH", "BAD"];
    var total = 0;
    var requests = 0;
    var byVotes = { 0: 0, 1: 0, 2: 0, 3: 0 };
    states.forEach(function (a) {
      states.forEach(function (b) {
        states.forEach(function (c) {
          total += 1;
          var row = badRow(policy, a, b, c);
          byVotes[row.votes] += 1;
          if (row.request) requests += 1;
        });
      });
    });
    return { total: total, requests: requests, noRequest: total - requests, byVotes: byVotes };
  }

  function falseTrips(input) {
    var lambda = 5e-6; // 5 000 FIT — educational assumption
    var beta = input.falseTripModel === "legacy" ? 0.2 : 0.05;
    var mttr = Number(input.falseTripModel === "legacy" ? 4 : input.mttr);
    var perHour = beta * lambda + 6 * Math.pow(1 - beta, 2) * lambda * lambda * mttr;
    return perHour * 8760;
  }

  function compute(input) {
    var i = Object.assign({}, DEFAULTS, input || {});
    var crit = CRITERIA[i.criterion] || CRITERIA.K02;
    var target;
    if (i.criterion === "K02") {
      target = 1e-4 / (Number(i.m) > 0 ? Number(i.m) : 4);
    } else if (i.criterion === "classNoM") {
      target = 1e-4;
    } else {
      target = 5e-5;
    }
    var fBefore = Number(i.fInit) * (i.layer ? 0.1 : 1);
    var requiredPfd = target / fBefore;
    var rrf = 1 / requiredPfd;
    var requiredSil = bandSil(requiredPfd);
    var pfd = (PFD_MODELS[i.pfdModel] || PFD_MODELS.contract3).value;
    var pfdBandSil = bandSil(pfd);
    var pfdRatio = pfd / requiredPfd;
    var pfdPassNumber = pfd <= requiredPfd;
    var pfdPassBand = pfdBandSil >= requiredSil;
    var scCeiling = silCeiling(i.sc);
    var structuralCeiling = 3;
    var achievableSil = Math.min(scCeiling, structuralCeiling);

    var valveTime = Number(i.valveTime);
    var t1t3 = 0.5 + (i.confirmation ? 0.3 : 0) + 0.2 + valveTime;
    var known = i.delta1 !== null && i.delta1 !== "" && i.t4MinusT3 !== null && i.t4MinusT3 !== "";
    var fullTime = known
      ? Number(i.delta1) + t1t3 + Math.max(0, Number(i.t4MinusT3))
      : null;
    var timeKnown = fullTime !== null;
    var timePass;
    var timeVerdict;
    if (timeKnown) {
      timePass = fullTime <= Number(i.pst);
      timeVerdict = timePass ? "pass-known" : "fail-known";
    } else if (t1t3 > Number(i.pst)) {
      timePass = false;
      timeVerdict = "fail-lower-bound";
    } else {
      timePass = null;
      timeVerdict = "not-proven";
    }

    var ft = falseTrips(i);
    var falseTripsPass = ft <= 0.05;
    var matrixRow = badRow(i.badPolicy, "BAD", "HIGH", "NORMAL");
    var safe = safeState(i);

    var validationStatus = {
      none: "не проводилась",
      plan: "план есть, подтверждения нет",
      fat: "FAT на стенде не заменяет валидацию",
      sat: "SAT на объекте не заменяет валидацию",
      validation: "в учебном наборе не заявляется",
    }[i.validation] || "не подтверждено";

    var set = i.set === "negative" || i.set === "corrected" ? i.set : "custom";
    var status = set === "negative"
      ? "negative"
      : set === "corrected"
        ? "corrected-conditional"
        : "custom";

    var defects = [];
    if (set === "negative") {
      defects = [
        "критерий: бюджет класса 1·10⁻⁴ взят без деления на m, цель 1·10⁻⁴ вместо 2,5·10⁻⁵",
        "вердикт PFD выставлен по полосе SIL 2, а не по числу и не по требуемому SIL 3",
        "SC 3 записано как факт без подтверждения; при фактическом SC 2 потолок SIL 2",
        "BAD исключён из 2oo3: BAD + HIGH даёт только один голос",
        "безопасное состояние приравнено к закрытому положению без прекращения притока",
        "0,3 с подтверждения спрятаны внутри 0,2 с логики: 3,7 с вместо 4,0 с",
        "частота ложных срабатываний 8,8·10⁻³ взята при β = 20 %, а не при β = 5 %",
        "FAT на стенде выдан за валидацию объекта",
      ];
    }

    var unresolved = [];
    if (set === "corrected") {
      unresolved = [
        "PFD 1,7573·10⁻⁴ ниже 2,5·10⁻⁴ в 1,42 раза — выполнено условно при TI 6 мес, λ, PTC и β из таблицы C",
        "SC 3 — учебное допущение; сертификат и руководство по безопасности не проверены; при SC 2 потолок SIL 2",
        "время 2,9 с ≤ PST 3,0 с — условно при ходе 1,5 с, Δ1 = 0,1 с и t4 − t3 = 0,3 с; измерений нет",
        "безопасное состояние не подтверждено: нет измерений закрытия и прекращения притока",
        "валидация не проводилась; FAT, SAT и валидация — разные доказательства",
        "частота ложных срабатываний 2,2·10⁻³ /год — расчёт при учебных λS, β и MTTR",
        "при TI 12 мес PFD 2,3781·10⁻⁴ — ещё ниже 2,5·10⁻⁴, но запас 1,05; при клапане 500 FIT и TI 12 мес — 2,8842·10⁻⁴, не выполнено",
      ];
    }

    return {
      set: set,
      status: status,
      criterion: i.criterion,
      criterionLabel: crit.label,
      target: target,
      fBefore: fBefore,
      requiredPfd: requiredPfd,
      rrf: rrf,
      requiredSil: requiredSil,
      pfd: pfd,
      pfdShort: (PFD_MODELS[i.pfdModel] || PFD_MODELS.contract3).short,
      pfdBandSil: pfdBandSil,
      pfdRatio: pfdRatio,
      pfdMargin: requiredPfd / pfd,
      pfdPassNumber: pfdPassNumber,
      pfdPassBand: pfdPassBand,
      pfdPassByBandOnly: pfdPassBand && !pfdPassNumber,
      sc: Number(i.sc),
      scCeiling: scCeiling,
      structuralCeiling: structuralCeiling,
      achievableSil: achievableSil,
      targetReachable: achievableSil >= requiredSil,
      t1t3: t1t3,
      fullTimeLower: t1t3,
      fullTime: fullTime,
      timeKnown: timeKnown,
      timePass: timePass,
      timeVerdict: timeVerdict,
      timeMargin: timeKnown ? Number(i.pst) - fullTime : null,
      pst: Number(i.pst),
      safeState: safe,
      matrixRow: matrixRow,
      badPolicy: i.badPolicy,
      falseTrips: ft,
      falseTripsPass: falseTripsPass,
      falseTripsModel: i.falseTripModel,
      mttr: Number(i.mttr),
      validationStatus: validationStatus,
      defects: defects,
      unresolved: unresolved,
    };
  }

  function dependenciesFor(field) {
    var map = {
      criterion: ["LOPA", "SRS", "traceability", "verdict"],
      m: ["LOPA", "SRS", "traceability", "verdict"],
      layer: ["LOPA", "SRS", "traceability", "verdict"],
      fInit: ["LOPA", "SRS", "traceability", "verdict"],
      pfdModel: ["PFD contract", "SRS", "traceability", "verdict"],
      sc: ["architecture", "SRS", "traceability", "verdict"],
      confirmation: ["time", "SRS", "traceability", "validation", "verdict"],
      valveTime: ["time", "SRS", "traceability", "validation", "verdict"],
      delta1: ["time", "SRS", "traceability", "validation", "verdict"],
      t4MinusT3: ["time", "SRS", "traceability", "validation", "verdict"],
      safeCriterion: ["SRS", "matrix", "validation", "verdict"],
      badPolicy: ["matrix", "SRS", "validation"],
      falseTripModel: ["availability", "SRS", "matrix"],
      mttr: ["availability", "SRS", "matrix"],
      validation: ["SRS", "verdict"],
    };
    return (map[field] || []).slice();
  }

  return {
    PFD_MODELS: PFD_MODELS,
    CRITERIA: CRITERIA,
    DEFAULTS: DEFAULTS,
    corrected: corrected,
    negative: negative,
    compute: compute,
    bandSil: bandSil,
    silCeiling: silCeiling,
    safeState: safeState,
    badRow: badRow,
    badCombinations: badCombinations,
    falseTrips: falseTrips,
    dependenciesFor: dependenciesFor,
  };
});
