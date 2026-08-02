/* Shared API helpers for admin subdomain */
(function (global) {
  const TOKEN_KEY = "olpsec_admin_token";
  const USER_KEY = "olpsec_admin_user";

  function apiBase() {
    return "";
  }

  async function api(path, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = "Bearer " + token;

    const res = await fetch(apiBase() + path, Object.assign({}, options, { headers }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || "Request failed");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function requireAuth() {
    if (!getToken()) {
      window.location.href = "index.html";
      return null;
    }
    return getUser();
  }

  global.OLPAdmin = {
    api,
    saveSession,
    clearSession,
    getUser,
    getToken,
    requireAuth
  };
})(window);
