/* ============================================================
   SIL Course — document-dossier audit widget (lesson 9)
   Root div has class "dossier" only; layout reuses the inner
   .lopa-* class names from course.css (same convention as pfd.js,
   moon.js, shared.js, assemble.js, bypass.js — no CSS duplication,
   other widget roots untouched).

   Markup:
     <div class="dossier">
       <script type="application/json">
       {
         "title": "...", "instruction": "...",
         "items": [
           { "id": "cert", "gate": "select", "label": "...",
             "state": "unfit",           // начальное состояние, см. ниже

             "unfitNote": "...",         // почему имеющийся документ не годится
             "needNote":  "..." },       // что должно быть в годном
           ...
         ],
         "gates": [
           { "id": "select", "label": "Выбор компонента",
             "ref": "п. 11.5.2.1",
             "whenMissing": "что запросить у изготовителя" }
         ]
       }
       </script>
     </div>

   Model: each item has one of three states, and the learner picks it:

     fit    «есть и годится»      — документ закрывает свой гейт
     unfit  «есть, но не годится» — документ есть, требованиям не отвечает
     none   «нет документа»       — его нет вовсе

   Three states, not two, because the difference between an absent
   document and a present-but-unfit one is the whole point of the audit:
   they are different entries in the justification, and only the second
   one can sometimes be repaired by a letter to the supplier.

   A gate is closed only when every item mapped to it is «есть и годится».
   There is no partial credit — the three gates of lesson 7 hold that a
   thick stack of other papers cannot compensate for one missing number.

   Early versions had a boolean pair ("have" + "ok") in the data, with
   "ok": false written in by the author. Ticking every box then still read
   the verdict «обосновать нельзя», because the learner was not answering
   about their dossier at all — the file already carried the answer about
   the specific relay. A widget whose control cannot change its outcome
   teaches the opposite of what it shows, and the state «комплект полон»
   was unreachable by construction. The current model lets the learner
   reach both verdicts and see which document flips the result.
   ============================================================ */
