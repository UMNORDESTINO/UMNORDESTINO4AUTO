/** Settings page: the live toggles, plus the account/profile fields fed by the game's UPDATE_UI packet. */
(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);

  function handleMessage(message) {
    if (message.type === "UPDATE_UI") {
      if (message.username) {
        const profileWelcomeTitle = byId("profileWelcomeTitle");
        if (profileWelcomeTitle) profileWelcomeTitle.textContent = message.username;
      }

      if (message.level) {
        const userLevelElement = byId("userLevel");
        if (userLevelElement) userLevelElement.textContent = message.level;
        const profileLevelTitle = byId("profileLevelTitle");
        if (profileLevelTitle) profileLevelTitle.textContent = message.level;
      }

      // XP progress toward the next level, scraped from the game UI.
      if (message.xpProgress) {
        const { current, total } = message.xpProgress;
        const profileLevelProgress = byId("profileLevelProgress");
        const profileLevelCaption = byId("profileLevelCaption");
        if (profileLevelProgress && total > 0) {
          profileLevelProgress.max = total;
          profileLevelProgress.value = current;
        }
        if (profileLevelCaption && total > 0) {
          const remaining = Math.max(0, total - current);
          profileLevelCaption.textContent = remaining.toLocaleString() + " XP restantes para o próximo nível";
        }
      }

      const licenseStatusElement = byId("licenseStatus");
      if (licenseStatusElement) licenseStatusElement.textContent = "Unlimited";
    }

    if (message.type === "SETTINGS_UPDATED" || message.type === "SETTINGS_LOADED") {
      const settings = message.settings;
      if (!settings || typeof settings !== "object") return;

      const showHiddenLvlToggle = byId("showHiddenLvlToggle");
      if (showHiddenLvlToggle) showHiddenLvlToggle.checked = settings.SHOW_HIDDEN_LVL;

      const debugModeToggle = byId("debugModeToggle");
      if (debugModeToggle) debugModeToggle.checked = settings.DEBUG_MODE;
    }
  }

  port.onMessage.addListener(handleMessage);

  const showHiddenToggle = byId("showHiddenLvlToggle");
  if (showHiddenToggle) {
    showHiddenToggle.addEventListener("change", function () {
      sendToPage({ type: "SETTING_CHANGE", key: "SHOW_HIDDEN_LVL", value: this.checked });
    });
  }

  const debugModeToggle = byId("debugModeToggle");
  if (debugModeToggle) {
    debugModeToggle.addEventListener("change", function () {
      sendToPage({ type: "SETTING_CHANGE", key: "DEBUG_MODE", value: this.checked });
    });
  }
})();
