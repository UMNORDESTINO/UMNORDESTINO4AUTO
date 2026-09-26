/**
 * @fileoverview Temporary setTimeout hook
 * @description Adds a 5-second delay to all setTimeout calls during the first 5 seconds
 *              This allows slowing down game initialization to give scripts time to load
 * @version 1.0.0
 */

(() => {
  // Save the original setTimeout reference
  const originalSetTimeout = window.setTimeout;

  /**
   * Modified setTimeout that adds 5 seconds to the delay
   * @param {Function} callback - Function to execute
   * @param {number} delay - Original delay in milliseconds
   * @param {...any} args - Additional arguments to pass to the callback
   * @returns {number} Timer ID
   */
  window.setTimeout = function (callback, delay, ...args) {
    // Add 5000ms to the original delay
    return originalSetTimeout(callback, delay + 5000, ...args);
  };

  // Restore the original setTimeout after 5 seconds
  originalSetTimeout(() => {
    window.setTimeout = originalSetTimeout;
  }, 5000);
})();
