/**
 * @fileoverview Main content script to listen for click events
 * @description Forwards FROM_PAGE_CLICK events to the background script
 * @version 1.0.0
 */

/**
 * Listen for FROM_PAGE_CLICK messages from the page
 * and forward them to the background script via chrome.runtime
 * @listens window.message
 */
window.addEventListener("message", (event) => {
  // Check that the message comes from the same window
  if (event.source !== window) {
    return;
  }

  // Check if it's a click message to forward
  if (event.data && event.data.type === "FROM_PAGE_CLICK") {
    try {
      if (!chrome?.runtime?.id) {
        console.warn("[Content] Extension context invalidated");
        return;
      }
      chrome.runtime.sendMessage(
        {
          type: "CLICK",
          x: event.data.x,
          y: event.data.y,
        },
        () => {
          if (chrome.runtime.lastError) {
            console.warn(
              "[Content] sendMessage failed:",
              chrome.runtime.lastError.message,
            );
          }
        },
      );
    } catch (e) {
      console.warn("[Content] sendMessage exception:", e?.message || e);
    }
  }
});
