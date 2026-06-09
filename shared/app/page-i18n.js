/**
 * Lightweight i18n for the secondary pages (settings, support) which don't load
 * the full script.js. Loads translations.json, applies the user's stored
 * language to every [data-i18n] element, and exposes a small API so other
 * scripts (settings-page.js, bottom-nav.js) can translate strings and switch
 * language in place — keeping language consistent across every page.
 */
(function () {
  var LANG_KEY = "agnihotra_language";
  var SUPPORTED = ["en", "hi", "mr"];
  var translations = null;
  var lang = readLang();

  function readLang() {
    try {
      var s = localStorage.getItem(LANG_KEY);
      return SUPPORTED.indexOf(s) !== -1 ? s : "en";
    } catch (e) {
      return "en";
    }
  }

  function t(key, fallback) {
    var table = translations && translations[lang];
    if (table && table[key] != null) return table[key];
    return fallback != null ? fallback : key;
  }

  function apply() {
    try {
      document.documentElement.lang = lang;
    } catch (e) {}
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var translated = t(key, el.textContent);
      if (translated != null) el.textContent = translated;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      var translated = t(key, el.getAttribute("placeholder"));
      if (translated != null) el.setAttribute("placeholder", translated);
    });
  }

  var ready = fetch("translations.json")
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) { if (data) translations = data; apply(); })
    .catch(function () { apply(); });

  window.AgnihotraI18n = {
    t: t,
    getLanguage: function () { return lang; },
    setLanguage: function (next) {
      if (SUPPORTED.indexOf(next) === -1 || next === lang) {
        if (next === lang) apply();
        return;
      }
      lang = next;
      try { localStorage.setItem(LANG_KEY, next); } catch (e) {}
      apply();
      try {
        window.dispatchEvent(new CustomEvent("agnihotra:languagechange", { detail: { language: next } }));
      } catch (e) {}
    },
    apply: apply,
    ready: ready,
  };

  if (document.readyState !== "loading") apply();
  else document.addEventListener("DOMContentLoaded", apply);
})();
