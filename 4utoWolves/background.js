import { handleToolsUpdate } from './lib/tools-notifications.js';
import { installUpdateService } from './lib/update-service.js';
import { LICENSE_SERVER_URL } from './lib/license-config.mjs';

installUpdateService();

/**
 * @fileoverview Background service worker for 4utoWolves extension
 * @description Handles communication with popup, tabs and simulated clicks
 * @version 1.0.0
 */

// Disable console logs in production (removed for debugging)
// try {
//   (function() {
//     const noop = function() {};
//     if (typeof console !== 'undefined') {
//       console.log = noop;
//       console.warn = noop;
//       console.debug = noop;
//       console.info = noop;
//       console.error = noop;
//     }
//   })();
// } catch (e) {}

/** @type {chrome.runtime.Port|null} Connection port with popup */
let popupPort = null;

/**
 * Handle popup connection
 * @listens chrome.runtime.onConnect
 */
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    popupPort = port;
    port.onDisconnect.addListener(() => {
      popupPort = null;
    });
  }
});

/**
 * Simulate a click at specific coordinates using Chrome Debugger Protocol
 * @async
 * @param {number} x - X coordinate of the click
 * @param {number} y - Y coordinate of the click
 * @param {string} [button='left'] - Mouse button ('left', 'right', 'middle')
 * @returns {Promise<{success: boolean, error?: string}>} Operation result
 */
async function click(x, y, button = "left") {
  try {
    // Find the Wolvesville tab
    const tabs = await chrome.tabs.query({
      url: "*://www.wolvesville.com/*",
    });

    if (tabs.length === 0) {
      return { success: false, error: "No tab found" };
    }

    const debugTarget = { tabId: tabs[0].id };

    // Attach the debugger
    try {
      await chrome.debugger.attach(debugTarget, "1.2");
    } catch (attachError) {
      // If another debugger is already attached, detach and retry
      if (attachError.message.includes("Another debugger")) {
        try {
          await chrome.debugger.detach(debugTarget);
          await new Promise((resolve) => setTimeout(resolve, 100));
          await chrome.debugger.attach(debugTarget, "1.2");
        } catch (retryError) {
          throw retryError;
        }
      } else {
        throw attachError;
      }
    }

    // Send mouse events via Input protocol
    // 1. Move mouse to position
    await chrome.debugger.sendCommand(debugTarget, "Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: x,
      y: y,
    });

    // 2. Press button
    await chrome.debugger.sendCommand(debugTarget, "Input.dispatchMouseEvent", {
      type: "mousePressed",
      button: button,
      x: x,
      y: y,
      clickCount: 1,
    });

    // 3. Release button
    await chrome.debugger.sendCommand(debugTarget, "Input.dispatchMouseEvent", {
      type: "mouseReleased",
      button: button,
      x: x,
      y: y,
      clickCount: 1,
    });

    // Detach the debugger
    await chrome.debugger.detach(debugTarget);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Return a successful authentication response (server bypass)
 * @async
 * @param {string} username - Username
 * @param {string} playerId - Player ID
 * @returns {Promise<{status: number, data: object}>} Simulated response
 */
async function authenticateUser(username, playerId) {
  // Bot enabled by default without server verification
  return {
    status: 200,
    data: {
      bot: "authorized",
      expires: "Never",
      message: "Bot enabled locally",
    },
  };
}

/**
 * Handle incoming messages from content scripts and popup
 * @listens chrome.runtime.onMessage
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handled by update-service.js, which owns its asynchronous response.
  if (["GET_UPDATES", "REFRESH_UPDATES", "MARK_UPDATES_READ"].includes(message?.type)) return false;

  // Handle simulated clicks via debugger
  if (
    message.type === "CLICK" &&
    message.x !== undefined &&
    message.y !== undefined
  ) {
    click(message.x, message.y)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicates an asynchronous response
  }

  // Handle authentication requests
  if (message.type === "AUTH_REQUEST") {
    if (!message.username || !message.player_id) {
      sendResponse({
        error: "Missing username or player_id",
        status: 400,
        data: { message: "missing parameters" },
      });
      return false;
    }

    authenticateUser(message.username, message.player_id)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          error: error.message,
          status: 0,
          data: { message: "error" },
        });
      });
    return true; // Indicates an asynchronous response
  }

  // Verify a license token against the license server. Runs here (not in the
  // page) because bot-logic.js is injected into wolvesville.com's own page and
  // would be subject to that page's CSP; the background worker isn't.
  if (message.type === "VERIFY_LICENSE_TOKEN") {
    (async () => {
      if (!LICENSE_SERVER_URL) return sendResponse({ valid: false, reason: "not_configured" });
      try {
        const response = await fetch(LICENSE_SERVER_URL + "/token/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: message.token }),
        });
        if (!response.ok) return sendResponse({ valid: false, reason: "server_error" });
        const data = await response.json();
        sendResponse({ valid: !!data.valid, expiresAt: data.expiresAt || null, reason: data.valid ? null : "invalid" });
      } catch {
        sendResponse({ valid: false, reason: "network_error" });
      }
    })();
    return true; // Indicates an asynchronous response
  }

  // Handle XP addition (disabled - no external server)
  if (message.type === "XP_ADD") {
    // XP tracking disabled - no external server
    sendResponse({ status: 200, data: { message: "XP tracking disabled" } });
    return false;
  }

  // Forward messages from popup to page
  if (message.type === "POPUP_TO_PAGE") {
    chrome.tabs.query({ url: "*://www.wolvesville.com/*" }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
      }
    });
    sendResponse({ success: true });
    return false;
  }

  // Forward messages from page to popup
  if (message.type === "PAGE_TO_POPUP") {
    void handleToolsUpdate(message.data, sender.tab?.id).catch(() => {});
    if (popupPort) {
      try {
        popupPort.postMessage({ ...message.data, sourceTabId: sender.tab?.id });
      } catch (e) {}
    }
    sendResponse({ success: true });
    return false;
  }

  // Unknown message type
  sendResponse({ success: false, error: "Unknown message type" });
  return false;
});
