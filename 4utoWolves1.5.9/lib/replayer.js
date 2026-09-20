/**
 * @fileoverview Auto-replay script to automatically join games
 * @description Finds and clicks the "Join" button to automatically join a game
 * @version 1.0.0
 */

/** @type {number} Number of attempts made */
let attempts = 0;

/** @type {number} Maximum number of attempts (60 seconds) */
const maxAttempts = 60;

/**
 * Interval that searches for the "Join" button and clicks it
 * @type {number}
 */
const interval = setInterval(() => {
  if (typeof LV_SETTINGS === "undefined" || !LV_SETTINGS.AUTO_REPLAY || (typeof TOOLS !== "undefined" && !TOOLS.allow("xp"))) {
    clearInterval(interval);
    return;
  }
  // Search for all elements containing "Join"
  const joinButtons = $('div:contains("Join")');

  attempts++;

  if (joinButtons && joinButtons.length) {
    // Get the coordinates of the last button found (the deepest in the DOM)
    const lastButton = joinButtons[joinButtons.length - 1];
    const rect = lastButton.getBoundingClientRect();

    // Calculate the center of the button
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Send a message to simulate the click via the background script
    window.postMessage(
      {
        type: "FROM_PAGE_CLICK",
        x: centerX,
        y: centerY,
      },
      "*",
    );

    // Stop the interval once the button is found and clicked
    clearInterval(interval);
  } else {
    // Stop after the maximum number of attempts
    if (attempts >= maxAttempts) {
      clearInterval(interval);
    }
    // Otherwise continue searching
  }
}, 1000); // Check every second
