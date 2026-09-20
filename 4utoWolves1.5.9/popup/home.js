/** Home presentation uses the existing popup/page protocol; it never starts a mode on load. */
(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const settings = { AUTO_PLAY: null, AUTO_REPLAY: null };
  const buttons = { AUTO_PLAY: byId("homeAutoPlay"), AUTO_REPLAY: byId("homeAutoReplay") };
  const names = { AUTO_PLAY: "Auto Play", AUTO_REPLAY: "Auto Replay" };
  const pending = new Map();
  const openedAt = Date.now();
  let lastResponse = 0;
  let disconnected = false;
  let goldActive = false;

  function render() {
    const stale = disconnected || Date.now() - (lastResponse || openedAt) > (lastResponse ? 12000 : 6000);
    const ready = !stale && typeof settings.AUTO_PLAY === "boolean" && typeof settings.AUTO_REPLAY === "boolean";
    const headerState = !ready ? (stale ? "offline" : "waiting")
      : settings.AUTO_PLAY || settings.AUTO_REPLAY || goldActive ? "active" : "paused";
    byId("topbarStatus").dataset.state = headerState;
    byId("connectionLabel").textContent = { active: "ACTIVE", paused: "PAUSED", waiting: "WAITING", offline: "OFFLINE" }[headerState];
    byId("automationCard").dataset.state = headerState;
    // Each badge reflects its own confirmed setting, not live match activity.
    for (const [key, rowId, labelId] of [
      ["AUTO_PLAY", "autoPlayStatus", "automationBadgeLabel"],
      ["AUTO_REPLAY", "autoReplayStatus", "autoReplayBadgeLabel"],
    ]) {
      byId(rowId).dataset.state = !ready ? headerState : settings[key] ? "active" : "paused";
      byId(labelId).textContent = !ready ? (stale ? "OFFLINE" : "WAITING") : settings[key] ? "ENABLED" : "DISABLED";
    }
    for (const [key, button] of Object.entries(buttons)) {
      const updating = pending.has(key);
      button.disabled = !ready || updating;
      button.setAttribute("aria-pressed", String(ready && settings[key]));
      button.setAttribute("aria-busy", String(updating));
      button.title = !ready ? "Aguardando conexão com o jogo" : updating
        ? "Aguardando confirmação do jogo" : `${settings[key] ? "Desativar" : "Ativar"} ${names[key]}`;
      button.setAttribute("aria-label", !ready || updating ? `${names[key]}: ${button.title}` : button.title);
    }
  }

  function metric(id, value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    const formatted = value.toLocaleString(window.popupI18n.locale);
    byId(id).dataset.numericValue = value;
    byId(id).textContent = formatted;
    byId(id).title = formatted;
  }

  function onMessage(message) {
    if (!message || typeof message !== "object") return;
    if (message.type === "UPDATE_UI") {
      if (message.goldFarm) goldActive = !!message.goldFarm.active;
      lastResponse = Date.now();
      disconnected = false;
      metric("homeSessionXP", message.sessionXP);
      metric("homeCoins", message.coins);
      metric("homeRoses", message.roses);
    }
    if ((message.type === "SETTINGS_LOADED" || message.type === "SETTINGS_UPDATED") && message.settings) {
      lastResponse = Date.now();
      disconnected = false;
      for (const key of Object.keys(settings)) {
        if (typeof message.settings[key] !== "boolean") continue;
        settings[key] = message.settings[key];
        if (pending.get(key)?.value === settings[key]) {
          clearTimeout(pending.get(key).timer);
          pending.delete(key);
        }
      }
    }
    render();
  }

  async function toggle(key) {
    if (buttons[key].disabled || typeof settings[key] !== "boolean") return;
    const value = !settings[key];
    const timer = setTimeout(() => {
      pending.delete(key);
      render();
      showFooterNotification("O jogo não confirmou a alteração. Tente novamente.", "error");
    }, 6000);
    pending.set(key, { value, timer });
    render();
    try {
      const tabs = await chrome.tabs.query({ url: "*://www.wolvesville.com/*" });
      // Match the existing popup bridge's choice of game tab.
      if (!tabs[0]) throw new Error("Abra o Wolvesville para alterar esta opção.");
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        type: "POPUP_TO_PAGE",
        data: { type: "SETTING_CHANGE", key, value },
      });
      if (!response?.success) throw new Error("Recarregue o jogo para conectar a extensão.");
      // Completion is confirmed by SETTINGS_UPDATED/LOADED, not by delivery alone.
    } catch (error) {
      clearTimeout(timer);
      pending.delete(key);
      disconnected = true;
      render();
      showFooterNotification(error.message || "Não foi possível alterar a opção.", "error");
    }
  }

  port.onMessage.addListener(onMessage);
  port.onDisconnect.addListener(() => {
    void chrome.runtime.lastError;
    disconnected = true;
    render();
  });
  for (const key of Object.keys(buttons)) buttons[key].addEventListener("click", () => void toggle(key));
  const freshnessTimer = setInterval(render, 1000);
  window.addEventListener("pagehide", () => {
    clearInterval(freshnessTimer);
    for (const entry of pending.values()) clearTimeout(entry.timer);
    pending.clear();
  }, { once: true });
  render();
  // Request after this listener is attached, even if the legacy popup already requested data.
  sendToPage({ type: "REQUEST_UI_DATA" });
  sendToPage({ type: "REQUEST_SETTINGS" });
})();
