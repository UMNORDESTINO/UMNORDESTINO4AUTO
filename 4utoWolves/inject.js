/**
 * @fileoverview Injection script to load extension scripts into the page
 * @description Injects payload scripts into the Wolvesville page sequentially
 * @version 1.0.0
 */

// Disable console logs in production
// try {
//   (function() {
//     const noop = function() {};
//     if (typeof window !== 'undefined' && window.console) {
//       window.console.log = noop;
//       window.console.warn = noop;
//       window.console.debug = noop;
//       window.console.info = noop;
//       window.console.error = noop;
//     }
//   })();
// } catch (e) {}

// Listen for authentication events (not currently used)
document.addEventListener("EXTENSION_AUTH_REQUEST", (event) => {
  // Placeholder for future logic
});

/**
 * Inject a script into the page
 * @async
 * @param {string} scriptPath - Relative path of the script in the extension
 * @returns {Promise<void>} Promise resolved when the script is loaded
 * @throws {Error} If the URL is invalid or loading fails
 */
function injectScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const scriptElement = document.createElement("script");
    const scriptUrl = chrome.runtime.getURL(scriptPath);

    // Check that the URL is valid
    if (!scriptUrl || scriptUrl.includes("invalid")) {
      reject(new Error(`Invalid URL for ${scriptPath}: ${scriptUrl}`));
      return;
    }

    scriptElement.src = scriptUrl;
    scriptElement.type = "text/javascript";

    scriptElement.onload = function () {
      resolve();
      this.remove(); // Clean up the DOM after loading
    };

    scriptElement.onerror = function (error) {
      reject(new Error(`Failed to load ${scriptPath}`));
    };

    // Inject into head or documentElement
    (document.head || document.documentElement).appendChild(scriptElement);
  });
}

/**
 * Main injection function
 * Wait for the DOM to be ready then inject scripts in order
 * @async
 */
(async () => {
  try {
    // Wait for the DOM to be ready if necessary
    if (document.readyState === "loading") {
      await new Promise((resolve) => {
        document.addEventListener("DOMContentLoaded", resolve, { once: true });
      });
    }

    // Inject scripts in the required order
    // 1. lib/settimeout-hook.js - setTimeout hook
    await injectScript("lib/settimeout-hook.js");

    // 2. lib/jquery.js - jQuery
    await injectScript("lib/jquery.js");

    // 3. lib/socketio-client.js - Custom Socket.IO client
    await injectScript("lib/socketio-client.js");

    await injectScript("lib/gold-farm.js");
    await injectScript("lib/tools-controller.js");
    await injectScript("lib/license-client.js");

    // 4. lib/bot-logic.js - Main bot logic
    await injectScript("lib/bot-logic.js");

    // 5. lib/replayer.js - Auto-replay (automatic Join click)
    await injectScript("lib/replayer.js");
  } catch (error) {
    // Display an alert in case of loading error
    alert(
      "Zoro Extension Error: Failed to load scripts.\n" +
        error.message +
        "\n\nPlease reload the page or reinstall the extension.",
    );
  }
})();
