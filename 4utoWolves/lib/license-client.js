/**
 * Stores the 4utoWolves license token and verifies it through the background
 * worker (see content-script.js/background.js), instead of fetching directly
 * from this page: this script is injected into wolvesville.com's own page,
 * so a direct fetch would be subject to that page's CSP.
 */
(function (root) {
  'use strict';
  const STORAGE_KEY = "bot-license-token";
  const VERIFY_TIMEOUT_MS = 10000;
  let nextRequestId = 1;
  const pending = new Map();

  function getStoredToken() {
    try { return localStorage.getItem(STORAGE_KEY) || ""; }
    catch { return ""; }
  }

  function setStoredToken(token) {
    try {
      if (token) localStorage.setItem(STORAGE_KEY, token);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  function verify(token) {
    if (!token) return Promise.resolve({ valid: false, reason: "missing" });
    return new Promise((resolve) => {
      const requestId = nextRequestId++;
      const timeout = setTimeout(() => {
        if (pending.delete(requestId)) resolve({ valid: false, reason: "timeout" });
      }, VERIFY_TIMEOUT_MS);
      pending.set(requestId, (result) => { clearTimeout(timeout); resolve(result); });
      window.postMessage({ type: "LICENSE_VERIFY_REQUEST", token, requestId }, "*");
    });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.type !== "LICENSE_VERIFY_RESPONSE") return;
    const settle = pending.get(event.data.requestId);
    if (!settle) return;
    pending.delete(event.data.requestId);
    settle(event.data.result);
  });

  root.LICENSE = { getStoredToken, setStoredToken, verify };
})(globalThis);
