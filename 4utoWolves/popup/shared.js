/**
 * @fileoverview Shared popup bridge
 * @description Context guard, page messaging, and the polling heartbeat every page relies on.
 * Declared as plain top-level bindings (no IIFE) so home.js/gold.js/tools.js/settings.js can use
 * `port`, `sendToPage` and `showFooterNotification` as globals, exactly like the rest of the popup.
 */

/**
 * Check if the extension context is still valid
 * @returns {boolean} True if context is valid
 */
function isContextValid() {
  try {
    return chrome.runtime && chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

// Display an error message if context is invalid
if (!isContextValid()) {
  document.body.innerHTML = `
    <div style="padding: 20px; text-align: center; color: #ff4757;">
      <h2>⚠️ Extension Reloaded</h2>
      <p>Please reload the Wolvesville page to continue.</p>
      <button onclick="chrome.tabs.query({url:'*://www.wolvesville.com/*'}, tabs => tabs[0] && chrome.tabs.reload(tabs[0].id))"
        style="padding: 10px 20px; background: #00d4ff; border: none; border-radius: 8px; color: #fff; cursor: pointer; font-weight: 600;">
        Reload Page
      </button>
    </div>
  `;
  throw new Error("Extension context invalidated");
}

/** @type {chrome.runtime.Port} Connection port with background */
const port = chrome.runtime.connect({ name: "popup" });

/**
 * Send data to the Wolvesville page via the content script
 * @param {Object} data - Data to send
 */
function sendToPage(data) {
  chrome.tabs.query({ url: "*://www.wolvesville.com/*" }, (tabs) => {
    if (tabs && tabs[0]) {
      chrome.tabs
        .sendMessage(tabs[0].id, {
          type: "POPUP_TO_PAGE",
          data: data,
        })
        .catch((e) => {});
    }
  });
}

/**
 * Show a notification in the footer
 * @param {string} message - Message to display
 * @param {string} [type] - Notification type (coins, gold, error, pending)
 */
function showFooterNotification(message, type) {
  const footerNotify = document.getElementById("footerNotify");
  if (!footerNotify) return;

  footerNotify.textContent = message;
  footerNotify.className = "footer-notify";

  if (type) {
    footerNotify.classList.add("footer-" + type);
  }

  footerNotify.classList.add("visible");

  const timeout = type !== "pending" ? 4000 : 6000;
  setTimeout(() => footerNotify.classList.remove("visible"), timeout);
}

// Request initial data, then keep polling: this drives every page's UPDATE_UI/SETTINGS_* messages.
sendToPage({ type: "REQUEST_UI_DATA" });
sendToPage({ type: "REQUEST_SETTINGS" });
setInterval(() => {
  sendToPage({ type: "REQUEST_UI_DATA" });
  sendToPage({ type: "REQUEST_SETTINGS" });
}, 3000);
