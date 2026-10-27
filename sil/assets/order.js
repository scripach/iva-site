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
   - right click  -> item locks into the sequence (green), only the
                     number of remaining steps is reported; the next
                     item is NOT named
   - wrong click  -> sequence resets; first miss gives no answer at
                     all, from the second miss the expected item is
                     named (without its note)
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
    var miss = 0;                       // wrong picks in this run; reset only on full pass
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
          miss = 0;
        } else {
          say("Верно. Шагов осталось: " + (correct.length - pos) + ".", "ok");
        }
      } else {
        el.classList.add("wrong");
        miss++;
        pool.querySelectorAll(".order-slot").forEach(function (b) { b.disabled = true; });
        if (miss === 1) {
          say("Не тот слой. Порядок сбрасывается — попробуйте снова.", "bad");
        } else {
          var expected = buttons.filter(function (b) { return b.i === pos; })[0];
          if (expected) expected.el.classList.add("hint");
          say("Не тот слой. Под номером " + (pos + 1) + " должно быть: «" +
              correct[pos].label + "». Начинаем заново.", "bad");
        }
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
