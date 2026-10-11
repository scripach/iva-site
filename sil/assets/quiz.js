/* ============================================================
   SIL Course — quiz widget
   Markup:
     <div class="quiz">
       <script type="application/json">
       { "title": "...", "questions": [
           { "q": "...",
             "options": ["...", "..."],
             "correct": 0,
             "explain": "..." } ]}
       </script>
     </div>
   Immediate feedback per question; score summary at the end.
   Authoring rule: all options in a question are the same length.
   ============================================================ */
(function () {
  "use strict";

  function jsonOf(root) {
    var s = root.querySelector('script[type="application/json"]');
    return s ? JSON.parse(s.textContent) : null;
  }

  var LETTERS = ["а", "б", "в", "г", "д"];

  function render(root) {
    var data = jsonOf(root);
    if (!data) return;
    root.innerHTML = "";

    if (data.title) {
      var t = document.createElement("p");
      t.className = "widget-title";
      t.textContent = data.title;
      root.appendChild(t);
    }
    if (data.instruction) {
      var ins = document.createElement("p");
      ins.className = "instruction";
      ins.textContent = data.instruction;
      root.appendChild(ins);
    }

    var state = { answered: 0, score: 0 };
    var items = [];

    data.questions.forEach(function (q, i) {
      var item = document.createElement("div");
      item.className = "q-item";

      var text = document.createElement("p");
      text.className = "q-text";
      var num = document.createElement("span");
      num.className = "q-num";
      num.textContent = (i + 1) + "/" + data.questions.length;
      text.appendChild(num);
      text.appendChild(document.createTextNode(q.q));
      item.appendChild(text);

      var opts = document.createElement("div");
      opts.className = "q-options";
      var buttons = [];

      q.options.forEach(function (opt, j) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "q-opt";
        var letter = document.createElement("span");
        letter.className = "letter";
        letter.textContent = LETTERS[j] + ")";
        b.appendChild(letter);
        b.appendChild(document.createTextNode(opt));
        b.addEventListener("click", function () { answer(j); });
        opts.appendChild(b);
        buttons.push(b);
      });
      item.appendChild(opts);

      var ex = document.createElement("div");
      ex.className = "q-explain";
      item.appendChild(ex);

      function answer(j) {
        if (state.answeredPer && state.answeredPer[i]) return;
        state.answeredPer = state.answeredPer || {};
        state.answeredPer[i] = true;
        state.answered++;
        var ok = j === q.correct;
        if (ok) state.score++;
        buttons.forEach(function (b, k) {
          b.disabled = true;
          if (k === q.correct) b.classList.add(ok ? "correct" : "reveal");
          if (k === j && !ok) b.classList.add("incorrect");
        });
        ex.textContent = (ok ? "Верно. " : "Неверно. ") + q.explain;
        ex.classList.add("shown");
        if (state.answered === data.questions.length) finish();
      }

      root.appendChild(item);
      items.push(item);
    });

    var result = document.createElement("div");
    result.className = "q-result";
    root.appendChild(result);

    function finish() {
      var n = data.questions.length;
      var s = state.score;
      var msg;
      if (s === n) msg = "Идеально: " + s + " из " + n + ". Можно идти дальше.";
      else if (s >= Math.ceil(n * 0.7)) msg = "Хорошо: " + s + " из " + n + ". Перечитайте пояснения к ошибкам.";
      else msg = s + " из " + n + ". Стоит перечитать урок и пройти проверку снова.";
      result.textContent = msg;
      result.classList.add("shown");

      var again = document.createElement("button");
      again.type = "button";
      again.className = "btn";
      again.style.marginLeft = "0.8rem";
      again.textContent = "Пройти ещё раз";
      again.addEventListener("click", function () { render(root); });
      result.appendChild(document.createTextNode(" "));
      result.appendChild(again);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".quiz").forEach(render);
  });
})();
