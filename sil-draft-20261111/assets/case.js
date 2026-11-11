/* ============================================================
   SIL Course — self-check practice with a separate worked solution
   Root div has class "case" only.

   Markup:
     <div class="case">
       <script type="application/json">
       {
         "title": "...", "instruction": "...", "meta": "...",
         "steps": [
           {
             "id": "event",
             "prompt": "...",
             "input": { "type": "select", "label": "...",
                        "options": [ {"v": "...", "label": "..."} ] },
             "answer": "event",
             "wrong": "reason, not the answer",
             "solution": "worked step with formula and units"
           },
           {
             "id": "freq",
             "prompt": "...",
             "input": { "type": "number", "label": "...", "unit": "1 /год" },
             "answer": 0.01,
             "tolerance": 0.01,
             "wrong": "generic reason, not the answer",
             "wrongIf": [
               { "value": 0.004, "tolerance": 0.02,
                 "text": "specific reason for this plausible value" }
             ],
             "solution": "..."
           }
         ]
       }
       </script>
     </div>

   Behaviour: a wrong attempt gets a reason only; the full solution stays
   hidden until the separate "Показать разбор" button. A correct attempt is
   confirmed without opening the solution. "Пройти ещё раз" re-renders from
   the cached JSON. Print shows the task and the worked solution.
   ============================================================ */
(function () {
  "use strict";

  var NB = "\u00a0";

  function jsonOf(root) {
    if (root.__caseData !== undefined) return root.__caseData;
    var s = root.querySelector('script[type="application/json"]');
    root.__caseData = s ? JSON.parse(s.textContent) : null;
    return root.__caseData;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function parseNumber(value) {
    var s = String(value == null ? "" : value)
      .replace(/\u00a0/g, "")
      .replace(/\u202f/g, "")
      .replace(/\s+/g, "")
      .replace(",", ".");
    if (!s) return NaN;
    return Number(s);
  }

  function near(got, answer, rel) {
    if (!isFinite(got)) return false;
    var scale = Math.abs(answer);
    var relTol = rel == null ? 1e-6 : Math.abs(Number(rel));
    if (!isFinite(relTol)) relTol = 1e-6;
    var tolerance = Math.max(scale * relTol, 1e-12);
    return Math.abs(got - answer) <= tolerance;
  }

  /* A generic wrong hint is the default. An optional wrongIf list lets a
     step recognise a specific plausible value (for example the 4 h result)
     and give a sharper reason without assuming that every wrong input is
     that value. */
  function wrongTextFor(step, got) {
    if (step.input.type !== "number" || !isFinite(got)) return step.wrong;
    var alternatives = Array.isArray(step.wrongIf) ? step.wrongIf : [];
    for (var i = 0; i < alternatives.length; i += 1) {
      var alt = alternatives[i];
      if (near(got, Number(alt.value), alt.tolerance)) return alt.text || step.wrong;
    }
    return step.wrong;
  }

  function render(root) {
    var cfg = jsonOf(root);
    if (!cfg) return;

    root.innerHTML = "";
    root.classList.add("widget");

    if (cfg.title) root.appendChild(el("p", "widget-title", cfg.title));
    if (cfg.instruction) root.appendChild(el("p", "instruction", cfg.instruction));
    if (cfg.meta) root.appendChild(el("p", "instruction case-meta", cfg.meta));

    var state = { checked: 0, correct: 0, steps: [] };

    cfg.steps.forEach(function (step, index) {
      var box = el("div", "case-step");
      box.setAttribute("data-step", step.id || String(index + 1));
      box.appendChild(el("p", "case-prompt", (index + 1) + ". " + step.prompt));

      var row = el("div", "case-row");
      var label = el("label", "case-label");
      label.appendChild(el("span", "case-label-text", step.input.label));

      var control;
      if (step.input.type === "select") {
        control = el("select", "case-select");
        control.setAttribute("aria-label", step.input.label);
        var blank = el("option", null, "Выберите…");
        blank.value = "";
        control.appendChild(blank);
        (step.input.options || []).forEach(function (o) {
          var op = el("option", null, o.label);
          op.value = String(o.v);
          control.appendChild(op);
        });
        control.value = "";
      } else {
        control = el("input", "case-input");
        control.type = "number";
        control.setAttribute("aria-label", step.input.label);
        control.setAttribute("inputmode", "decimal");
        control.setAttribute("step", "any");
        control.placeholder = "число";
      }
      label.appendChild(control);

      if (step.input.unit) label.appendChild(el("span", "case-unit", step.input.unit));
      row.appendChild(label);

      var check = el("button", "btn case-check", "Проверить");
      check.type = "button";
      row.appendChild(check);
      box.appendChild(row);

      var feedback = el("div", "case-feedback");
      feedback.setAttribute("aria-live", "polite");
      box.appendChild(feedback);

      var solution = el("div", "case-solution");
      solution.setAttribute("aria-hidden", "true");
      solution.appendChild(el("p", "case-solution-title", "Разбор шага"));
      solution.appendChild(el("p", null, step.solution));
      box.appendChild(solution);

      var done = false;
      var tried = false;

      check.addEventListener("click", function () {
        var value = control.value;
        if (step.input.type === "select" && value === "") {
          feedback.textContent = "Выберите вариант — ответ пока не проверен.";
          feedback.className = "case-feedback shown bad";
          return;
        }
        var good;
        var got = null;
        if (step.input.type === "select") {
          good = String(value) === String(step.answer);
        } else {
          got = parseNumber(value);
          if (!isFinite(got)) {
            feedback.textContent = "Введите число — ответ пока не проверен.";
            feedback.className = "case-feedback shown bad";
            return;
          }
          good = near(got, Number(step.answer), step.tolerance);
        }

        if (!tried) {
          tried = true;
          state.checked += 1;
        }
        if (good && !done) {
          done = true;
          state.correct += 1;
        }

        if (good) {
          feedback.textContent = "Верно. " + (step.ok || "Шаг закрыт.");
          feedback.className = "case-feedback shown ok";
          control.disabled = true;
          check.disabled = true;
        } else {
          feedback.textContent = "Неверно. " + (wrongTextFor(step, got) || "Проверьте ход решения.");
          feedback.className = "case-feedback shown bad";
        }
        updateSummary();
      });

      root.appendChild(box);
      state.steps.push({ box: box, control: control, check: check, solution: solution, feedback: feedback });
    });

    var actions = el("div", "case-actions");

    var reveal = el("button", "btn case-reveal", cfg.revealLabel || "Показать разбор");
    reveal.type = "button";
    reveal.addEventListener("click", function () {
      state.steps.forEach(function (s) {
        s.solution.classList.add("shown");
        s.solution.setAttribute("aria-hidden", "false");
      });
      reveal.textContent = "Разбор открыт";
      reveal.disabled = true;
    });
    actions.appendChild(reveal);

    var reset = el("button", "btn case-reset", cfg.resetLabel || "Пройти ещё раз");
    reset.type = "button";
    reset.addEventListener("click", function () {
      render(root);
      if (root.scrollIntoView) root.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    actions.appendChild(reset);
    root.appendChild(actions);

    var summary = el("div", "case-summary");
    summary.setAttribute("aria-live", "polite");
    root.appendChild(summary);

    function updateSummary() {
      if (!state.checked) {
        summary.textContent = "";
        return;
      }
      var total = cfg.steps.length;
      summary.textContent = "Проверено " + state.checked + " из " + total +
        "; верно " + state.correct + ". Разбор открывается отдельной кнопкой.";
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".case").forEach(render);
  });
})();
