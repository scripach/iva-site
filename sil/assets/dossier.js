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
           { "id": "cert1", "gate": "select",  "label": "...", "have": true,
             "ok": true,     // optional: false = документ есть, но не годится
             "short": "необязательно: подпись в выводе, если label длинный",
             "note": "что этот документ реально даёт" },
           ...
         ],
         "gates": [
           { "id": "select", "label": "Выбор компонента",
             "ref": "п. 11.5.2.1",
             "whenMissing": "..." }
         ],
         "target": { "label": "Целевой SIL функции",
                     "options": [ {"v": 2, "label": "SIL 2"}, ... ] }
       }
       </script>
     </div>

   Model: a gate is closed only when every item mapped to it is both
   present and usable. There is no partial credit — that is the entire
   point of the three gates in lesson 7, and the reason a single missing
   number cannot be compensated by a thick stack of other papers.

   «Usable» matters as much as «present»: a λDU printed in a safety
   manual but contradicted by that same manual's own PFD table does not
   close the number gate. Set "ok": false for a document that exists and
   still cannot be used; the verdict names it as present-but-unfit
   instead of hiding it among the missing ones.

   The widget answers one question an engineer actually asks: «можно ли
   этим комплектом обосновать элемент в функции с целевым SIL n».
   ============================================================ */
(function () {
  "use strict";

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
    data.items.forEach(function (it) { state[it.id] = !!it.have; });

    function usable(it) { return state[it.id] && it.ok !== false; }

    /* ---- controls: one checkbox per document ---- */
    var box = el("div", "lopa-ipls");
    data.items.forEach(function (it) {
      var lab = el("label", "lopa-ipl");
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = state[it.id];
      cb.addEventListener("change", function () {
        state[it.id] = cb.checked;
        recalc();
      });
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(it.label));
      box.appendChild(lab);
    });
    left.appendChild(box);

    /* ---- output ---- */
    var out = el("div", "lopa-out");
    out.setAttribute("aria-live", "polite");
    right.appendChild(out);

    function recalc() {
      out.innerHTML = "";

      var open = [];

      data.gates.forEach(function (g) {
        var own = data.items.filter(function (it) { return it.gate === g.id; });
        var missing = own.filter(function (it) { return !state[it.id]; });
        var unfit = own.filter(function (it) { return state[it.id] && it.ok === false; });
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

        /* One wrapped line per missing item. A three-row block (label,
           value, note) per item made the output column twice the height of
           the checkbox column it explains, so the panel read as a wall of
           text next to five short lines. */
        /* One line per missing item: name, then the reason in the same
           paragraph. Two rows per item (a separate "нет" label and then the
           name again) doubled the height for nothing, and repeating the
           name once per row made a five-line checklist look like a wall. */
        missing.forEach(function (it) {
          var m = el("div", "lopa-line");
          var txt = "нет: " + (it.short || it.label);
          m.appendChild(el("span", "lopa-note-block", it.note ? txt + " — " + it.note : txt));
          out.appendChild(m);
        });
        unfit.forEach(function (it) {
          var m = el("div", "lopa-line");
          var txt = "есть, но не годится: " + (it.short || it.label);
          m.appendChild(el("span", "lopa-note-block", it.note ? txt + " — " + it.note : txt));
          out.appendChild(m);
        });
      });

      var v = el("div", "lopa-line");
      v.appendChild(el("span", "lopa-line-label", "Вердикт"));
      v.appendChild(el("strong", "pfd-verdict " + (open.length ? "bad" : "ok"),
        open.length ? "обосновать нельзя" : "комплект полон"));
      out.appendChild(v);

      var why;
      if (open.length === 0) {
        why = "Все четыре условия выполнены по отдельности и ни одно не подменяет другое. " +
          "Теперь считается PFD и сравнивается с целью из LOPA.";
      } else if (open.length === data.gates.length) {
        why = "Ни одно условие пока не закрыто. Стопка документов с надписью «SIL» " +
          "и числами, которые не сходятся между собой, — это заявка, а не обоснование.";
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
