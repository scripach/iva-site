/* ============================================================
   nav.js — навигация по курсу для уроков и справочников

   Каждая страница объявляет своё место атрибутами на <body>:

     <body data-page="lesson" data-slug="0001-first-launch-with-gost-template">
     <body data-page="reference" data-slug="glossary">
     <body data-page="index">   (ничего не вставляет)

   Названия и порядок уроков берутся из assets/manifest.js
   (генерируется скриптом build_course.py). Панель вставляется
   в начало и в конец страницы — разметку не дублируем.

   Скрипт подключается ПОСЛЕ manifest.js.
   ============================================================ */
(function () {
  'use strict';

  var CSS = `
  .coursenav {
    font-family: var(--sans, system-ui, sans-serif);
    font-size: .84rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: .5rem 1.1rem;
    margin: 0 0 1.9rem;
    padding-bottom: .9rem;
    border-bottom: 1px solid var(--rule, #d8dce2);
  }
  .coursenav.bottom {
    margin: 2.8rem 0 0;
    padding: .95rem 0 0;
    border-bottom: 0;
    border-top: 1px solid var(--rule, #d8dce2);
  }
  .coursenav a {
    color: var(--accent-2, #1f5f6b);
    text-decoration: none;
    border-bottom: 1px dotted transparent;
    padding: .1rem 0;
  }
  .coursenav a:hover { border-bottom-color: currentColor; }
  .coursenav .toc { font-weight: 650; color: var(--ink, #16181d); white-space: nowrap; }
  .coursenav .toc::before {
    content: "≡";
    margin-right: .4rem;
    color: var(--accent, #8a4b12);
    font-weight: 400;
  }
  .coursenav .spacer { flex: 1 1 auto; }
  .coursenav .step {
    color: var(--ink-faint, #767d87);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .coursenav .arrow { color: var(--ink-faint, #767d87); margin: 0 .25rem; }
  .coursenav .disabled {
    color: var(--ink-faint, #767d87);
    opacity: .5;
    cursor: default;
    white-space: nowrap;
  }
  .coursenav .pn { white-space: nowrap; max-width: 34ch; overflow: hidden;
                   text-overflow: ellipsis; display: inline-block; vertical-align: bottom; }

  /* ряд ссылок на справочники — под основной строкой навигации */
  .coursenav .refs {
    flex: 1 0 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: .3rem .85rem;
    margin-top: .55rem;
    padding-top: .55rem;
    border-top: 1px dotted var(--rule, #d8dce2);
  }
  .coursenav.bottom .refs {
    margin-top: .55rem;
    padding-top: 0;
    border-top: 0;
  }
  .coursenav .refs .refs-label {
    color: var(--ink-faint, #767d87);
    font-size: .76rem;
    letter-spacing: .04em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .coursenav .refs a {
    font-size: .82rem;
    white-space: nowrap;
  }
  .coursenav .refs a::before {
    content: "§";
    color: var(--accent, #8a4b12);
    margin-right: .28rem;
    font-weight: 400;
  }
  `;

  function addStyle() {
    var s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function navLink(href, label, cls) {
    var a = document.createElement('a');
    a.href = href;
    if (cls) a.className = cls;
    a.appendChild(document.createTextNode(label));
    return a;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /**
   * Возвращает ссылки на справочники, которые реально упомянуты в тексте
   * страницы: ищем в ссылках на reference/*.html. Порядок — как в манифесте.
   */
  function mentionedRefs(page, slug) {
    var all = (window.COURSE_MANIFEST || {}).references || [];
    if (!all.length) return [];

    var seen = {};
    // ссылки из текста страницы: и «../reference/x.html», и «x.html» внутри справочника
    var links = document.querySelectorAll(
      '.wrap a[href*="reference/"], .reflinks a[href$=".html"]'
    );
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      var m = /(?:^|\/)reference\/([A-Za-z0-9_-]+)\.html/.exec(href)
           || /^([A-Za-z0-9_-]+)\.html$/.exec(href);
      if (!m) continue;
      // на странице справочника не ссылаемся на себя
      if (page === 'reference' && m[1] === slug) continue;
      seen[m[1]] = true;
    }

    var out = [];
    for (var j = 0; j < all.length; j++) {
      if (seen[all[j].slug]) {
        out.push(all[j]);
        delete seen[all[j].slug];
      }
    }
    return out;
  }

  /** Добавляет ряд ссылок на справочники внутрь панели навигации. */
  var currentSlug = '';

  function appendRefs(nav, page) {
    var refs = mentionedRefs(page, page === 'reference' ? currentSlug : '');
    if (!refs.length) return;

    var row = el('div', 'refs');
    row.appendChild(el('span', 'refs-label', 'Справочники'));

    for (var i = 0; i < refs.length; i++) {
      var href = (page === 'lesson' ? '../reference/' : '') + refs[i].slug + '.html';
      var a = navLink(href, refs[i].title);
      if (refs[i].sub) a.title = refs[i].sub;
      row.appendChild(a);
    }
    nav.appendChild(row);
  }

  function build(page, slug) {
    var nav = el('nav', 'coursenav');
    var m = (window.COURSE_MANIFEST || { lessons: [] }).lessons || [];

    // 1. всегда выход в содержание
    nav.appendChild(navLink('../index.html', 'Содержание курса', 'toc'));

    if (page !== 'lesson') {
      appendRefs(nav, page);
      return nav;
    }
    if (!m.length) return nav;

    // 2. позиция в курсе
    var idx = -1;
    for (var i = 0; i < m.length; i++) {
      if (m[i].slug === slug) { idx = i; break; }
    }
    if (idx < 0) {
      appendRefs(nav, page);
      return nav;
    }

    var total = m.length;
    var prev = idx > 0 ? m[idx - 1] : null;
    var next = idx < total - 1 ? m[idx + 1] : null;

    nav.appendChild(el('span', 'spacer'));
    nav.appendChild(el('span', 'step', 'Урок ' + pad(idx + 1) + ' из ' + pad(total)));
    nav.appendChild(el('span', 'spacer'));

    if (prev) {
      nav.appendChild(navLink(
        prev.slug + '.html',
        '← ' + (prev.short || prev.title),
        'pn'
      ));
    } else {
      nav.appendChild(el('span', 'disabled', '← Начало курса'));
    }

    if (next) {
      nav.appendChild(navLink(
        next.slug + '.html',
        (next.short || next.title) + ' →',
        'pn'
      ));
    } else {
      nav.appendChild(el('span', 'disabled', 'Конец курса →'));
    }

    appendRefs(nav, page);
    return nav;
  }

  function renderIndex() {
    var list = document.getElementById('courseList');
    var m = (window.COURSE_MANIFEST || { lessons: [] }).lessons || [];
    if (!list || !m.length) return;

    list.innerHTML = '';
    m.forEach(function (it) {
      var li = document.createElement('li');

      var num = el('span', 'num', 'Урок ' + pad(it.num));
      li.appendChild(num);

      var a = document.createElement('a');
      a.href = 'lessons/' + it.slug + '.html';
      a.textContent = it.title;
      li.appendChild(a);

      if (it.sub) {
        var sub = el('span', 'sub', it.sub);
        li.appendChild(sub);
      }

      list.appendChild(li);
    });
  }

  function init() {
    var page = document.body.dataset.page;
    if (page === 'index') {
      renderIndex();
      return;
    }
    if (!page) return;

    var slug = document.body.dataset.slug || '';
    currentSlug = slug;
    addStyle();

    var wrap = document.querySelector('.wrap');
    if (!wrap) return;

    // верхняя панель — после шапки
    var header = wrap.querySelector('header.lesson-head');
    var top = build(page, slug);
    if (header) {
      header.parentNode.insertBefore(top, header.nextSibling);
    } else {
      wrap.insertBefore(top, wrap.firstChild);
    }

    // нижняя панель — в конец
    var bottom = build(page, slug);
    bottom.classList.add('bottom');
    wrap.appendChild(bottom);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
