/**
 * Bottom-tab navigation controller for the secondary pages (settings, support).
 * On the single-page index.html the controller is inlined; here the tabs
 * navigate back to index.html with the right hash so it lands on that page.
 */
(function () {
  var active = window.AGNI_ACTIVE_NAV || "";

  document.querySelectorAll(".bottom-nav-item").forEach(function (btn) {
    if (btn.getAttribute("data-nav") === active) {
      btn.classList.add("is-active");
      btn.setAttribute("aria-current", "page");
    }
  });

  var moreSheet = document.getElementById("moreSheet");
  var moreScrim = document.getElementById("moreScrim");

  function openMore() {
    if (!moreSheet) return;
    moreSheet.hidden = false;
    moreScrim.hidden = false;
    requestAnimationFrame(function () {
      moreSheet.classList.add("is-open");
      moreScrim.classList.add("is-open");
    });
  }
  function closeMore() {
    if (!moreSheet) return;
    moreSheet.classList.remove("is-open");
    moreScrim.classList.remove("is-open");
    setTimeout(function () {
      moreSheet.hidden = true;
      moreScrim.hidden = true;
    }, 240);
  }
  if (moreScrim) moreScrim.addEventListener("click", closeMore);

  document.querySelectorAll(".bottom-nav-item").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var nav = btn.getAttribute("data-nav");
      switch (nav) {
        case "home": window.location.href = "index.html#home"; break;
        case "schedule": window.location.href = "index.html#schedule"; break;
        case "mantras": window.location.href = "index.html#mantras"; break;
        case "settings": window.location.href = "settings.html"; break;
        case "more": openMore(); break;
      }
    });
  });

  // Language buttons: switch in place via the shared i18n module so the change
  // applies instantly and stays consistent across every page (it persists to
  // localStorage, which the other pages read on load).
  var LANG_KEY = "agnihotra_language";
  var langButtons = Array.prototype.slice.call(
    document.querySelectorAll(".more-sheet-lang .lang-option")
  );

  function syncLangActive(current) {
    langButtons.forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-lang") === current);
    });
  }

  function currentLang() {
    if (window.AgnihotraI18n) return window.AgnihotraI18n.getLanguage();
    try { return localStorage.getItem(LANG_KEY) || "en"; } catch (e) { return "en"; }
  }

  syncLangActive(currentLang());

  langButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var lang = btn.getAttribute("data-lang");
      if (!lang) return;
      if (window.AgnihotraI18n) {
        window.AgnihotraI18n.setLanguage(lang);
        syncLangActive(lang);
      } else {
        try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
        window.location.reload();
      }
    });
  });

  window.addEventListener("agnihotra:languagechange", function (e) {
    syncLangActive((e.detail && e.detail.language) || currentLang());
  });
})();
