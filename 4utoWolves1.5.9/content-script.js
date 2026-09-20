/**
 * @fileoverview Content script acting as a bridge between the web page and the extension
 * @description Handles bidirectional communication between Wolvesville game and 4utoWolves extension
 * @version 1.0.0
 */

/**
 * Check whether the extension context is still valid
 * @returns {boolean} True if the context is valid, false otherwise
 */
function isContextValid() {
  try {
    return chrome.runtime && chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

/**
 * Send a message to the background script safely
 * @param {object} message - The message to send
 * @param {function} [callback] - Optional callback for the response
 */
function safeSendMessage(message, callback) {
  if (!isContextValid()) {
    if (callback) {
      callback({ error: "Extension context invalidated" });
    }
    return;
  }

  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        if (callback) {
          callback({ error: chrome.runtime.lastError.message });
        }
      } else {
        if (callback) {
          callback(response);
        }
      }
    });
  } catch (error) {
    if (callback) {
      callback({ error: error.message });
    }
  }
}

/**
 * Listen for messages from background/popup and forward them to the page
 * @listens chrome.runtime.onMessage
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Forward popup messages to the page
  if (message.type === "POPUP_TO_PAGE") {
    window.postMessage(message.data, "*");
    sendResponse({ success: true });
  }
  return true;
});

/**
 * Listen for web page messages and route them to the extension
 * @listens window.message
 */
window.addEventListener("message", (event) => {
  // Check that the message comes from the same window
  if (event.source !== window) {
    return;
  }

  // Ignore messages without a type
  if (!event.data || !event.data.type) {
    return;
  }

  const messageType = event.data.type;

  // Handle simulated clicks
  if (messageType === "CLICK") {
    try {
      chrome.runtime.sendMessage(
        {
          type: "FROM_PAGE_CLICK",
          x: event.data.x,
          y: event.data.y,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            // Silent error
          }
        },
      );
    } catch (e) {
      // Silent error
    }
    return;
  }

  // Handle authentication requests from the page
  if (messageType === "AUTH_REQUEST_FROM_PAGE") {
    try {
      safeSendMessage(
        {
          type: "EXTENSION_AUTH_REQUEST",
          username: event.data.username,
          player_id: event.data.player_id,
        },
        (response) => {
          try {
            window.postMessage(
              {
                type: "EXTENSION_AUTH_RESPONSE",
                response: response,
              },
              "*",
            );
          } catch (e) {
            // Silent error
          }
        },
      );
    } catch (e) {
      try {
        window.postMessage(
          {
            type: "EXTENSION_AUTH_RESPONSE",
            response: { error: e.message },
          },
          "*",
        );
      } catch (err) {
        // Silent error
      }
    }
    return;
  }

  // Forward status messages to the popup
  const statusMessageTypes = [
    "TOOLS_NOTICE",
    "SETTINGS_UPDATED",
    "SETTINGS_LOADED",
    "UPDATE_UI",
    "CUSTOM_MESSAGE",
    "AUTH_STATUS",
  ];

  if (statusMessageTypes.includes(messageType)) {
    try {
      chrome.runtime.sendMessage({
        type: "PAGE_TO_POPUP",
        data: event.data,
      });

      // Save custom messages to local storage
      if (messageType === "CUSTOM_MESSAGE") {
        try {
          if (chrome && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set(
              {
                "last-custom-msg": event.data.message,
                llb_popup_msg_seen: false,
              },
              function () {},
            );
          }
        } catch (e) {
          // Silent error
        }
      }

      // Save authentication status
      if (messageType === "AUTH_STATUS") {
        try {
          if (chrome && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set(
              {
                "last-auth-status": {
                  status: event.data.status,
                  ts: Date.now(),
                },
              },
              function () {},
            );
          }
        } catch (e) {
          // Silent error
        }
      }
    } catch (e) {
      // Silent error
    }
  }
});

/**
 * Listen for custom authentication events from the page
 * @listens document.EXTENSION_AUTH_REQUEST
 */
document.addEventListener("EXTENSION_AUTH_REQUEST", async (customEvent) => {
  safeSendMessage(
    {
      type: "AUTH_REQUEST",
      username: customEvent.detail.username,
      player_id: customEvent.detail.player_id,
    },
    (response) => {
      // Dispatch the response to the page
      document.dispatchEvent(
        new CustomEvent("EXTENSION_AUTH_RESPONSE", { detail: response }),
      );

      // Build the authentication status message
      try {
        const authStatus = { type: "AUTH_STATUS" };

        if (!response || response.error) {
          authStatus.status = "error";
          authStatus.message =
            response && response.error ? response.error : "No response";
        } else {
          const httpStatus = response.status;
          const data = response.data || {};

          if (httpStatus === 200 && data.message === "authorized") {
            authStatus.status = "authorized";
          } else if (data.message === "expired") {
            authStatus.status = "expired";
          } else {
            authStatus.status = "unauthorized";
          }

          if (data.expires) {
            authStatus.expires = data.expires;
          }
          if (data.raw) {
            authStatus.raw = data.raw;
          }
          if (data.nickname) {
            authStatus.nickname = data.nickname;
          }

          authStatus.data = data;
        }

        // Send the status to the popup
        chrome.runtime.sendMessage({
          type: "PAGE_TO_POPUP",
          data: authStatus,
        });
      } catch (e) {
        // Silent error
      }
    },
  );
});

/**
 * Listen for XP add events from the page
 * @listens document.EXTENSION_XP_ADD
 */
document.addEventListener("EXTENSION_XP_ADD", async (customEvent) => {
  try {
    const payload = customEvent.detail || {};

    safeSendMessage(
      {
        type: "XP_ADD",
        payload: payload,
      },
      (response) => {
        try {
          document.dispatchEvent(
            new CustomEvent("EXTENSION_XP_ADD_RESPONSE", { detail: response }),
          );
        } catch (e) {
          // Silent error
        }
      },
    );
  } catch (error) {
    try {
      document.dispatchEvent(
        new CustomEvent("EXTENSION_XP_ADD_RESPONSE", {
          detail: { error: error.message },
        }),
      );
    } catch (e) {
      // Silent error
    }
  }
});
