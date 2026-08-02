/* Outgone SRC page */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    initMobileNav();
    loadOutgone();
  });

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function initMobileNav() {
    var hamburger = document.getElementById("hamburger");
    var navLinks = document.getElementById("navLinks");
    if (!hamburger || !navLinks) return;

    hamburger.addEventListener("click", function () {
      var isOpen = navLinks.classList.toggle("open");
      hamburger.classList.toggle("open", isOpen);
      hamburger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("open");
        hamburger.classList.remove("open");
        hamburger.setAttribute("aria-expanded", "false");
      });
    });
  }

  async function loadOutgone() {
    var host = document.getElementById("outgoneGallery");
    if (!host) return;

    try {
      var res = await fetch("/api/content");
      var data = await res.json();
      var list = data.outgoingPrefects || [];

      if (!list.length) {
        host.innerHTML =
          '<p class="section-lead">No outgone SRC records yet. Former prefects will appear here after the admin archives a term.</p>';
        return;
      }

      host.innerHTML = list
        .map(function (p) {
          return (
            '<article class="prefect-card glass-card outgone-card">' +
            '<div class="prefect-photo">' +
            '<img src="' +
            escapeHtml(p.photoUrl || "") +
            '" alt="' +
            escapeHtml((p.name || "") + ", " + (p.title || "")) +
            '" width="280" height="320" loading="lazy" />' +
            "</div>" +
            "<h3>" +
            escapeHtml(p.name || "") +
            "</h3>" +
            '<p class="prefect-title">' +
            escapeHtml(p.title || "") +
            "</p>" +
            '<p class="prefect-meta">' +
            escapeHtml(p.meta || "") +
            "</p>" +
            (p.termLabel
              ? '<span class="outgoing-term">' + escapeHtml(p.termLabel) + "</span>"
              : "") +
            "</article>"
          );
        })
        .join("");
    } catch (e) {
      host.innerHTML =
        '<p class="section-lead">Unable to load outgone SRC right now. Please try again later.</p>';
    }
  }
})();