(function () {
  "use strict";

  /* Order matters: «есть и годится» first so a fresh item with no default
     starts on the only state that closes its gate — never on a state the
     learner did not choose. */
  var STATES = [
    { v: "fit", label: "есть и годится", note: "есть и годится" },
    { v: "unfit", label: "есть, но не годится", note: "есть, но не годится" },
    { v: "none", label: "нет документа", note: "нет" }
  ];

  function stateOf(v) {
    for (var i = 0; i < STATES.length; i++) if (STATES[i].v === v) return STATES[i];
    return STATES[2];
  }

  function jsonOf(root) {
    var s = root.querySelector('script[type="application/json"]');
    return s ? JSON.parse(s.textContent) : null;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function render(root) {
    var data = jsonOf(root);
    if (!data) return;

    root.innerHTML = "";
    root.classList.add("widget");

    if (data.title) root.appendChild(el("p", "widget-title", data.title));
    if (data.instruction) root.appendChild(el("p", "instruction", data.instruction));

    var grid = el("div", "lopa-grid");
    var left = el("div");
    var right = el("div");
    grid.appendChild(left);
    grid.appendChild(right);
    root.appendChild(grid);

    var state = {};
    data.items.forEach(function (it) { state[it.id] = it.state || "fit"; });

    /* ---- controls: one three-state choice per document ---- */
    var box = el("div", "lopa-ipls");
    var stateSpans = {};

    data.items.forEach(function (it) {
      var wrap = el("div", "dossier-item");
      wrap.appendChild(el("span", "dossier-label", it.label));

      var s = el("select", "lopa-select");
      s.setAttribute("aria-label", it.label);
      STATES.forEach(function (st) {
        var op = el("option", null, st.label);
        op.value = st.v;
        if (st.v === state[it.id]) op.selected = true;
        s.appendChild(op);
      });
      s.addEventListener("change", function () {
        state[it.id] = s.value;
        recalc();
      });
      wrap.appendChild(s);

      /* Printed sheet has no controls, so the chosen state is written out
         as text. On screen the select already says it; showing both would
         be the same content twice. */
      var text = el("span", "dossier-state", "");
      stateSpans[it.id] = text;
      wrap.appendChild(text);

      box.appendChild(wrap);
    });
    left.appendChild(box);

    /* ---- output ---- */
    var out = el("div", "lopa-out");
    out.setAttribute("aria-live", "polite");
    right.appendChild(out);

    function recalc() {
      out.innerHTML = "";

      data.items.forEach(function (it) {
        if (stateSpans[it.id]) {
          stateSpans[it.id].textContent = stateOf(state[it.id]).note;
        }
      });

      var open = [];

      data.gates.forEach(function (g) {
        var own = data.items.filter(function (it) { return it.gate === g.id; });
        var missing = own.filter(function (it) { return state[it.id] === "none"; });
        var unfit = own.filter(function (it) { return state[it.id] === "unfit"; });
        var closed = own.length > 0 && missing.length === 0 && unfit.length === 0;
        if (!closed) open.push(g);

        var d = el("div", "lopa-line");
        d.appendChild(el("span", "lopa-line-label", g.label + " · " + g.ref));
        d.appendChild(el("strong",
          closed ? "lopa-sil" : "pfd-verdict bad",
          closed ? "закрыт" : "не закрыт"));
        if (closed) {
          d.appendChild(el("span", "lopa-note", own.length +
            (own.length === 1 ? " документ" : " документа")));
        }
        out.appendChild(d);

        unfit.forEach(function (it) {
          var m = el("div", "lopa-line");
          var txt = "есть, но не годится: " + (it.short || it.label);
          m.appendChild(el("span", "lopa-note-block",
            it.unfitNote ? txt + " — " + it.unfitNote : txt));
          out.appendChild(m);
        });
        missing.forEach(function (it) {
          var m = el("div", "lopa-line");
          var txt = "нет: " + (it.short || it.label);
          m.appendChild(el("span", "lopa-note-block",
            it.needNote ? txt + " — " + it.needNote : txt));
          out.appendChild(m);
        });

        /* What to ask for. Placed under the item list rather than in it: the
           same sentence serves every item of the gate that is still open. */
        if (!closed && g.whenMissing) {
          var a = el("div", "lopa-line");
          a.appendChild(el("span", "lopa-note-block", "Что нужно: " + g.whenMissing));
          out.appendChild(a);
        }
      });

      var v = el("div", "lopa-line");
      v.appendChild(el("span", "lopa-line-label", "Вердикт"));
      v.appendChild(el("strong", "pfd-verdict " + (open.length ? "bad" : "ok"),
        open.length ? "обосновать нельзя" : "комплект полон"));
      out.appendChild(v);

      /* The explanation must follow what is actually in the dossier, not the
         gate count. «Ни одно условие не закрыто» is true in two quite
         different dossiers — one empty, one stuffed with papers that do not
         qualify — and the same sentence would misdescribe the first. */
      var nUnfit = 0, nNone = 0;
      data.items.forEach(function (it) {
        if (state[it.id] === "unfit") nUnfit++;
        else if (state[it.id] === "none") nNone++;
      });

      var why;
      if (open.length === 0) {
        why = "Все четыре условия выполнены по отдельности, и ни одно не подменяет другое. " +
          "Теперь считается PFD и сравнивается с целью из LOPA.";
      } else if (nNone === 0) {
        why = "Все документы комплекта на месте, но часть из них требованию не отвечает: " +
          "обоснование держится на самом слабом звене. Строки «есть, но не годится» " +
          "закрывает письмо изготовителю или замена изделия, а не ещё одна папка.";
      } else if (nNone === data.items.length) {
        why = "Ни одного документа из комплекта нет. Считать нечего, пока изготовитель " +
          "не пришлёт документы, а TI, MTTR и β не появятся из вашего объекта.";
      } else if (nUnfit === 0) {
        why = "Документов нет: " + nNone + " из " + data.items.length + "; " +
          (data.items.length - nNone) + " уже на месте. Обоснование держится на отсутствующих.";
      } else {
        why = "Открыто " + open.length + " из " + data.gates.length +
          ": обоснование держится на самом слабом звене, а не на числе закрытых. " +
          "Документ, который есть, но не годится, закрывает гейт не лучше отсутствующего.";
      }
      out.appendChild(el("span", "lopa-note-block", why));
    }

    recalc();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".dossier").forEach(render);
  });
})();
