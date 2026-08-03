/* ============================================================
   OLPSEC — Public site JavaScript
   Loads live content from API; submits forms to staff dashboard inbox
   ============================================================ */

(function () {
  "use strict";

  var API = "";

  document.addEventListener("DOMContentLoaded", function () {
    initYear();
    initMobileNav();
    initActiveNavOnScroll();
    initDailyBulletin();
    loadLiveContent();
    loadPrayers();
    initContactForm();
    initAlumniForm();
    initPtcForm();
    initPrayerForm();
    initPlacementForm();
    initFormSwitcher();
  });

  function initYear() {
    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  async function api(path, options) {
    options = options || {};
    var headers = Object.assign({}, options.headers || {});
    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    var res = await fetch(API + path, Object.assign({}, options, { headers: headers }));
    var data = {};
    try {
      data = await res.json();
    } catch (e) {
      /* ignore */
    }
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  /* ---------- Live content ---------- */
  async function loadLiveContent() {
    try {
      var data = await api("/api/content");
      renderTicker(data.ticker || []);
      renderBulletin(data.bulletin);
      renderPrefects(data.prefects || []);
      renderCleanliness(data.cleanliness);
      initDailyBulletin();
    } catch (err) {
      console.warn("Live content unavailable; showing fallbacks.", err.message);
    }
  }

  function renderTicker(items) {
    var track = document.getElementById("tickerTrack");
    if (!track || !items.length) return;
    var html = items
      .concat(items)
      .map(function (t) {
        return '<span class="ticker-item">' + escapeHtml(t) + "</span>";
      })
      .join("");
    track.innerHTML = html;
  }

  function renderBulletin(bulletin) {
    var host = document.getElementById("bulletinPanels");
    if (!host || !bulletin || !bulletin.days) return;
    host.innerHTML = bulletin.days
      .map(function (day) {
        var items = (day.items || [])
          .map(function (it) {
            var label = it.time ? "<strong>" + escapeHtml(it.time) + ":</strong> " : "";
            return "<li>" + label + escapeHtml(it.text) + "</li>";
          })
          .join("");
        return (
          '<div class="day-panel" data-day="' +
          day.day +
          '" hidden>' +
          '<h3 class="day-panel-title">' +
          escapeHtml(day.title) +
          "</h3>" +
          '<ul class="bulletin-list">' +
          items +
          "</ul></div>"
        );
      })
      .join("");
  }

  function renderPrefects(prefects) {
    var host = document.getElementById("prefectGallery");
    if (!host) return;
    if (!prefects.length) {
      host.innerHTML =
        '<p class="section-lead" style="color:#fff;opacity:.8">Current SRC will appear here after elections.</p>';
      return;
    }
    host.innerHTML = prefects
      .map(function (p) {
        return (
          '<article class="prefect-card glass-card">' +
          '<div class="prefect-photo">' +
          '<img src="' +
          escapeHtml(p.photoUrl || "") +
          '" alt="' +
          escapeHtml(p.name + ", " + p.title) +
          '" width="280" height="320" loading="lazy" />' +
          "</div>" +
          "<h3>" +
          escapeHtml(p.name) +
          "</h3>" +
          '<p class="prefect-title">' +
          escapeHtml(p.title) +
          "</p>" +
          '<p class="prefect-meta">' +
          escapeHtml(p.meta || "") +
          "</p>" +
          "</article>"
        );
      })
      .join("");
  }

  function renderCleanliness(data) {
    if (!data) return;
    var week = document.getElementById("cleanlinessWeek");
    var list = document.getElementById("scoreList");
    if (week) week.textContent = data.weekLabel || "This week";
    if (!list) return;
    var entries = (data.entries || []).slice().sort(function (a, b) {
      return b.score - a.score;
    });
    list.innerHTML = entries
      .map(function (e, i) {
        var rankClass = i === 0 ? " rank-1" : i === 1 ? " rank-2" : i === 2 ? " rank-3" : "";
        var icon = e.icon === "chalkboard" ? "fa-chalkboard" : "fa-bed";
        return (
          '<li class="score-row' +
          rankClass +
          '" data-score="' +
          e.score +
          '">' +
          '<span class="rank-badge">' +
          (i + 1) +
          "</span>" +
          '<span class="score-name"><i class="fas ' +
          icon +
          '" aria-hidden="true"></i> ' +
          escapeHtml(e.name) +
          "</span>" +
          '<div class="score-bar-wrap"><div class="score-bar" style="width: ' +
          e.score +
          '%"></div></div>' +
          '<span class="score-value">' +
          e.score +
          "</span></li>"
        );
      })
      .join("");
  }

  async function loadPrayers() {
    var wall = document.getElementById("prayerWall");
    if (!wall) return;
    try {
      var list = await api("/api/prayers");
      if (!list.length) {
        wall.innerHTML =
          '<p class="section-lead" style="text-align:left">No prayer notes yet. Be the first to share.</p>';
        return;
      }
      wall.innerHTML = list
        .map(function (p) {
          var isThanks = p.prayerType === "Thanksgiving";
          return (
            '<article class="prayer-note glass-card">' +
            '<span class="prayer-type ' +
            (isThanks ? "thanksgiving" : "request") +
            '">' +
            '<i class="fas ' +
            (isThanks ? "fa-heart" : "fa-hands") +
            '" aria-hidden="true"></i> ' +
            escapeHtml(p.prayerType) +
            "</span>" +
            "<p>\"" +
            escapeHtml(p.message) +
            "\"</p>" +
            "<footer>— " +
            escapeHtml(p.name) +
            "</footer></article>"
          );
        })
        .join("");
    } catch (e) {
      /* keep empty */
    }
  }

  /* ---------- Nav ---------- */
  function initMobileNav() {
    var hamburger = document.getElementById("hamburger");
    var navLinks = document.getElementById("navLinks");
    if (!hamburger || !navLinks) return;

    hamburger.addEventListener("click", function () {
      var isOpen = navLinks.classList.toggle("open");
      hamburger.classList.toggle("open", isOpen);
      hamburger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      hamburger.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("open");
        hamburger.classList.remove("open");
        hamburger.setAttribute("aria-expanded", "false");
        hamburger.setAttribute("aria-label", "Open menu");
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navLinks.classList.contains("open")) {
        navLinks.classList.remove("open");
        hamburger.classList.remove("open");
        hamburger.setAttribute("aria-expanded", "false");
      }
    });
  }

  function initActiveNavOnScroll() {
    var sections = document.querySelectorAll("main section[id]");
    var navAnchors = document.querySelectorAll(".nav-links a");
    if (!sections.length || !navAnchors.length) return;

    function updateActive() {
      var scrollPos = window.scrollY + 120;
      var currentId = "";
      sections.forEach(function (section) {
        if (section.offsetTop <= scrollPos) currentId = section.getAttribute("id");
      });
      var navMap = {
        bulletin: "home",
        sanitation: "student-life",
        community: "alumni",
        "visiting-day": "alumni",
        alumni: "alumni",
        chapel: "alumni",
        "self-placement": "self-placement"
      };
      var highlightId = navMap[currentId] || currentId;
      navAnchors.forEach(function (anchor) {
        var id = (anchor.getAttribute("href") || "").replace("#", "");
        anchor.classList.toggle("active", id === highlightId);
      });
    }
    window.addEventListener("scroll", updateActive, { passive: true });
    updateActive();
  }

  /* ---------- Daily Bulletin tabs ---------- */
  function initDailyBulletin() {
    var tabs = document.querySelectorAll(".day-tab");
    var panels = document.querySelectorAll(".day-panel");
    var dateEl = document.getElementById("bulletinDate");
    if (!tabs.length) return;

    var dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ];

    function showDay(dayIndex) {
      panels = document.querySelectorAll(".day-panel");
      tabs.forEach(function (tab) {
        var active = Number(tab.getAttribute("data-day")) === dayIndex;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
      });
      panels.forEach(function (panel) {
        panel.hidden = Number(panel.getAttribute("data-day")) !== dayIndex;
      });
      if (dateEl) {
        var now = new Date();
        if (dayIndex === now.getDay()) {
          dateEl.textContent =
            "Today — " +
            dayNames[dayIndex] +
            ", " +
            now.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric"
            });
        } else {
          dateEl.textContent = dayNames[dayIndex] + " academic schedule";
        }
      }
    }

    tabs.forEach(function (tab) {
      tab.onclick = function () {
        showDay(Number(tab.getAttribute("data-day")));
      };
    });
    showDay(new Date().getDay());
  }

  /* ---------- Forms ---------- */
  function clearErrors(form) {
    form.querySelectorAll(".error").forEach(function (el) {
      el.classList.remove("error");
    });
  }

  function setMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = "form-message" + (type ? " " + type : "");
  }

  function isValidEmail(email) {
    return typeof email === "string" && email.indexOf("@") !== -1 && email.indexOf(".") !== -1;
  }

  function requireFields(fieldIds) {
    var ok = true;
    fieldIds.forEach(function (id) {
      var field = document.getElementById(id);
      if (!field) return;
      if (!(field.value || "").trim()) {
        field.classList.add("error");
        ok = false;
      }
    });
    return ok;
  }

  function initContactForm() {
    var form = document.getElementById("contactForm");
    var msg = document.getElementById("contactMessageStatus");
    if (!form) return;
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      clearErrors(form);
      var name = document.getElementById("contactName");
      var role = document.getElementById("contactRole");
      var email = document.getElementById("contactEmail");
      var message = document.getElementById("contactMessage");
      var valid = requireFields(["contactName", "contactRole", "contactEmail", "contactMessage"]);
      if (email && !isValidEmail(email.value.trim())) {
        email.classList.add("error");
        valid = false;
      }
      if (!valid) {
        setMessage(msg, "Please fill in all fields, including whether you are a student, parent, or staff.", "error");
        return;
      }
      try {
        await api("/api/forms/contact", {
          method: "POST",
          body: JSON.stringify({
            name: name.value.trim(),
            role: role.value,
            email: email.value.trim(),
            message: message.value.trim()
          })
        });
        setMessage(msg, "Thank you! Your message has been sent to the school office.", "success");
        form.reset();
      } catch (err) {
        setMessage(msg, err.message || "Could not send message.", "error");
      }
    });
  }

  function initAlumniForm() {
    var form = document.getElementById("alumniForm");
    var msg = document.getElementById("alumniMessage");
    if (!form) return;
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      clearErrors(form);
      var name = document.getElementById("alumniName");
      var year = document.getElementById("alumniYear");
      var occupation = document.getElementById("alumniOccupation");
      var location = document.getElementById("alumniLocation");
      var valid = requireFields(["alumniName", "alumniYear", "alumniOccupation", "alumniLocation"]);
      var yearNum = year ? parseInt(year.value, 10) : NaN;
      if (isNaN(yearNum) || yearNum < 1989 || yearNum > 2030) {
        if (year) year.classList.add("error");
        valid = false;
      }
      if (!valid) {
        setMessage(msg, "Please complete all fields. Graduation year must be between 1989 and 2030.", "error");
        return;
      }
      try {
        await api("/api/forms/alumni", {
          method: "POST",
          body: JSON.stringify({
            name: name.value.trim(),
            year: yearNum,
            occupation: occupation.value.trim(),
            location: location.value.trim()
          })
        });
        setMessage(
          msg,
          "Welcome home, " + name.value.trim().split(" ")[0] + "! You are connected with OLPSEC Alumni.",
          "success"
        );
        form.reset();
      } catch (err) {
        setMessage(msg, err.message || "Could not submit.", "error");
      }
    });
  }

  function initPtcForm() {
    var form = document.getElementById("ptcForm");
    var msg = document.getElementById("ptcMessage");
    if (!form) return;
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      clearErrors(form);
      var parentName = document.getElementById("ptcParentName");
      var childName = document.getElementById("ptcChildName");
      var classField = document.getElementById("ptcClass");
      var timeField = document.getElementById("ptcTime");
      var reason = document.getElementById("ptcReason");
      var valid = requireFields([
        "ptcParentName",
        "ptcChildName",
        "ptcClass",
        "ptcTime",
        "ptcReason"
      ]);
      if (!valid) {
        setMessage(msg, "Please complete all fields, including the nature of the emergency.", "error");
        return;
      }
      try {
        await api("/api/forms/urgent-meeting", {
          method: "POST",
          body: JSON.stringify({
            parentName: parentName.value.trim(),
            childName: childName.value.trim(),
            className: classField.value,
            time: timeField.value,
            reason: reason.value.trim()
          })
        });
        setMessage(msg, "Urgent meeting request submitted. Administration will contact you shortly.", "success");
        form.reset();
      } catch (err) {
        setMessage(msg, err.message || "Could not submit request.", "error");
      }
    });
  }

  function initPrayerForm() {
    var form = document.getElementById("prayerForm");
    var msg = document.getElementById("prayerFormMessage");
    if (!form) return;
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      clearErrors(form);
      var nameField = document.getElementById("prayerName");
      var typeField = document.getElementById("prayerType");
      var messageField = document.getElementById("prayerMessage");
      if (!messageField.value.trim()) {
        messageField.classList.add("error");
        setMessage(msg, "Please write a message for the prayer wall.", "error");
        return;
      }
      try {
        await api("/api/forms/prayer", {
          method: "POST",
          body: JSON.stringify({
            name: nameField.value.trim(),
            prayerType: typeField.value,
            message: messageField.value.trim()
          })
        });
        setMessage(msg, "Your note has been added to the Digital Chapel wall.", "success");
        form.reset();
        loadPrayers();
      } catch (err) {
        setMessage(msg, err.message || "Could not submit.", "error");
      }
    });
  }

  function initPlacementForm() {
    var form = document.getElementById("placementForm");
    var msg = document.getElementById("placementMessage");
    var fileInput = document.getElementById("placementBeceFile");
    var fileNameEl = document.getElementById("placementFileName");
    var uploadBox = document.getElementById("fileUploadBox");
    if (!form) return;

    function updateFileLabel() {
      var file = fileInput && fileInput.files && fileInput.files[0];
      if (file) {
        fileNameEl.textContent = "Selected: " + file.name;
        uploadBox.classList.add("has-file");
      } else {
        fileNameEl.textContent = "";
        uploadBox.classList.remove("has-file");
      }
    }

    if (fileInput) fileInput.addEventListener("change", updateFileLabel);

    if (uploadBox) {
      ["dragenter", "dragover"].forEach(function (evt) {
        uploadBox.addEventListener(evt, function (e) {
          e.preventDefault();
          uploadBox.classList.add("dragover");
        });
      });
      ["dragleave", "drop"].forEach(function (evt) {
        uploadBox.addEventListener(evt, function (e) {
          e.preventDefault();
          uploadBox.classList.remove("dragover");
        });
      });
      uploadBox.addEventListener("drop", function (e) {
        var files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length && fileInput) {
          fileInput.files = files;
          updateFileLabel();
        }
      });
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      clearErrors(form);
      uploadBox.classList.remove("error");

      var valid = requireFields([
        "placementName",
        "placementIndex",
        "placementGender",
        "placementYear",
        "placementJhs",
        "placementProgramme",
        "placementPhone",
        "placementEmail",
        "placementGuardian"
      ]);
      var email = document.getElementById("placementEmail");
      if (email && !isValidEmail(email.value.trim())) {
        email.classList.add("error");
        valid = false;
      }
      var confirm = document.getElementById("placementConfirm");
      if (confirm && !confirm.checked) {
        confirm.classList.add("error");
        valid = false;
      }
      var file = fileInput && fileInput.files && fileInput.files[0];
      if (!file) {
        uploadBox.classList.add("error");
        valid = false;
      } else if (file.size > 5 * 1024 * 1024) {
        uploadBox.classList.add("error");
        setMessage(msg, "BECE result file must be 5 MB or smaller.", "error");
        return;
      }
      if (!valid) {
        setMessage(msg, "Please complete all required fields and upload your BECE result.", "error");
        return;
      }

      var fd = new FormData();
      fd.append("fullName", document.getElementById("placementName").value.trim());
      fd.append("indexNumber", document.getElementById("placementIndex").value.trim());
      fd.append("gender", document.getElementById("placementGender").value);
      fd.append("beceYear", document.getElementById("placementYear").value);
      fd.append("jhs", document.getElementById("placementJhs").value.trim());
      fd.append("programme", document.getElementById("placementProgramme").value);
      fd.append("phone", document.getElementById("placementPhone").value.trim());
      fd.append("email", email.value.trim());
      fd.append("guardian", document.getElementById("placementGuardian").value.trim());
      fd.append("beceResult", file);

      try {
        await api("/api/forms/placement", { method: "POST", body: fd });
        setMessage(
          msg,
          "Application submitted with BECE file. Admissions will contact you after review.",
          "success"
        );
        form.reset();
        updateFileLabel();
      } catch (err) {
        setMessage(msg, err.message || "Could not submit application.", "error");
      }
    });
  }

  /* ---------- Community form switcher ---------- */
  function initFormSwitcher() {
    var buttons = document.querySelectorAll("[data-form-tab]");
    var panels = document.querySelectorAll("[data-form-panel]");
    if (!buttons.length || !panels.length) return;

    var hashMap = {
      "visiting-day": "urgent",
      alumni: "alumni",
      chapel: "chapel",
      community: "urgent"
    };

    function showPanel(key) {
      buttons.forEach(function (btn) {
        var active = btn.getAttribute("data-form-tab") === key;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
      panels.forEach(function (panel) {
        var active = panel.getAttribute("data-form-panel") === key;
        panel.classList.toggle("is-active", active);
        if (active) {
          panel.removeAttribute("hidden");
        } else {
          panel.setAttribute("hidden", "");
        }
      });
    }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-form-tab");
        showPanel(key);
        var panel = document.querySelector('[data-form-panel="' + key + '"]');
        if (panel && panel.id) {
          history.replaceState(null, "", "#" + panel.id);
        }
      });
    });

    function applyHash() {
      var hash = (location.hash || "").replace("#", "");
      if (hashMap[hash]) showPanel(hashMap[hash]);
    }

    window.addEventListener("hashchange", applyHash);
    applyHash();
  }
})();
