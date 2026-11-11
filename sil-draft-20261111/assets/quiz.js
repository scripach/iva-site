/* ============================================================
   SIL Course — quiz widget with hint, solution, retry and storage
   Markup:
     <div class="quiz">
       <script type="application/json">
       { "id": "lesson-slug", "title": "...", "questions": [
           { "q": "...",
             "options": ["...", "..."],
             "correct": 0,
             "explain": "...",
             "hint": "...",
             "ref": { "href": "#sec-4", "label": "..." },
             "id": "q-...",
             "version": "..." } ]}
       </script>
     </div>
   States: unanswered -> incorrect (hint, solution closed) -> solution open
           unanswered -> correct (explanation shown)
   Retry resets one question only. Storage is optional: its refusal must not
   stop the quiz. Answers are keyed by question id and content version, never
   by lesson position.
   ============================================================ */
(function () {
  "use strict";

  var LETTERS = ["а", "б", "в", "г", "д"];
  var SCHEMA = 1;
  var KEY_PREFIX = "sil3.quiz.v1:";
  var uidSeq = 0;

  function jsonOf(root) {
    if (root.__quizData !== undefined) return root.__quizData;   /* survives the retry re-render */
    var s = root.querySelector('script[type="application/json"]');
    root.__quizData = s ? JSON.parse(s.textContent) : null;
    if (root.__quizData && Array.isArray(root.__quizData.questions)) {
      root.__quizData.questions.forEach(normalizeQuestion);
    }
    return root.__quizData;
  }

  /* Защита для страниц без полей интерфейса (hint/id/version): вопрос
     деградирует молча и корректно — без "Подсказка: undefined" и без
     коллизий в хранилище. */
  function hashOfString(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i += 1) {
      h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(16);
  }

  function normalizeQuestion(q, i) {
    if (!q || typeof q !== "object") return q;
    if (!q.id) q.id = "q-auto-" + hashOfString(String(q.q || "#" + i));
    if (!q.version) {
      q.version = hashOfString(JSON.stringify([q.q || "", q.correct, q.options || []]));
    }
    return q;
  }

  function quizIdOf(data) {
    if (data.id) return String(data.id);
    if (typeof location !== "undefined" && location.pathname) {
      return location.pathname.split("/").pop().replace(/\.html$/i, "") || "quiz";
    }
    return "quiz";
  }

  function getStorage() {
    try {
      var s = window.localStorage;
      if (!s) return null;
      var probe = KEY_PREFIX + "__probe__";
      s.setItem(probe, "1");
      s.removeItem(probe);
      return s;
    } catch (e) {
      return null;
    }
  }

  function readSaved(store, quizId) {
    if (!store) return {};
    try {
      var raw = store.getItem(KEY_PREFIX + quizId);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.schema !== SCHEMA || !parsed.questions) return {};
      if (typeof parsed.questions !== "object") return {};
      return parsed.questions;
    } catch (e) {
      return {};
    }
  }

  function writeSaved(store, quizId, items) {
    if (!store) return false;
    var questions = {};
    var any = false;
    items.forEach(function (st) {
      if (st.status === "unanswered") return;
      any = true;
      var record = {
        version: st.q.version,
        status: st.status,
        solution: !!st.solutionOpen
      };
      if (
        st.status === "incorrect" &&
        Number.isInteger(st.choice) &&
        st.choice >= 0 &&
        st.choice < st.q.options.length &&
        st.choice !== st.q.correct
      ) {
        record.choice = st.choice;
      }
      questions[st.q.id] = record;
    });
    try {
      var key = KEY_PREFIX + quizId;
      if (!any) {
        store.removeItem(key);
        return true;
      }
      store.setItem(key, JSON.stringify({
        schema: SCHEMA,
        quizId: quizId,
        questions: questions
      }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function setFocus(el) {
    if (el && typeof el.focus === "function") el.focus();
  }

  function render(root) {
    var data = jsonOf(root);
    if (!data) return;
    root.innerHTML = "";
    root.classList.add("widget");

    var uid = "quiz" + (++uidSeq);
    var quizId = quizIdOf(data);
    var store = getStorage();
    var saved = readSaved(store, quizId);
    var state = { answered: 0, score: 0, items: [] };

    root.setAttribute("data-quiz-id", quizId);
    root.setAttribute("data-storage", store ? "available" : "unavailable");

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

    var storageNote = document.createElement("p");
    storageNote.className = "q-storage";
    storageNote.setAttribute("role", "status");
    storageNote.hidden = true;
    root.appendChild(storageNote);

    function storageRefused() {
      if (!storageNote) return;
      storageNote.hidden = false;
      storageNote.textContent =
        "Сохранение ответов в этом браузере недоступно: после перезагрузки они не восстановятся. Проверка работает без сохранения.";
      root.setAttribute("data-storage", "unavailable");
    }

    if (!store) storageRefused();

    function persist() {
      var ok = writeSaved(store, quizId, state.items);
      if (!ok && store) {
        store = null;
        storageRefused();
      }
    }

    data.questions.forEach(function (q, i) {
      var st = {
        q: q,
        index: i,
        status: "unanswered",
        solutionOpen: false,
        choice: null
      };
      state.items.push(st);

      var item = document.createElement("div");
      item.className = "q-item";
      item.setAttribute("data-state", "unanswered");
      item.setAttribute("data-solution", "closed");
      if (q.id) item.setAttribute("data-qid", q.id);

      var text = document.createElement("p");
      text.className = "q-text";
      text.id = uid + "-q-" + (i + 1) + "-text";
      var num = document.createElement("span");
      num.className = "q-num";
      num.textContent = (i + 1) + "/" + data.questions.length;
      text.appendChild(num);
      text.appendChild(document.createTextNode(q.q));
      item.appendChild(text);

      var opts = document.createElement("div");
      opts.className = "q-options";
      opts.setAttribute("role", "group");
      opts.setAttribute("aria-labelledby", text.id);
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

      var stale = document.createElement("p");
      stale.className = "q-stale";
      stale.hidden = true;
      stale.textContent =
        "Сохранённый ответ относится к прежней редакции вопроса и не зачтён.";
      item.appendChild(stale);

      var hint = document.createElement("div");
      hint.className = "q-hint";
      hint.hidden = true;
      hint.setAttribute("aria-live", "polite");
      var hintText = document.createElement("p");
      hintText.className = "q-hint-text";
      hint.appendChild(hintText);
      var hintRef = document.createElement("a");
      hintRef.className = "q-ref";
      hintRef.href = q.ref ? q.ref.href : "#content";
      hintRef.textContent = q.ref ? "Разобрать в уроке: " + q.ref.label : "Разобрать в уроке";
      hint.appendChild(hintRef);
      item.appendChild(hint);

      var actions = document.createElement("div");
      actions.className = "q-actions";
      actions.hidden = true;

      var solutionBtn = document.createElement("button");
      solutionBtn.type = "button";
      solutionBtn.className = "btn q-solution-toggle";
      solutionBtn.textContent = "Показать решение";
      solutionBtn.setAttribute("aria-expanded", "false");
      solutionBtn.setAttribute("aria-controls", uid + "-q-" + (i + 1) + "-solution");
      solutionBtn.addEventListener("click", function () {
        if (st.solutionOpen) closeSolution(st);
        else openSolution(st);
      });
      actions.appendChild(solutionBtn);

      var retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.className = "btn q-retry";
      retryBtn.textContent = "Повторить вопрос";
      retryBtn.addEventListener("click", function () { retry(st); });
      actions.appendChild(retryBtn);
      item.appendChild(actions);

      var solutionEl = document.createElement("div");
      solutionEl.className = "q-explain";
      solutionEl.id = uid + "-q-" + (i + 1) + "-solution";
      solutionEl.hidden = true;
      solutionEl.tabIndex = -1;
      solutionEl.setAttribute("aria-live", "polite");
      var solutionLabel = document.createElement("p");
      solutionLabel.className = "q-explain-label";
      solutionLabel.textContent = "Решение";
      solutionEl.appendChild(solutionLabel);
      var solutionBody = document.createElement("div");
      solutionBody.className = "q-explain-body";
      solutionEl.appendChild(solutionBody);
      var solutionRef = document.createElement("a");
      solutionRef.className = "q-ref";
      solutionRef.href = q.ref ? q.ref.href : "#content";
      solutionRef.textContent = q.ref ? "Разобрать в уроке: " + q.ref.label : "Разобрать в уроке";
      solutionEl.appendChild(solutionRef);
      item.appendChild(solutionEl);

      st.item = item;
      st.options = buttons;
      st.stale = stale;
      st.hint = hint;
      st.hintText = hintText;
      st.actions = actions;
      st.solutionBtn = solutionBtn;
      st.retryBtn = retryBtn;
      st.solutionEl = solutionEl;
      st.solutionBody = solutionBody;

      function resetView() {
        item.setAttribute("data-state", "unanswered");
        item.setAttribute("data-solution", "closed");
        buttons.forEach(function (b) {
          b.disabled = false;
          b.classList.remove("correct");
          b.classList.remove("incorrect");
          b.classList.remove("reveal");
        });
        stale.hidden = true;
        hint.hidden = true;
        hintText.textContent = "";
        actions.hidden = true;
        solutionBtn.hidden = false;
        solutionBtn.textContent = "Показать решение";
        solutionBtn.setAttribute("aria-expanded", "false");
        solutionEl.hidden = true;
        solutionBody.textContent = "";
        st.solutionOpen = false;
        st.choice = null;
      }

      function markCorrect() {
        st.status = "correct";
        st.choice = null;
        item.setAttribute("data-state", "correct");
        item.setAttribute("data-solution", "closed");
        buttons.forEach(function (b, k) {
          b.disabled = true;
          b.classList.remove("incorrect");
          b.classList.remove("reveal");
          b.classList.remove("correct");
          if (k === q.correct) b.classList.add("correct");
        });
        hint.hidden = true;
        hintText.textContent = "";
        actions.hidden = false;
        solutionBtn.hidden = true;
        solutionEl.hidden = false;
        solutionBody.textContent = "Верно. " + q.explain;
        st.solutionOpen = false;
      }

      function markIncorrect(j) {
        var safe = Number.isInteger(j) && j >= 0 && j < buttons.length && j !== q.correct ? j : -1;
        st.status = "incorrect";
        st.choice = safe >= 0 ? safe : null;
        item.setAttribute("data-state", "incorrect");
        item.setAttribute("data-solution", "closed");
        buttons.forEach(function (b, k) {
          b.disabled = true;
          b.classList.remove("correct");
          b.classList.remove("reveal");
          b.classList.remove("incorrect");
          if (k === safe) b.classList.add("incorrect");
        });
        hint.hidden = false;
        hintText.textContent = q.hint
          ? "Неверно. Подсказка: " + q.hint
          : "Неверно. Сначала попробуйте разбор в уроке — ссылка ниже.";
        actions.hidden = false;
        solutionBtn.hidden = false;
        solutionBtn.textContent = "Показать решение";
        solutionBtn.setAttribute("aria-expanded", "false");
        solutionEl.hidden = true;
        solutionBody.textContent = "";
        st.solutionOpen = false;
      }

      function openSolution(st, save) {
        st.solutionOpen = true;
        item.setAttribute("data-solution", "open");
        buttons.forEach(function (b, k) {
          if (k === q.correct) b.classList.add("reveal");
        });
        solutionEl.hidden = false;
        solutionBody.textContent = q.explain;
        solutionBtn.textContent = "Скрыть решение";
        solutionBtn.setAttribute("aria-expanded", "true");
        if (save !== false) persist();
      }

      function closeSolution(st) {
        st.solutionOpen = false;
        item.setAttribute("data-solution", "closed");
        buttons.forEach(function (b, k) {
          if (k === q.correct) b.classList.remove("reveal");
        });
        solutionEl.hidden = true;
        solutionBody.textContent = "";
        solutionBtn.textContent = "Показать решение";
        solutionBtn.setAttribute("aria-expanded", "false");
        persist();
      }

      function answer(j) {
        if (st.status !== "unanswered") return;
        var ok = j === q.correct;
        st.status = ok ? "correct" : "incorrect";
        state.answered += 1;
        if (ok) state.score += 1;
        if (ok) {
          markCorrect();
          if (typeof solutionEl.focus === "function") solutionEl.focus();
        } else {
          markIncorrect(j);
          setFocus(solutionBtn);
        }
        persist();
        maybeFinish();
      }

      function retry(st) {
        if (st.status === "unanswered") return;
        if (st.status === "correct") state.score -= 1;
        state.answered -= 1;
        st.status = "unanswered";
        resetView();
        persist();
        hideFinish();
        setFocus(buttons[0]);
      }

      st.resetView = resetView;
      st.applySaved = function (rec) {
        if (!rec || rec.status === "unanswered") return false;
        if (rec.version !== q.version) {
          stale.hidden = false;
          return false;
        }
        if (rec.status === "correct") {
          markCorrect();
          return true;
        }
        if (rec.status === "incorrect") {
          markIncorrect(rec.choice);
          if (rec.solution) openSolution(st, false);
          return true;
        }
        return false;
      };

      item.__quizState = st;
      root.appendChild(item);
    });

    var result = document.createElement("div");
    result.className = "q-result";
    result.setAttribute("aria-live", "polite");
    root.appendChild(result);

    var resultText = document.createElement("span");
    result.appendChild(resultText);

    var again = document.createElement("button");
    again.type = "button";
    again.className = "btn";
    again.textContent = "Пройти весь тест заново";
    again.addEventListener("click", function () {
      try {
        if (store) store.removeItem(KEY_PREFIX + quizId);
      } catch (e) { /* storage refusal must not stop the reset */ }
      render(root);
      if (root.scrollIntoView) root.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    result.appendChild(again);

    function maybeFinish() {
      var n = data.questions.length;
      if (state.answered !== n) {
        result.hidden = true;
        return;
      }
      var s = state.score;
      var msg;
      if (s === n) msg = "Идеально: " + s + " из " + n + ". Можно идти дальше.";
      else if (s >= Math.ceil(n * 0.7)) msg = "Хорошо: " + s + " из " + n + ". Откройте решения к ошибкам.";
      else msg = s + " из " + n + ". Стоит перечитать урок и пройти проверку снова.";
      resultText.textContent = msg + " ";
      result.hidden = false;
    }

    function hideFinish() {
      result.hidden = true;
    }

    var restored = 0;
    state.items.forEach(function (st) {
      var rec = saved[st.q.id];
      if (st.applySaved(rec)) restored += 1;
    });
    state.items.forEach(function (st) {
      if (st.status === "correct") state.score += 1;
      if (st.status !== "unanswered") state.answered += 1;
    });
    root.setAttribute("data-restored", String(restored));
    maybeFinish();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".quiz").forEach(render);
  });
})();
