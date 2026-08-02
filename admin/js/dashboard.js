(function () {
  const user = OLPAdmin.requireAuth();
  if (!user) return;

  const isAdmin = user.role === "admin";
  const titles = {
    overview: "Overview",
    "forms-placement": "Self Placement Applications",
    "forms-contact": "Contact Messages",
    "forms-alumni": "Alumni Connect",
    "forms-urgent": "Urgent Visits",
    "forms-prayer": "Prayer Wall Submissions",
    account: "Account Settings",
    "edit-bulletin": "Edit Daily Bulletin",
    "edit-src": "Edit SRC Prefects",
    "edit-cleanliness": "Edit Cleanliness Champions",
    "edit-ticker": "Edit News Ticker"
  };

  let currentUser = user;

  function refreshUserChrome() {
    document.getElementById("sidebarUser").textContent =
      currentUser.displayName + " (@" + currentUser.username + ")";
    document.getElementById("rolePill").textContent = currentUser.role;
  }

  refreshUserChrome();

  if (isAdmin) {
    document.querySelectorAll(".admin-only").forEach((el) => {
      el.hidden = false;
    });
  }

  document.getElementById("logoutBtn").addEventListener("click", () => {
    OLPAdmin.clearSession();
    window.location.href = "index.html";
  });

  const sidebar = document.querySelector(".sidebar");
  const backdrop = document.getElementById("drawerBackdrop");
  document.getElementById("menuToggle").addEventListener("click", () => {
    sidebar.classList.add("open");
    backdrop.hidden = false;
  });
  backdrop.addEventListener("click", () => {
    sidebar.classList.remove("open");
    backdrop.hidden = true;
  });

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.getAttribute("data-view");
      if (!isAdmin && view.startsWith("edit-")) return;
      showView(view);
      sidebar.classList.remove("open");
      backdrop.hidden = true;
    });
  });

  function showView(name) {
    document.querySelectorAll(".nav-btn").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-view") === name);
    });
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    const el = document.getElementById("view-" + name);
    if (el) el.classList.add("active");
    document.getElementById("viewTitle").textContent = titles[name] || name;
    loadView(name);
  }

  async function loadView(name) {
    try {
      if (name === "overview") return renderOverview();
      if (name === "forms-placement") return renderForms("placement", "placement");
      if (name === "forms-contact") return renderForms("contact", "contact");
      if (name === "forms-alumni") return renderForms("alumni", "alumni");
      if (name === "forms-urgent") return renderForms("urgent-meeting", "urgent");
      if (name === "forms-prayer") return renderForms("prayer", "prayer");
      if (name === "account") return renderAccountSettings();
      if (name === "edit-bulletin") return renderBulletinEditor();
      if (name === "edit-src") return renderSrcEditor();
      if (name === "edit-cleanliness") return renderCleanlinessEditor();
      if (name === "edit-ticker") return renderTickerEditor();
    } catch (err) {
      if (err.status === 401) {
        OLPAdmin.clearSession();
        window.location.href = "index.html";
      }
      const host = document.querySelector(".view.active");
      if (host) host.innerHTML = `<p class="form-error">${escapeHtml(err.message)}</p>`;
    }
  }

  async function renderAccountSettings() {
    const host = document.getElementById("view-account");
    host.innerHTML = `
      <div class="editor-card">
        <h3>Reset username &amp; password</h3>
        <p class="hint">
          Signed in as <strong>@${escapeHtml(currentUser.username)}</strong>
          (${escapeHtml(currentUser.role)}). Enter your current password to save changes.
          Leave new username or password blank if you do not want to change that field.
        </p>
        <form id="accountForm">
          <div class="field">
            <label for="currentPassword">Current password *</label>
            <input id="currentPassword" name="currentPassword" type="password" required autocomplete="current-password" />
          </div>
          <div class="field">
            <label for="newUsername">New username</label>
            <input id="newUsername" name="newUsername" type="text" value="${escapeAttr(currentUser.username)}" autocomplete="username" />
          </div>
          <div class="row-2">
            <div class="field">
              <label for="newPassword">New password</label>
              <input id="newPassword" name="newPassword" type="password" minlength="8" autocomplete="new-password" placeholder="Min. 8 characters" />
            </div>
            <div class="field">
              <label for="confirmPassword">Confirm new password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" minlength="8" autocomplete="new-password" />
            </div>
          </div>
          <button type="submit" class="btn-primary">Save account changes</button>
          <p class="form-ok" id="accountOk"></p>
          <p class="form-error" id="accountErr"></p>
        </form>
      </div>`;

    host.querySelector("#accountForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const ok = document.getElementById("accountOk");
      const err = document.getElementById("accountErr");
      ok.textContent = "";
      err.textContent = "";

      const currentPassword = e.target.currentPassword.value;
      const newUsername = e.target.newUsername.value.trim().toLowerCase();
      const newPassword = e.target.newPassword.value;
      const confirmPassword = e.target.confirmPassword.value;

      const payload = { currentPassword };
      if (newUsername && newUsername !== currentUser.username) {
        payload.newUsername = newUsername;
      }
      if (newPassword) {
        payload.newPassword = newPassword;
        payload.confirmPassword = confirmPassword;
      }

      if (!payload.newUsername && !payload.newPassword) {
        err.textContent = "Change the username and/or enter a new password.";
        return;
      }

      try {
        const data = await OLPAdmin.api("/api/auth/credentials", {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        OLPAdmin.saveSession(data.token, data.user);
        currentUser = data.user;
        refreshUserChrome();
        ok.textContent = "Account updated successfully.";
        e.target.currentPassword.value = "";
        e.target.newPassword.value = "";
        e.target.confirmPassword.value = "";
        e.target.newUsername.value = currentUser.username;
      } catch (ex) {
        err.textContent = ex.message || "Could not update account.";
      }
    });
  }

  async function renderOverview() {
    const data = await OLPAdmin.api("/api/admin/summary");
    const host = document.getElementById("view-overview");
    const labels = {
      placement: "Self Placement",
      contact: "Contact",
      alumni: "Alumni",
      urgentMeeting: "Urgent Visits",
      prayer: "Prayer"
    };
    host.innerHTML = `
      <p class="hint">Welcome. Review form submissions below. ${
        isAdmin
          ? "As Admin you can also update live site content (Bulletin, SRC, Cleanliness, Ticker)."
          : "Secretary access: form inbox only."
      }</p>
      <div class="cards">
        ${Object.keys(labels)
          .map(
            (k) => `
          <div class="stat-card">
            <div class="label">${labels[k]}</div>
            <div class="value">${data.totals[k] || 0}</div>
            <div class="new">${data.newCounts[k] || 0} new</div>
          </div>`
          )
          .join("")}
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Quick tip</h2></div>
        <div class="empty" style="text-align:left;padding:1.25rem">
          This dashboard is only available on the <strong>admin</strong> subdomain
          (e.g. <code>admin.olpsec.edu.gh</code>). It is intentionally not linked from the public website.
        </div>
      </div>`;
  }

  async function renderForms(apiType, viewKey) {
    const list = await OLPAdmin.api("/api/admin/forms/" + apiType);
    const hostId =
      viewKey === "urgent"
        ? "view-forms-urgent"
        : "view-forms-" + (viewKey === "placement" ? "placement" : viewKey);
    const host = document.getElementById(hostId);
    if (!list.length) {
      host.innerHTML = `<div class="panel"><div class="empty">No submissions yet.</div></div>`;
      return;
    }

    host.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <h2>${list.length} submission(s)</h2>
          <button type="button" class="btn-ghost" data-refresh="${apiType}">Refresh</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>${formTableHead(apiType)}</thead>
            <tbody>
              ${list.map((row) => formTableRow(apiType, row)).join("")}
            </tbody>
          </table>
        </div>
      </div>`;

    host.querySelector("[data-refresh]")?.addEventListener("click", () => renderForms(apiType, viewKey));

    host.querySelectorAll("[data-status]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const status = btn.getAttribute("data-status");
        await OLPAdmin.api(`/api/admin/forms/${apiType}/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status })
        });
        renderForms(apiType, viewKey);
      });
    });
  }

  function formTableHead(type) {
    if (type === "placement") {
      return `<tr><th>Date</th><th>Applicant</th><th>Programme</th><th>BECE File</th><th>Status</th><th>Actions</th></tr>`;
    }
    if (type === "contact") {
      return `<tr><th>Date</th><th>From</th><th>Role</th><th>Message</th><th>Status</th><th>Actions</th></tr>`;
    }
    if (type === "alumni") {
      return `<tr><th>Date</th><th>Name</th><th>Year</th><th>Occupation / Location</th><th>Status</th><th>Actions</th></tr>`;
    }
    if (type === "urgent-meeting") {
      return `<tr><th>Date</th><th>Parent / Child</th><th>Class / Time</th><th>Reason</th><th>Status</th><th>Actions</th></tr>`;
    }
    return `<tr><th>Date</th><th>Name</th><th>Type</th><th>Message</th><th>Status</th><th>Actions</th></tr>`;
  }

  function formTableRow(type, row) {
    const date = formatDate(row.createdAt);
    const status = `<span class="status ${escapeHtml(row.status || "new")}">${escapeHtml(row.status || "new")}</span>`;
    const actions = `
      <button type="button" class="btn-ghost" data-id="${row.id}" data-status="reviewed">Mark reviewed</button>
      <button type="button" class="btn-danger" data-id="${row.id}" data-status="archived">Archive</button>`;

    if (type === "placement") {
      const file = row.beceFile
        ? `<a href="${escapeHtml(row.beceFile.url)}" target="_blank" rel="noopener">${escapeHtml(row.beceFile.originalName || "Download")}</a>
           <div class="hint">${escapeHtml(row.email)} · ${escapeHtml(row.phone)}</div>`
        : "—";
      return `<tr>
        <td>${date}</td>
        <td><strong>${escapeHtml(row.fullName)}</strong><div class="hint">${escapeHtml(row.indexNumber)} · ${escapeHtml(row.jhs)}</div></td>
        <td>${escapeHtml(row.programme)}</td>
        <td>${file}</td>
        <td>${status}</td>
        <td>${actions}</td>
      </tr>`;
    }
    if (type === "contact") {
      return `<tr>
        <td>${date}</td>
        <td><strong>${escapeHtml(row.name)}</strong><div class="hint">${escapeHtml(row.email)}</div></td>
        <td>${escapeHtml(row.role)}</td>
        <td><div class="detail-box">${escapeHtml(row.message)}</div></td>
        <td>${status}</td>
        <td>${actions}</td>
      </tr>`;
    }
    if (type === "alumni") {
      return `<tr>
        <td>${date}</td>
        <td><strong>${escapeHtml(row.name)}</strong></td>
        <td>${escapeHtml(String(row.year))}</td>
        <td>${escapeHtml(row.occupation)}<div class="hint">${escapeHtml(row.location)}</div></td>
        <td>${status}</td>
        <td>${actions}</td>
      </tr>`;
    }
    if (type === "urgent-meeting") {
      return `<tr>
        <td>${date}</td>
        <td><strong>${escapeHtml(row.parentName)}</strong><div class="hint">Child: ${escapeHtml(row.childName)}</div></td>
        <td>${escapeHtml(row.className)}<div class="hint">${escapeHtml(row.time)}</div></td>
        <td><div class="detail-box">${escapeHtml(row.reason)}</div></td>
        <td>${status}</td>
        <td>${actions}</td>
      </tr>`;
    }
    return `<tr>
      <td>${date}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.prayerType)}</td>
      <td><div class="detail-box">${escapeHtml(row.message)}</div></td>
      <td>${status}</td>
      <td>${actions}</td>
    </tr>`;
  }

  async function renderBulletinEditor() {
    const content = await OLPAdmin.api("/api/content");
    const days = content.bulletin.days;
    const host = document.getElementById("view-edit-bulletin");
    host.innerHTML = `
      <p class="hint">Edit each weekday schedule. Changes appear on the public site immediately after saving.</p>
      <form id="bulletinForm">
        ${days
          .map(
            (d, i) => `
          <div class="editor-card" data-day="${d.day}">
            <h3>Day ${d.day} — ${dayName(d.day)}</h3>
            <div class="field">
              <label>Title</label>
              <input name="title-${i}" value="${escapeAttr(d.title)}" required />
            </div>
            <label style="font-size:0.85rem;font-weight:600;color:var(--blue)">Items (time | text) — one per line</label>
            <textarea name="items-${i}" rows="7">${escapeHtml(
              (d.items || []).map((it) => `${it.time} | ${it.text}`).join("\n")
            )}</textarea>
          </div>`
          )
          .join("")}
        <button type="submit" class="btn-primary">Save Bulletin</button>
        <p class="form-ok" id="bulletinMsg"></p>
      </form>`;

    document.getElementById("bulletinForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const nextDays = days.map((d, i) => {
        const title = e.target[`title-${i}`].value.trim();
        const lines = e.target[`items-${i}`].value.split("\n").map((l) => l.trim()).filter(Boolean);
        const items = lines.map((line) => {
          const parts = line.split("|");
          if (parts.length >= 2) {
            return { time: parts[0].trim(), text: parts.slice(1).join("|").trim() };
          }
          return { time: "", text: line };
        });
        return { day: d.day, title, items };
      });
      await OLPAdmin.api("/api/admin/content/bulletin", {
        method: "PUT",
        body: JSON.stringify({ days: nextDays })
      });
      document.getElementById("bulletinMsg").textContent = "Bulletin saved. Public site updated.";
    });
  }

  async function renderSrcEditor() {
    const content = await OLPAdmin.api("/api/content");
    let prefects = content.prefects || [];
    let outgoing = content.outgoingPrefects || [];
    const host = document.getElementById("view-edit-src");

    function render() {
      host.innerHTML = `
        <p class="hint">Manage the current SRC. When elections end, push them to <strong>Outgone SRC</strong>, then add the newly elected executives.</p>
        <div class="panel" style="margin-bottom:1rem">
          <div class="panel-head">
            <h2>Current SRC (${prefects.length})</h2>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
              <button type="button" class="btn-ghost" id="addPrefectBtn">Add new prefect</button>
              <button type="button" class="btn-danger" id="pushAllBtn">Push all to Outgone</button>
            </div>
          </div>
          <div style="padding:1rem" id="currentPrefects">
            ${
              prefects.length
                ? prefects
                    .map(
                      (p, i) => `
              <div class="prefect-edit" data-id="${escapeAttr(p.id)}">
                <div>
                  <img src="${escapeAttr(p.photoUrl || "")}" alt="" id="preview-${i}" />
                  <input type="file" accept="image/*" data-photo-index="${i}" data-prefect-id="${escapeAttr(p.id)}" />
                </div>
                <div>
                  <div class="field"><label>Name</label><input data-field="name" data-i="${i}" value="${escapeAttr(p.name)}" /></div>
                  <div class="field"><label>Position</label><input data-field="title" data-i="${i}" value="${escapeAttr(p.title)}" /></div>
                  <div class="field"><label>Meta (Form · House)</label><input data-field="meta" data-i="${i}" value="${escapeAttr(p.meta || "")}" /></div>
                  <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.35rem">
                    <button type="button" class="btn-ghost" data-push-one="${escapeAttr(p.id)}">Push to Outgone</button>
                    <button type="button" class="btn-danger" data-remove-one="${i}">Remove</button>
                  </div>
                </div>
              </div>`
                    )
                    .join("")
                : `<div class="empty">No current SRC. Add newly elected prefects below.</div>`
            }
          </div>
          <div style="padding:0 1rem 1rem;display:flex;gap:0.75rem;flex-wrap:wrap;align-items:center">
            <button type="button" class="btn-primary" id="saveSrcBtn">Save current SRC</button>
            <span class="form-ok" id="srcMsg"></span>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>Outgone SRC (${outgoing.length})</h2></div>
          <div style="padding:1rem">
            ${
              outgoing.length
                ? `<div class="table-wrap"><table>
                    <thead><tr><th>Photo</th><th>Name / Position</th><th>Term</th><th></th></tr></thead>
                    <tbody>
                      ${outgoing
                        .map(
                          (p) => `
                        <tr>
                          <td><img src="${escapeAttr(p.photoUrl || "")}" alt="" style="width:48px;height:58px;object-fit:cover;border-radius:6px;border:1px solid var(--gold)" /></td>
                          <td><strong>${escapeHtml(p.name)}</strong><div class="hint">${escapeHtml(p.title)} · ${escapeHtml(p.meta || "")}</div></td>
                          <td>${escapeHtml(p.termLabel || "Outgoing")}</td>
                          <td><button type="button" class="btn-danger" data-del-out="${escapeAttr(p.id)}">Remove</button></td>
                        </tr>`
                        )
                        .join("")}
                    </tbody></table></div>`
                : `<div class="empty">No outgone SRC yet.</div>`
            }
          </div>
        </div>`;

      bindSrcEvents();
    }

    function readCurrentFromDom() {
      return prefects.map((p, i) => {
        const nameEl = host.querySelector(`[data-field="name"][data-i="${i}"]`);
        const titleEl = host.querySelector(`[data-field="title"][data-i="${i}"]`);
        const metaEl = host.querySelector(`[data-field="meta"][data-i="${i}"]`);
        return {
          id: p.id,
          name: nameEl ? nameEl.value.trim() : p.name,
          title: titleEl ? titleEl.value.trim() : p.title,
          meta: metaEl ? metaEl.value.trim() : p.meta,
          photoUrl: p.photoUrl || ""
        };
      });
    }

    function bindSrcEvents() {
      host.querySelector("#addPrefectBtn")?.addEventListener("click", () => {
        prefects = readCurrentFromDom();
        prefects.push({
          id: "new-" + Date.now(),
          name: "",
          title: "",
          meta: "",
          photoUrl: ""
        });
        render();
      });

      host.querySelector("#pushAllBtn")?.addEventListener("click", async () => {
        if (!prefects.length) return;
        const termLabel = window.prompt("Label for this outgoing term (e.g. SRC 2025/2026):", "Outgoing SRC · " + new Date().getFullYear());
        if (termLabel === null) return;
        await OLPAdmin.api("/api/admin/content/prefects", {
          method: "PUT",
          body: JSON.stringify({ prefects: readCurrentFromDom() })
        });
        const result = await OLPAdmin.api("/api/admin/content/prefects/push-outgoing", {
          method: "POST",
          body: JSON.stringify({ termLabel })
        });
        prefects = result.prefects || [];
        outgoing = result.outgoingPrefects || [];
        render();
        document.getElementById("srcMsg").textContent = "Current SRC moved to Outgone.";
      });

      host.querySelectorAll("[data-push-one]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-push-one");
          const termLabel = window.prompt("Label for this outgoing prefect:", "Outgoing SRC · " + new Date().getFullYear());
          if (termLabel === null) return;
          await OLPAdmin.api("/api/admin/content/prefects", {
            method: "PUT",
            body: JSON.stringify({ prefects: readCurrentFromDom() })
          });
          const result = await OLPAdmin.api("/api/admin/content/prefects/push-outgoing", {
            method: "POST",
            body: JSON.stringify({ ids: [id], termLabel })
          });
          prefects = result.prefects || [];
          outgoing = result.outgoingPrefects || [];
          render();
        });
      });

      host.querySelectorAll("[data-remove-one]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const i = Number(btn.getAttribute("data-remove-one"));
          prefects = readCurrentFromDom().filter((_, idx) => idx !== i);
          render();
        });
      });

      host.querySelectorAll("[data-del-out]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-del-out");
          const result = await OLPAdmin.api("/api/admin/content/outgoing-prefects/" + id, {
            method: "DELETE"
          });
          outgoing = result.outgoingPrefects || [];
          render();
        });
      });

      host.querySelector("#saveSrcBtn")?.addEventListener("click", async () => {
        const next = readCurrentFromDom().filter((p) => p.name && p.title);
        const result = await OLPAdmin.api("/api/admin/content/prefects", {
          method: "PUT",
          body: JSON.stringify({ prefects: next })
        });
        prefects = result.prefects || next;
        render();
        document.getElementById("srcMsg").textContent = "Current SRC saved.";
      });

      host.querySelectorAll("input[type=file]").forEach((input) => {
        input.addEventListener("change", async () => {
          if (!input.files || !input.files[0]) return;
          prefects = readCurrentFromDom();
          const id = input.getAttribute("data-prefect-id");
          const idx = Number(input.getAttribute("data-photo-index"));
          await OLPAdmin.api("/api/admin/content/prefects", {
            method: "PUT",
            body: JSON.stringify({ prefects })
          });
          const fd = new FormData();
          fd.append("photo", input.files[0]);
          const result = await OLPAdmin.api(`/api/admin/content/prefects/${id}/photo`, {
            method: "POST",
            body: fd
          });
          if (prefects[idx]) prefects[idx].photoUrl = result.photoUrl;
          render();
          document.getElementById("srcMsg").textContent = "Photo uploaded.";
        });
      });
    }

    render();
  }

  async function renderCleanlinessEditor() {
    const content = await OLPAdmin.api("/api/content");
    let entries = (content.cleanliness && content.cleanliness.entries) || [];
    let weekLabel = (content.cleanliness && content.cleanliness.weekLabel) || "This week";
    const host = document.getElementById("view-edit-cleanliness");

    function rowHtml(e, i) {
      return `
        <div class="clean-row" data-i="${i}" style="display:grid;grid-template-columns:1.4fr 1fr 100px auto;gap:0.5rem;margin-bottom:0.65rem;align-items:center">
          <input data-field="name" data-i="${i}" value="${escapeAttr(e.name)}" placeholder="Dormitory or class name" required />
          <select data-field="icon" data-i="${i}">
            <option value="bed" ${e.icon === "bed" ? "selected" : ""}>Dormitory</option>
            <option value="chalkboard" ${e.icon === "chalkboard" ? "selected" : ""}>Class</option>
          </select>
          <input data-field="score" data-i="${i}" type="number" min="0" max="100" value="${e.score}" required />
          <button type="button" class="btn-danger" data-remove="${i}">Remove</button>
        </div>`;
    }

    function readEntries() {
      return entries.map((e, i) => {
        const nameEl = host.querySelector(`[data-field="name"][data-i="${i}"]`);
        const iconEl = host.querySelector(`[data-field="icon"][data-i="${i}"]`);
        const scoreEl = host.querySelector(`[data-field="score"][data-i="${i}"]`);
        return {
          id: e.id || "c-" + Date.now() + "-" + i,
          name: nameEl ? nameEl.value.trim() : e.name,
          icon: iconEl ? iconEl.value : e.icon,
          score: scoreEl ? Number(scoreEl.value) : e.score
        };
      });
    }

    function render() {
      host.innerHTML = `
        <form id="cleanForm" class="editor-card">
          <p class="hint">Add or remove dormitories and classes, then set weekly scores.</p>
          <div class="field">
            <label>Week label</label>
            <input id="weekLabelInput" value="${escapeAttr(weekLabel)}" required />
          </div>
          <div id="cleanEntries">${entries.map(rowHtml).join("")}</div>
          <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-top:0.75rem">
            <button type="button" class="btn-ghost" id="addCleanBtn">Add dormitory / class</button>
            <button type="submit" class="btn-primary">Save Scoreboard</button>
          </div>
          <p class="form-ok" id="cleanMsg"></p>
        </form>`;

      host.querySelector("#addCleanBtn").addEventListener("click", () => {
        entries = readEntries();
        entries.push({ id: "c-" + Date.now(), name: "", icon: "bed", score: 0 });
        render();
      });

      host.querySelectorAll("[data-remove]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const i = Number(btn.getAttribute("data-remove"));
          entries = readEntries().filter((_, idx) => idx !== i);
          render();
        });
      });

      host.querySelector("#cleanForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        weekLabel = host.querySelector("#weekLabelInput").value.trim();
        entries = readEntries().filter((row) => row.name);
        const result = await OLPAdmin.api("/api/admin/content/cleanliness", {
          method: "PUT",
          body: JSON.stringify({ weekLabel, entries })
        });
        entries = (result.cleanliness && result.cleanliness.entries) || entries;
        weekLabel = (result.cleanliness && result.cleanliness.weekLabel) || weekLabel;
        render();
        document.getElementById("cleanMsg").textContent = "Cleanliness scoreboard saved.";
      });
    }

    render();
  }

  async function renderTickerEditor() {
    const content = await OLPAdmin.api("/api/content");
    const host = document.getElementById("view-edit-ticker");
    host.innerHTML = `
      <form id="tickerForm" class="editor-card">
        <p class="hint">One announcement per line.</p>
        <textarea name="items" rows="10">${escapeHtml((content.ticker || []).join("\n"))}</textarea>
        <br/><br/>
        <button type="submit" class="btn-primary">Save Ticker</button>
        <p class="form-ok" id="tickerMsg"></p>
      </form>`;

    document.getElementById("tickerForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const items = e.target.items.value
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      await OLPAdmin.api("/api/admin/content/ticker", {
        method: "PUT",
        body: JSON.stringify({ items })
      });
      document.getElementById("tickerMsg").textContent = "News ticker saved.";
    });
  }

  function dayName(d) {
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d] || "";
  }

  function formatDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return iso;
    }
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }

  showView("overview");
})();
