/* ui.setup.modal.js — master fix: show wizard on first run without blocking it.
   Behavior:
   - Detects device lang (ru/uk, else uk) but DOES NOT mark setup as done.
   - Shows setup wizard unless localStorage['lexitron.setup.done'] === 'true'.
   - Provides handlers for [data-lex-lang] and #setupLang to switch preview lang.
   - Marks setup done only when user clicks elements with [data-setup-finish] or #setupFinish.
*/
;(function () {
  'use strict';

  var DEFAULT_FALLBACK_LANG = 'uk';
  var LS_KEY_LANG  = 'lexitron.uiLang';
  var LS_KEY_DONE  = 'lexitron.setup.done';

  var App = (window.App = window.App || {});
  App.settings = App.settings || {};

  function clampLang(code) {
    try {
      var c = String(code || '').toLowerCase();
      if (c.startsWith('ru')) return 'ru';
      if (c.startsWith('uk') || c.startsWith('ua')) return 'uk';
      return DEFAULT_FALLBACK_LANG;
    } catch (_) { return DEFAULT_FALLBACK_LANG; }
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
    } catch (_) { return DEFAULT_FALLBACK_LANG; }
  }

  function dispatchLangChanged(lang) {
    try { document.dispatchEvent(new CustomEvent('lexitron:ui-lang-changed', { detail: { lang: lang } })); } catch (_) {}
  }

  function setPreviewLang(lang) {
    var L = clampLang(lang);
    App.settings.uiLang = L;
    dispatchLangChanged(L);
    return L;
  }

  function persistLang(lang) {
    var L = clampLang(lang);
    try { localStorage.setItem(LS_KEY_LANG, L); } catch (_) {}
    return L;
  }

  function isSetupDone() {
    try { return localStorage.getItem(LS_KEY_DONE) === 'true'; } catch (_) { return false; }
  }

  function markSetupDone() {
    try { localStorage.setItem(LS_KEY_DONE, 'true'); } catch (_) {}
  }

  function getSavedLang() {
    try { return localStorage.getItem(LS_KEY_LANG); } catch (_) { return null; }
  }

  function openWizardIfNeeded() {
    // Show wizard when not done (regardless of saved lang)
    if (isSetupDone()) return false;
    var modal = document.getElementById('setupModal');
    if (!modal) return false;
    try { modal.classList.remove('hidden'); } catch (_) {}
    return true;
  }

  function attachWizardHandlers() {
    // Language switches inside wizard
    document.querySelectorAll('[data-lex-lang]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        try { e.preventDefault(); } catch (_) {}
        var lang = el.getAttribute('data-lex-lang');
        setPreviewLang(lang);
      }, { passive: true });
    });

    var sel = document.getElementById('setupLang');
    if (sel) {
      try { sel.value = App.settings.uiLang; } catch (_) {}
      sel.addEventListener('change', function () {
        setPreviewLang(sel.value);
      }, { passive: true });
    }

    // Finish buttons: persist and hide wizard
    var finishers = Array.prototype.slice.call(document.querySelectorAll('[data-setup-finish]'));
    var btnFinish = document.getElementById('setupFinish');
    if (btnFinish) finishers.push(btnFinish);

    finishers.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        try { e.preventDefault(); } catch (_) {}
        // persist chosen lang (either from select or current preview)
        var chosen = sel && sel.value ? sel.value : (App.settings.uiLang || detectDeviceLang());
        persistLang(chosen);
        markSetupDone();

        var modal = document.getElementById('setupModal');
        if (modal) try { modal.classList.add('hidden'); } catch (_) {}
      }, { passive: true });
    });
  }

  (function init() {
    try {
      if (window.__lex_setup_master_fix) return;
      window.__lex_setup_master_fix = true;

      // Determine initial preview language:
      var saved = getSavedLang();
      var initial = saved || detectDeviceLang() || DEFAULT_FALLBACK_LANG;

      // Use preview language immediately (no persistence unless user finishes wizard)
      setPreviewLang(initial);

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          attachWizardHandlers();
          openWizardIfNeeded();
        }, { once: true });
      } else {
        attachWizardHandlers();
        openWizardIfNeeded();
      }
    } catch (_) {}
  })();
})();