(function () {
  if (OLPAdmin.getToken()) {
    window.location.href = "dashboard.html";
    return;
  }

  const form = document.getElementById("loginForm");
  const errEl = document.getElementById("loginError");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errEl.textContent = "";
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const data = await OLPAdmin.api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      OLPAdmin.saveSession(data.token, data.user);
      window.location.href = "dashboard.html";
    } catch (err) {
      errEl.textContent = err.message || "Login failed";
    }
  });
})();
