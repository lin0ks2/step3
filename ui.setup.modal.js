/* ui.setup.modal.js — единая и безопасная инициализация языка в мастере
   Логика:
   - читаем язык из localStorage (если есть)
   - иначе берём язык устройства (ru/uk), прочие → DEFAULT_FALLBACK_LANG
   - выставляем App.settings.uiLang и шлём событие 'lexitron:ui-lang-changed'
   - вешаем обработчики на элементы выбора языка, если они есть (не обязательно)
*/
;(function () {
  'use strict';

  var DEFAULT_FALLBACK_LANG = 'uk';

  var App = (window.App = window.App || {});
  App.settings = App.settings || {};

  var LS_KEY = 'lexitron.uiLang';

  function clampLang(code) {
    try {
      var c = String(code || '').toLowerCase();
      if (c.startsWith('ru')) return 'ru';
      if (c.startsWith('uk') || c.startsWith('ua')) return 'uk';
      return DEFAULT_FALLBACK_LANG;
    } catch (_) {
      return DEFAULT_FALLBACK_LANG;
    }
  }

  function getSavedLang() {
    try {
      var v = localStorage.getItem(LS_KEY);
      return v ? clampLang(v) : null;
    } catch (_) {
      return null;
    }
  }

  function detectDeviceLang() {
    try {
      var nav = navigator || {};
      var cand =
        (nav.languages && nav.languages[0]) ||
        nav.language ||
        nav.userLanguage ||
        nav.browserLanguage ||
        '';
      return clampLang(cand);
    } catch (_) {
      return DEFAULT_FALLBACK_LANG;
    }
  }

  function dispatchLangChanged(lang) {
    try {
      var ev = new CustomEvent('lexitron:ui-lang-changed', { detail: { lang: lang } });
      document.dispatchEvent(ev);
    } catch (_) {}
  }

  function setLang(lang) {
    var clamped = clampLang(lang);
    App.settings.uiLang = clamped;
    try { localStorage.setItem(LS_KEY, clamped); } catch (_) {}
    dispatchLangChanged(clamped);
    return clamped;
  }

  App.setUiLang = setLang;

  (function initOnce() {
    try {
      if (window.__lex_setup_lang_inited) return;
      window.__lex_setup_lang_inited = true;

      var initial =
        getSavedLang() ||
        detectDeviceLang() ||
        DEFAULT_FALLBACK_LANG;

      if (App.settings.uiLang !== initial) setLang(initial);
      else dispatchLangChanged(initial);

      document.querySelectorAll('[data-lex-lang]').forEach(function (el) {
        el.addEventListener('click', function (e) {
          try { e.preventDefault(); } catch (_) {}
          var lang = el.getAttribute('data-lex-lang');
          setLang(lang);
        }, { passive: true });
      });

      var sel = document.getElementById('setupLang');
      if (sel) {
        try { sel.value = App.settings.uiLang; } catch (_) {}
        sel.addEventListener('change', function () {
          setLang(sel.value);
        }, { passive: true });
      }
    } catch (_) {}
  })();
})();