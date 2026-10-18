/* ============================================================
   SIL Course — two-bucket classification widget
   Root div has class "sort" only; other widgets leave it alone.

   Markup:
     <div class="sort">
       <script type="application/json">
       {
         "title": "...", "instruction": "...",
         "buckets": [
           { "id": "random",     "label": "Случайный отказ — оценивают расчётом PFD",
             "short": "Случайный · PFD" },
           { "id": "systematic", "label": "Систематический отказ — закрывают процессом",
             "short": "Систематический · процесс" }
         ],
         "items": [
           { "text": "...", "bucket": "random", "explain": "..." }
         ]
       }
       </script>
     </div>

   Behaviour: every item shows one button per bucket. A click is judged
   at once — right button turns green, a wrong one red and the correct
   bucket is revealed; the explanation opens either way. Items already
   answered stay locked. Summary counts appear when the last item is
   answered; "Пройти ещё раз" re-renders from the cached JSON.
   Print: buttons and summary disappear, the correct bucket stays.
   ============================================================ */
(function () {
  "use strict";

  function jsonOf(root) {
    if (root.__sortData !== undefined) return root.__sortData;   /* survives the retry re-render */
    var s = root.querySelector('script[type="application/json"]');
    root.__sortData = s ? JSON.parse(s.textContent) : null;
    return root.__sortData;
  }

  function render(root) {
    var data = jsonOf(root);
    if (!data) return;
    root.innerHTML = "";
    root.classList.add("widget");

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

    var byId = {};
    data.buckets.forEach(function (b) { byId[b.id] = b; });

    var list = document.createElement("div");
    list.className = "sort-list";
    root.appendChild(list);

    var state = { answered: 0, score: 0 };

    data.items.forEach(function (item, i) {
      var wrap = document.createElement("div");
      wrap.className = "sort-item";

      var text = document.createElement("p");
      text.className = "sort-text";
      var num = document.createElement("span");
      num.className = "sort-num";
      num.textContent = (i + 1) + "/" + data.items.length;
      text.appendChild(num);
      text.appendChild(document.createTextNode(item.text));
      wrap.appendChild(text);

      var choices = document.createElement("div");
      choices.className = "sort-choices";
      var buttons = [];
      data.buckets.forEach(function (b) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sort-choice";
        btn.textContent = b.short || b.label;
        btn.addEventListener("click", function () { answer(b.id); });
        choices.appendChild(btn);
        buttons.push({ el: btn, id: b.id });
      });
      wrap.appendChild(choices);

      var answerLine = document.createElement("span");
      answerLine.className = "sort-answer";
      answerLine.textContent = "→ " + (byId[item.bucket] || {}).label;
      choices.appendChild(answerLine);

      var ex = document.createElement("div");
      ex.className = "sort-explain";
      ex.setAttribute("aria-live", "polite");
      ex.textContent = item.explain || "";
      wrap.appendChild(ex);

      function answer(id) {
        if (wrap.__answered) return;
        wrap.__answered = true;
        state.answered++;
        var ok = id === item.bucket;
        if (ok) state.score++;
        buttons.forEach(function (b) {
          b.el.disabled = true;
          if (b.id === item.bucket) b.el.classList.add("ok");
          else if (b.id === id) b.el.classList.add("bad");
        });
        ex.textContent = (ok ? "Верно. " : "Неверно. ") + (item.explain || "");
        ex.classList.add("shown");
        if (state.answered === data.items.length) finish();
      }

      list.appendChild(wrap);
    });

    var result = document.createElement("div");
    result.className = "sort-result";
    result.setAttribute("aria-live", "polite");
    root.appendChild(result);

    function finish() {
      var n = data.items.length;
      var s = state.score;
      var msg;
      if (s === n) msg = "Все " + s + " разобраны верно: граница «расчёт против процесса» держится.";
      else if (s >= Math.ceil(n * 0.7)) msg = s + " из " + n + ". Перечитайте разбор ошибок — это тот же признак, что и в жизни.";
      else msg = s + " из " + n + ". Вернитесь к §1: случайный отказ предсказуем статистически, систематический — нет.";
      result.textContent = msg;
      result.classList.add("shown");

      var again = document.createElement("button");
      again.type = "button";
      again.className = "btn";
      again.style.marginLeft = "0.8rem";
      again.textContent = "Пройти ещё раз";
      again.addEventListener("click", function () {
        render(root);
        if (root.scrollIntoView) root.scrollIntoView({ block: "start", behavior: "smooth" });
      });
      result.appendChild(document.createTextNode(" "));
      result.appendChild(again);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".sort").forEach(render);
  });
})();
