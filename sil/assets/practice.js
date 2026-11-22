/* ============================================================
   SIL Course — applied practice widget (task 29)
   Markup:
     <div class="practice">
       <script type="application/json">
       { "title": "...", "instruction": "...",
         "rows": [
           { "id": "matrix",
             "prompt": "...",
             "label": "Выход 2oo3 и следующее действие",
             "options": [
               { "text": "...", "feedback": "..." },
               { "text": "...", "correct": true, "feedback": "..." } ] } ] }
       </script>
     </div>
   The reader fills each row with a select and checks the whole fragment at
   once. A wrong choice shows the feedback written for that choice, so the
   explanation names the actual mistake (quorum, missed delay, FAT/validation,
   evidence of a stroke test) instead of a generic "wrong".
   Retry is allowed: changing a select clears that row's verdict.
   ============================================================ */
(function () {
  "use strict";

  function jsonOf(root) {
    if (root.__practiceData !== undefined) return root.__practiceData;
    var s = root.querySelector('script[type="application/json"]');
    root.__practiceData = s ? JSON.parse(s.textContent) : null;
    return root.__practiceData;
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function render(root) {
    var data = jsonOf(root);
    if (!data) return;
    root.innerHTML = "";
    root.classList.add("practice-ready");

    if (data.title) root.appendChild(el("p", "practice-title", data.title));
    if (data.instruction) root.appendChild(el("p", "instruction", data.instruction));

    var answered = [];
    var rows = data.rows || [];

    rows.forEach(function (row, i) {
      var item = el("div", "practice-item");
      var prompt = el("p", "practice-prompt");
      var num = el("span", "practice-num", (i + 1) + "/" + rows.length);
      prompt.appendChild(num);
      prompt.appendChild(document.createTextNode(row.prompt));
      item.appendChild(prompt);

      var label = el("label", "practice-label", row.label || "Выберите вариант");
      var id = "practice-" + (row.id || i);
      label.setAttribute("for", id);
      item.appendChild(label);

      var select = document.createElement("select");
      select.className = "practice-select";
      select.id = id;
      var blank = el("option", "", "— выберите —");
      blank.value = "";
      select.appendChild(blank);
      (row.options || []).forEach(function (opt, j) {
        var option = el("option", "", opt.text);
        option.value = String(j);
        select.appendChild(option);
      });
      item.appendChild(select);

      var feedback = el("div", "practice-feedback");
      feedback.setAttribute("aria-live", "polite");
      item.appendChild(feedback);

      select.addEventListener("change", function () {
        answered[i] = false;
        item.classList.remove("is-correct", "is-wrong");
        feedback.textContent = "";
        feedback.classList.remove("shown");
        result.textContent = "";
        result.classList.remove("shown");
      });

      root.appendChild(item);
      answered.push(false);
    });

    var actions = el("div", "practice-actions");
    var check = el("button", "btn", "Проверить");
    check.type = "button";
    actions.appendChild(check);
    root.appendChild(actions);

    var result = el("div", "practice-result");
    result.setAttribute("aria-live", "polite");
    result.setAttribute("tabindex", "-1");
    root.appendChild(result);

    function checkAll() {
      var missing = -1;
      var selects = root.querySelectorAll("select.practice-select");
      for (var i = 0; i < rows.length; i++) {
        if (selects[i].value === "") { missing = i; break; }
      }
      if (missing >= 0) {
        result.textContent = "Выберите вариант в каждой строке: осталось " +
          (rows.length - countChosen(selects)) + ".";
        result.classList.add("shown");
        selects[missing].focus();
        return;
      }

      var correct = 0;
      var firstWrong = -1;
      rows.forEach(function (row, i) {
        var item = root.querySelectorAll(".practice-item")[i];
        var choice = Number(selects[i].value);
        var opt = row.options[choice];
        var feedback = item.querySelector(".practice-feedback");
        var ok = !!opt.correct;
        if (ok) correct++;
        else if (firstWrong < 0) firstWrong = i;
        item.classList.toggle("is-correct", ok);
        item.classList.toggle("is-wrong", !ok);
        feedback.textContent = (ok ? "Верно. " : "Неверно. ") + opt.feedback;
        feedback.classList.add("shown");
        answered[i] = true;
      });

      var n = rows.length;
      if (correct === n) {
        result.textContent = "Верно: " + correct + " из " + n +
          ". Фрагмент заполнен; это учебный результат, а не протокол проверки.";
        result.classList.add("shown");
        result.focus();
      } else {
        result.textContent = "Верно: " + correct + " из " + n +
          ". Исправьте отмеченные строки и нажмите «Проверить» снова.";
        result.classList.add("shown");
        if (firstWrong >= 0) selects[firstWrong].focus();
      }
    }

    function countChosen(selects) {
      var n = 0;
      for (var i = 0; i < selects.length; i++) {
        if (selects[i].value !== "") n++;
      }
      return n;
    }

    check.addEventListener("click", checkAll);
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".practice").forEach(render);
  });
})();
