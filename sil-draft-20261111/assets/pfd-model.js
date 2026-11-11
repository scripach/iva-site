/* ============================================================
   SIL Course — shipped PFD calculator model (ticket 17, T13;
   ticket 19, T17)

   Only the functions the lesson-4 widget actually calls:

     branchAverage(λ, TI, PTC?, TL?)  λ·[PTC·TI/2 + (1−PTC)·TL/2]
                                      for one link; PTC = 1 (and then
                                      TL is irrelevant) gives λ·TI/2
     seriesSum(pfds)                  first-order series sum
     verdictOf(PFD, targetRRF)        verdict against 1/targetRRF,
                                      computed from the unrounded PFD

   The widget stays on the first-order approximation; the model is
   named in the UI (cfg.model / cfg.verdictNote). The four-model
   reference (product of averages, linear and exponential time
   averages) is a draft instrument, not shipped:
   draft-17/tools/series_models_reference.js.

   Units: λ in 1/h, TI and TL in h; PFD and RRF are dimensionless.
   ============================================================ */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SilPfd = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function validRate(value) {
    return typeof value === "number" && isFinite(value) && value >= 0;
  }

  function validTi(value) {
    return typeof value === "number" && isFinite(value) && value >= 0;
  }

  function validPtc(value) {
    return typeof value === "number" && isFinite(value) && value >= 0 && value <= 1;
  }

  /* One channel. PTC belongs to the proof-test procedure, TL to the
     period of full restoration. Omitted PTC means a full-coverage
     proof test (the lesson's §3 idealisation); omitted TL then has no
     effect. */
  function branchAverage(lambda, ti, ptc, tl) {
    if (!validRate(lambda) || !validTi(ti)) return NaN;
    var coverage = ptc === undefined ? 1 : ptc;
    var mission = tl === undefined ? 0 : tl;
    if (!validPtc(coverage) || !validTi(mission)) return NaN;
    return lambda * (coverage * ti / 2 + (1 - coverage) * mission / 2);
  }

  function seriesSum(pfds) {
    if (!Array.isArray(pfds)) return NaN;
    var total = 0;
    for (var i = 0; i < pfds.length; i += 1) {
      if (!validRate(pfds[i])) return NaN;
      total += pfds[i];
    }
    return total;
  }

  /* The requirement is PFD ≤ 1/targetRRF. Decide it on the unrounded PFD
     against that boundary, not on a printed label: the UI shows one decimal
     in the coefficient, so values on opposite sides of 1/200 can print the
     same «5·10⁻³» and «≈ 200». No ratio is recomputed for the verdict. */
  function verdictOf(pfd, targetRRF) {
    if (!isFinite(pfd) || pfd < 0 || !(targetRRF > 0)) {
      return { passes: false, rrf: NaN };
    }
    var rrf = pfd === 0 ? Infinity : 1 / pfd;
    var targetPfd = 1 / targetRRF;
    return { passes: pfd <= targetPfd, rrf: rrf };
  }

  return {
    branchAverage: branchAverage,
    seriesSum: seriesSum,
    verdictOf: verdictOf,
  };
});
