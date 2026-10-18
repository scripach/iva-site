/* ============================================================
   SIL Course — ordering widget ("collect the sequence")
   Markup:
     <div class="order">
       <script type="application/json">
       { "instruction": "...",
         "items": [ {"label": "...", "note": "..."} ] }
       </script>
     </div>
   Items are authored in the CORRECT order; display is shuffled.
   Learner clicks items in the order they believe correct:
   - right click  -> item locks into the sequence (green)
   - wrong click  -> shake + hint which item was expected,
                     sequence resets to try again
   ============================================================ */
(function () {
  "use strict";

  function jsonOf(root) {
    var s = root.querySelector('script[type="application/json"]');
    return s ? JSON.parse(s.textContent) : null;
  }

  function shuffle(a) {
    var arr = a.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function render(root) {
    var data = jsonOf(root);
    if (!data) return;
    var correct = data.items;           // authored order == correct order
    root.innerHTML = "";
    root.classList.add("widget");

    var title = document.createElement("p");
    title.className = "widget-title";
    title.textContent = data.title || "Соберите последовательность";
    root.appendChild(title);

    var ins = document.createElement("p");
    ins.className = "instruction";
    ins.textContent = data.instruction;
    root.appendChild(ins);

    var pool = document.createElement("div");
    pool.className = "order-pool";
    root.appendChild(pool);

    var fb = document.createElement("p");
    fb.className = "order-feedback";
    fb.setAttribute("role", "status");
    root.appendChild(fb);

    var resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "btn";
    resetBtn.textContent = "Начать заново";
    resetBtn.style.display = "none";
    root.appendChild(resetBtn);

    var pos = 0;                        // next expected index
    var buttons = [];

    function say(text, cls) {
      fb.textContent = text;
      fb.className = "order-feedback" + (cls ? " " + cls : "");
    }

    function build() {
      pos = 0;
      say("");
      resetBtn.style.display = "none";
      pool.innerHTML = "";
      buttons = [];
      shuffle(correct.map(function (it, i) { return { it: it, i: i }; }))
        .forEach(function (entry) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "order-slot";
          var num = document.createElement("span");
          num.className = "num";
          num.textContent = "?";
          b.appendChild(num);
          var label = document.createElement("span");
          label.textContent = entry.it.label;
          b.appendChild(label);
          if (entry.it.note) b.title = entry.it.note;
          b.addEventListener("click", function () { pick(entry.i, b); });
          pool.appendChild(b);
          buttons.push({ el: b, i: entry.i });
        });
    }

    function pick(i, el) {
      if (el.disabled) return;
      if (i === pos) {
        el.disabled = true;
        el.classList.add("done");
        el.querySelector(".num").textContent = String(pos + 1);
        pos++;
        if (pos === correct.length) {
          say("Верно! Все слои встали на свои места.", "ok");
          resetBtn.style.display = "";
        } else {
          say("Верно. Дальше — «" + correct[pos].label + "»? Выбирайте.", "ok");
        }
      } else {
        el.classList.add("wrong");
        var expected = buttons.filter(function (b) { return b.i === pos; })[0];
        if (expected) expected.el.classList.add("hint");
        say("Не тот слой. Под номером " + (pos + 1) + " должно быть: «" +
            correct[pos].label + "» — " + (correct[pos].note || "") + " Начинаем заново.", "bad");
        pool.querySelectorAll(".order-slot").forEach(function (b) { b.disabled = true; });
        resetBtn.style.display = "";
      }
    }

    resetBtn.addEventListener("click", build);
    build();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".order").forEach(render);
  });
})();
