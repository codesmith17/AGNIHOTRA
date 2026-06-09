(function () {
  "use strict";

  var REPO = "codesmith17/AGNIHOTRA";
  var box = document.getElementById("latestReleaseBody");
  var section = document.getElementById("latestReleaseSection");
  if (!box || !section) return;

  function t(key, fallback) {
    try {
      var v = window.AgnihotraI18n && window.AgnihotraI18n.t(key, fallback);
      return v != null && v !== key ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    } catch (e) {
      return iso || "";
    }
  }

  function render(rel) {
    var tag = rel.tag_name || rel.name || "";
    var title = rel.name || tag;
    var date = fmtDate(rel.published_at);
    var notes = (rel.body || "").trim();
    var apk = (rel.assets || []).filter(function (a) {
      return /\.apk$/i.test(a.name || "");
    })[0];
    var dl = apk ? apk.browser_download_url : rel.html_url;
    var dlLabel = apk
      ? t("support.release.download", "Download APK")
      : t("support.release.view", "View on GitHub");

    var notesHtml = notes
      ? '<div class="latest-release-notes">' + esc(notes).replace(/\n/g, "<br>") + "</div>"
      : "";

    box.innerHTML =
      '<div class="latest-release-head">' +
        '<span class="latest-release-tag">' + esc(tag) + "</span>" +
        (date ? '<span class="latest-release-date">' + esc(date) + "</span>" : "") +
      "</div>" +
      (title && title !== tag
        ? '<p class="latest-release-title">' + esc(title) + "</p>"
        : "") +
      notesHtml +
      '<a class="settings-action-btn latest-release-download" href="' +
        esc(dl) +
        '" target="_blank" rel="noopener"><i class="fa-solid fa-download" aria-hidden="true"></i> ' +
        esc(dlLabel) +
      "</a>";
    section.hidden = false;
  }

  // Fail silently: if there is no internet (or any error), the whole section
  // stays hidden so the page looks intentional rather than broken.
  function fail() {
    section.hidden = true;
  }

  if (typeof fetch !== "function" || (navigator && navigator.onLine === false)) {
    fail();
    return;
  }

  fetch("https://api.github.com/repos/" + REPO + "/releases/latest", {
    headers: { Accept: "application/vnd.github+json" }
  })
    .then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then(function (rel) {
      if (rel && (rel.tag_name || rel.name)) {
        render(rel);
      } else {
        fail();
      }
    })
    .catch(fail);
})();
