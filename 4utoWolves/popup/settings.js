/** Settings page: the live toggles, plus the account/profile fields fed by the game's UPDATE_UI packet. */
(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);

  const TOKEN_SITE_URL = "https://umnordestino.github.io/";
  const licenseGenerateLink = byId("licenseGenerateLink");
  if (licenseGenerateLink && TOKEN_SITE_URL) licenseGenerateLink.href = TOKEN_SITE_URL;

  const profileGenerateLink = byId("profileGenerateLink");
  if (profileGenerateLink && TOKEN_SITE_URL) profileGenerateLink.href = TOKEN_SITE_URL;

  let activatingLicense = false;
  let licenseHintKey = "Assista um vídeo rápido no site para gerar um token gratuito.";
  let licenseExpiryTimestamp = null;
  let hasStoredToken = false;

  function formatLicenseCountdown(ms) {
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return days + "d " + hours + "h";
    if (hours > 0) return hours + "h " + minutes + "m";
    return minutes + "m";
  }

  function renderLicenseHint() {
    const licenseHint = byId("licenseHint");
    if (!licenseHint) return;
    if (licenseExpiryTimestamp) {
      const remaining = licenseExpiryTimestamp - Date.now();
      licenseHint.textContent = remaining > 0
        ? toolsText("Token ativo. Expira em {time}.", window.popupI18n.locale).replace("{time}", formatLicenseCountdown(remaining))
        : toolsText("Token expirado. Gere um novo.", window.popupI18n.locale);
      return;
    }
    licenseHint.textContent = toolsText(licenseHintKey, window.popupI18n.locale);
  }

  function handleMessage(message) {
    if (message.type === "UPDATE_UI") {
      if (message.username) {
        const profileWelcomeTitle = byId("profileWelcomeTitle");
        if (profileWelcomeTitle) profileWelcomeTitle.textContent = message.username;
      }

      if (message.level) {
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
      const isLicenseActive = message.authStatus === "authorized";
      if (licenseStatusElement) {
        licenseStatusElement.textContent = isLicenseActive ? "ATIVO" : hasStoredToken ? "EXPIRADO" : "SEM TOKEN";
        licenseStatusElement.dataset.state = isLicenseActive ? "active" : hasStoredToken ? "expired" : "missing";
      }

      // Hide the "paste your token" form while a token is active; it reappears
      // automatically once the token expires and authStatus flips back.
      const licenseForm = byId("licenseForm");
      if (licenseForm) licenseForm.classList.toggle("hidden", isLicenseActive);
      licenseExpiryTimestamp = isLicenseActive && message.licenseExpiry ? new Date(message.licenseExpiry).getTime() : null;
      if (!isLicenseActive && !activatingLicense && licenseHintKey === "Token ativado com sucesso.") {
        licenseHintKey = "Token expirado. Gere um novo.";
      }
      renderLicenseHint();
    }

    if (message.type === "SETTINGS_UPDATED" || message.type === "SETTINGS_LOADED") {
      const settings = message.settings;
      if (!settings || typeof settings !== "object") return;

      const showHiddenLvlToggle = byId("showHiddenLvlToggle");
      if (showHiddenLvlToggle) showHiddenLvlToggle.checked = settings.SHOW_HIDDEN_LVL;
    }

    if (message.type === "LICENSE_UPDATE_RESULT") {
      activatingLicense = false;
      licenseHintKey = message.valid ? "Token ativado com sucesso." : "Token inválido ou expirado. Gere um novo.";
      renderLicenseHint();
    }

    // Restore the saved token in the input so it doesn't look like it "disappeared"
    // just because the popup reopened with a fresh, empty DOM.
    if (message.type === "LICENSE_TOKEN_INFO") {
      hasStoredToken = !!message.token;
      const licenseTokenInput = byId("licenseTokenInput");
      if (licenseTokenInput && !licenseTokenInput.value && message.token) {
        licenseTokenInput.value = message.token;
      }
    }
  }

  port.onMessage.addListener(handleMessage);
  window.addEventListener("languagechange", renderLicenseHint);
  renderLicenseHint();
  sendToPage({ type: "REQUEST_LICENSE_TOKEN" });
  const licenseCountdownTimer = setInterval(renderLicenseHint, 60000);
  window.addEventListener("pagehide", () => clearInterval(licenseCountdownTimer), { once: true });

  const licenseActivateButton = byId("licenseActivateButton");
  const licenseTokenInput = byId("licenseTokenInput");
  if (licenseActivateButton) {
    licenseActivateButton.addEventListener("click", () => {
      if (activatingLicense) return;
      const token = (licenseTokenInput?.value || "").trim();
      if (!token) return;
      activatingLicense = true;
      hasStoredToken = true;
      sendToPage({ type: "SET_LICENSE_TOKEN", token });
    });
  }

  const showHiddenToggle = byId("showHiddenLvlToggle");
  if (showHiddenToggle) {
    showHiddenToggle.addEventListener("change", function () {
      sendToPage({ type: "SETTING_CHANGE", key: "SHOW_HIDDEN_LVL", value: this.checked });
    });
  }
})();
