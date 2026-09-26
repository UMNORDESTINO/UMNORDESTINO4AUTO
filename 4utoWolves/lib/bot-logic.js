/**
 * @fileoverview 4utoWolves - Main bot logic for Wolvesville
 * @description This file contains the main bot logic including:
 * - Fetch and WebSocket request interception
 * - Game event handling (Socket.IO)
 * - Auto-replay and auto-play
 * - Inventory and rewards management
 * @version 0.6.9
 */

// =============================================================================
// ANTI-DEBUG AND CONSOLE PROTECTION (Disabled in deobfuscated version)
// =============================================================================

/**
 * @description Anti-debug protection configuration
 * In the original version, this blocks the console and developer tools
 */
const FORCE_BLOCK_CONSOLE = false; // Disabled for debugging

// =============================================================================
// GLOBAL VARIABLES
// =============================================================================

/** @type {boolean} Current authentication state (requires a valid license token) */
var IS_AUTHENTICATED = false;

/**
 * Update authentication state and reflect it in the page overlay
 * @param {boolean} state - New authentication state
 */
function setAuthState(state) {
  IS_AUTHENTICATED = !!state;
  if (IS_AUTHENTICATED) hideDeactivatedOverlay();
  else showDeactivatedOverlay();
}

/** @type {string} Authenticated username */
var AUTH_USERNAME = "";

/** @type {string} Bot version */
var BOT_VERSION = "0.6.9";

/** @type {Object} Wolvesville authentication tokens */
var AUTHTOKENS = {
  idToken: "",
  refreshToken: "",
  "Cf-JWT": "",
};

/** @type {Object|undefined} Current player information */
var PLAYER = undefined;

/** @type {Object|undefined} Player inventory */
var INVENTORY = undefined;

/** @type {Array} Message history */
var HISTORY = [];

/** @type {Array} Players list in the game */
var PLAYERS = [];

/** @type {Object|undefined} Current player role */
var ROLE = undefined;

/** @type {string|undefined} Game state (started, over, etc.) */
var GAME_STATUS = undefined;

/** @type {number} Golden wheel spins counter */
var GOLD_WHEEL_SPINS_COUNTER = 0;

/** @type {number} Total silver earned in session via golden wheel */
var GOLD_WHEEL_SILVER_SESSION = 0;

/** @type {number} Total XP earned in session */
var TOTAL_XP_SESSION = 0;

/** @type {number} Levels gained in session */
var TOTAL_UP_LEVEL = 0;

/** @type {number} Game start timestamp */
var GAME_STARTED_AT = 0;

/**
 * @typedef {Object} LVSettings
 * @property {boolean} DEBUG_MODE - Debug mode enabled
 * @property {boolean} SHOW_HIDDEN_LVL - Show hidden levels
 * @property {boolean} AUTO_REPLAY - Auto-replay
 * @property {boolean} AUTO_PLAY - Auto-play
 * @property {boolean} CHAT_STATS - Chat statistics
 */

/** @type {LVSettings} Bot settings */
var LV_SETTINGS = {
  DEBUG_MODE: false,
  SHOW_HIDDEN_LVL: true,
  AUTO_REPLAY: false,
  AUTO_PLAY: false,
  CHAT_STATS: true,
};

/** @type {string} License expiration date */
var licenseExpiry = "";

/** @type {boolean} Golden wheel available */
var goldWheelAvailable = false;

/** @type {string} Golden wheel status */
var goldWheelStatus = "Checking...";

/** @type {number|undefined} Interval for auto-replay */
var AUTO_REPLAY_INTERVAL = undefined;

/** @type {Object|undefined} Main socket for auto-play */
var SOCKET = undefined;

/** @type {Object|undefined} Regular socket for XP */
var REGULARSOCKET = undefined;

/** @type {string|undefined} Current game ID */
var GAME_ID = undefined;

/** @type {string|undefined} Game server URL */
var SERVER_URL = undefined;

/** @type {Object|undefined} Game settings */
var GAME_SETTINGS = undefined;

/** @type {number} Day counter */
let DAY_COUNT = 0;

/** @type {Array} Day votes */
let DAY_VOTING = [];

/** @type {string} Game vote */
let GAME_VOTING = "";

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Wait for player to be loaded
 * @param {number} timeout - Timeout in ms (default: 10000)
 * @returns {Promise<string|null>} Username or null
 */
const waitForPlayer = (timeout = 10000) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (PLAYER && PLAYER.username) {
        clearInterval(interval);
        resolve(PLAYER.username);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        resolve(null);
      }
    }, 100);
  });
};

/**
 * Send XP earned to background script (disabled - no external server)
 * @param {Object} data - XP data (player_id, xp_amount, username)
 * @returns {Promise<Object>} Simulated response
 */
const sendXpToBackground = (data) => {
  // XP tracking disabled - no external server
  return Promise.resolve({
    status: 200,
    data: { message: "XP tracking disabled" },
  });
};

/**
 * Conditional logger (only in debug mode)
 * @param {...any} args - Arguments to log
 */
const log = (...args) => {
  if (LV_SETTINGS.DEBUG_MODE) {
    console.log(...args);
  }
};

/**
 * Create a delay
 * @param {number} ms - Milliseconds (default: 500)
 * @returns {Promise<void>}
 */
const delay = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms));

// =============================================================================
// AUTHENTICATION (license token, verified against the license server)
// =============================================================================

/**
 * Authenticate the bot: verify the stored license token (independent of player
 * detection, which can take a while right after a page reload and must not
 * block/deny a valid token), then best-effort detect the player for AUTH_USERNAME.
 * @returns {Promise<boolean>} Authentication success
 */
const authenticateBot = async () => {
  try {
    const result = await LICENSE.verify(LICENSE.getStoredToken());
    if (!result.valid) {
      licenseExpiry = "";
      return false;
    }
    licenseExpiry = new Date(result.expiresAt).toISOString();

    // Best-effort username detection for display purposes only; never blocks the license.
    let username = await waitForPlayer(8000);
    if (!username) {
      username = localStorage.getItem("bot-username");
    } else {
      localStorage.setItem("bot-username", username);
    }
    if (username) AUTH_USERNAME = username;

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Re-check the license token periodically; deactivates the bot if it expired.
 * @returns {Promise<boolean>} Authentication state
 */
const recheckAuthentication = async () => {
  const result = await LICENSE.verify(LICENSE.getStoredToken());
  if (!result.valid) {
    licenseExpiry = "";
    setAuthState(false);
    if (SOCKET) {
      SOCKET.disconnect();
      SOCKET = undefined;
    }
    if (REGULARSOCKET) {
      REGULARSOCKET.disconnect();
      REGULARSOCKET = undefined;
    }
    return false;
  }
  licenseExpiry = new Date(result.expiresAt).toISOString();
  setAuthState(true);
  return true;
};

// =============================================================================
// SETTINGS MANAGEMENT
// =============================================================================

/**
 * Save settings to localStorage
 */
const saveSetting = () => {
  let settings = {
    DEBUG_MODE: LV_SETTINGS.DEBUG_MODE,
    SHOW_HIDDEN_LVL: LV_SETTINGS.SHOW_HIDDEN_LVL,
    AUTO_REPLAY: LV_SETTINGS.AUTO_REPLAY,
    AUTO_PLAY: LV_SETTINGS.AUTO_PLAY,
    CHAT_STATS: LV_SETTINGS.CHAT_STATS,
  };
  localStorage.setItem("lv-settings", JSON.stringify(settings));
  console.log("⚙️ Settings saved:", settings);
};

/**
 * Load settings from localStorage
 */
const loadSettings = () => {
  // Automation requires a fresh opt-in each time the game page starts.
  LV_SETTINGS.AUTO_PLAY = false;
  LV_SETTINGS.AUTO_REPLAY = false;
  const saved = localStorage.getItem("lv-settings");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      for (const key of Object.keys(LV_SETTINGS)) {
        if (key === "AUTO_PLAY" || key === "AUTO_REPLAY") continue;
        if (typeof parsed?.[key] === "boolean") {
          LV_SETTINGS[key] = parsed[key];
        }
      }
      saveSetting();
      console.log("⚙️ Settings loaded:", LV_SETTINGS);
    } catch (e) {
      console.error("⚠️ Failed to load settings:", e);
      saveSetting();
    }
  } else {
    console.log("⚙️ No saved settings, using defaults");
    saveSetting();
  }
};

/**
 * Send settings to popup
 */
function sendSettings() {
  window.postMessage({ type: "SETTINGS_UPDATED", settings: LV_SETTINGS }, "*");
}

// =============================================================================
// TOKEN AND HEADER MANAGEMENT
// =============================================================================

/**
 * Retrieve authentication tokens from localStorage
 */
const getAuthtokens = () => {
  try {
    const tokens = JSON.parse(localStorage.getItem("authtokens"));
    if (tokens) {
      console.log("authtokens found baby");
      AUTHTOKENS.idToken = tokens.idToken || "";
      AUTHTOKENS.refreshToken = tokens.refreshToken || "";
    } else {
      console.log("authtokens not found", tokens);
    }
  } catch (e) {
    console.log("Failed to parse authtokens from localStorage", e);
  }
};

/**
 * Generate headers for Wolvesville API requests
 * @returns {Object} HTTP headers
 */
const getHeaders = () => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  Authorization: "Bearer " + AUTHTOKENS.idToken,
  "Cf-JWT": "" + AUTHTOKENS["Cf-JWT"],
  ids: 1,
});

/**
 * Generate secret for wheel rewards
 * @returns {string} Calculated secret
 */
const getRewardSecret = () => {
  const playerId = PLAYER?.id || "";
  const silverCount = INVENTORY?.silverCount || 0;
  const xpTotal = PLAYER?.xpTotal || 0;
  const roseCount = INVENTORY?.roseCount || 0;

  log(playerId, silverCount, xpTotal, roseCount);

  return (
    "" +
    playerId.charAt(silverCount % 32) +
    playerId.charAt(xpTotal % 32) +
    new Date().getTime().toString(16) +
    playerId.charAt((silverCount + 1) % 32) +
    playerId.charAt(roseCount % 32)
  );
};

// Tools run in the game tab so limits keep working with the popup closed.
const TOOLS = createToolsController({
  storage: localStorage,
  onStop(farm) {
    if (farm === "gold") GOLD_FARM.stop();
    else {
      LV_SETTINGS.AUTO_PLAY = false;
      LV_SETTINGS.AUTO_REPLAY = false;
      saveSetting();
      handleAutoReplay();
      sendSettings();
    }
  },
  onReset(farm) {
    if (farm === "xp") { TOTAL_XP_SESSION = 0; TOTAL_UP_LEVEL = 0; }
    else { GOLD_WHEEL_SPINS_COUNTER = 0; GOLD_WHEEL_SILVER_SESSION = 0; }
  },
  onNotice(notice) { window.postMessage({type:"TOOLS_NOTICE", notice}, "*"); },
});
let toolsReply = null;
function handleToolsCommand(data) {
  try {
    switch (data.action) {
      case "save": TOOLS.configure(data.settings); break;
      case "reset":
        if ((data.farm === "gold" || data.farm === "all") && GOLD_FARM.snapshot().busy) throw new Error("busy");
        TOOLS.reset(data.farm); break;
      case "saveProfile": TOOLS.saveProfile(data.name); break;
      case "applyProfile": TOOLS.applyProfile(data.profileId); break;
      case "deleteProfile": TOOLS.deleteProfile(data.profileId); break;
      case "restore": TOOLS.restore(); break;
      default: throw new Error("invalid_settings");
    }
    toolsReply = {id:data.commandId, ok:true};
  } catch (error) { toolsReply = {id:data.commandId, ok:false, error:error.message}; }
  sendUIUpdate();
}
function recordXpAward(gameId, amount) {
  TOTAL_XP_SESSION += TOOLS.xpAward(gameId, amount);
}
function guardXpSocket(socket, regular = false) {
  socket.on?.("connect_error", () => {
    if (TOOLS.snapshot().sessions.xp.active) TOOLS.notice("error", "xp");
  });
  socket.on?.("disconnect", reason => {
    if (["transport close", "transport error", "ping timeout"].includes(reason) && TOOLS.snapshot().sessions.xp.active) TOOLS.notice("disconnect", "xp");
  });
  const originalEmit = socket.emit.bind(socket);
  socket.emit = function (event, ...args) {
    if (typeof event === "string" && (event.startsWith("game-") || event.startsWith("game:"))) {
      if (!(LV_SETTINGS.AUTO_PLAY || (regular && LV_SETTINGS.AUTO_REPLAY)) || !TOOLS.allow("xp")) return socket;
    }
    return originalEmit(event, ...args);
  };
}
setInterval(() => TOOLS.tick(), 1000);
window.addEventListener("offline", () => {
  const snapshot = TOOLS.snapshot();
  for (const farm of ["xp", "gold"]) if (snapshot.sessions[farm].active) TOOLS.notice("disconnect", farm);
});

// Use the original transport so each farm reward is accounted for exactly once.
let goldCommandId = null;
let goldDiagnostic = {
  at: null,
  endpoint: null,
  method: null,
  status: null,
  contentType: null,
  response: null,
  error: null,
};
const goldFetch = window.fetch.bind(window);

function sanitizeGoldDiagnostic(value) {
  const secretKey = /token|authorization|cookie|jwt|secret/i;
  const walk = (item, depth = 0) => {
    if (depth > 8) return '[max-depth]';
    if (Array.isArray(item)) return item.slice(0, 50).map(v => walk(v, depth + 1));
    if (item && typeof item === 'object') {
      const out = {};
      for (const [key, val] of Object.entries(item)) {
        out[key] = secretKey.test(key) ? '[redacted]' : walk(val, depth + 1);
      }
      return out;
    }
    if (typeof item === 'string' && item.length > 1200) return item.slice(0, 1200) + '…';
    return item;
  };
  return walk(value);
}

function setGoldDiagnostic(patch) {
  goldDiagnostic = { ...goldDiagnostic, ...patch, at: Date.now() };
}

function redactGoldDiagnosticText(text) {
  return String(text || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/=-]+/gi, 'Bearer [redacted]')
    .replace(/(idToken|refreshToken|cf-jwt|authorization)\s*["'=:\s]+[^,}\s]+/gi, '$1: [redacted]')
    .slice(0, 6000);
}

function recordGoldReward(winner) {
  const earned = Number.isFinite(winner.silver) && winner.silver >= 0 ? winner.silver : 0;
  if (!INVENTORY) INVENTORY = { silverCount: 0, roseCount: 0 };
  INVENTORY.silverCount = (Number(INVENTORY.silverCount) || 0) + earned;
  GOLD_WHEEL_SPINS_COUNTER += 1;
  GOLD_WHEEL_SILVER_SESSION += earned;
  TOOLS.record("gold", earned, 1);
  if (PLAYER) PLAYER.silverCount = INVENTORY.silverCount;
  sendUIUpdate();
}
function createGoldUiFarm() {
  const state = { active: false, busy: false, status: "stopped", nextAt: null, error: null, phase: null };
  let generation = 0;

  const snapshot = () => ({ ...state });
  const emit = () => {
    TOOLS.setActive("gold", state.active || state.busy);
    if (state.status === "error") TOOLS.notice("error", "gold");
    goldWheelAvailable = !state.busy && state.status === "stopped";
    goldWheelStatus = state.status === "ad" ? "Watching ad" :
      state.status === "closing_ad" ? "Closing ad" :
      state.status === "advancing_ad" ? "Advancing ad" :
      state.status === "ready_to_spin" ? "Ready to spin" :
      state.status === "spinning" ? "Spinning" :
      state.status === "error" ? "Unavailable" :
      state.status === "stopped" ? "Available" : "Checking...";
    sendUIUpdate();
  };
  const setState = (patch) => { Object.assign(state, patch); emit(); };
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalize = value => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  const visible = el => {
    if (!el || !el.isConnected) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 8 && r.height >= 8 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  };
  const candidates = () => Array.from(document.querySelectorAll('button,[role="button"],a,div,span'));
  const findText = regexes => {
    let best = null;
    for (const el of candidates()) {
      if (!visible(el)) continue;
      const text = normalize(el.innerText || el.textContent);
      if (!text || text.length > 80) continue;
      if (!regexes.some(rx => rx.test(text))) continue;
      const r = el.getBoundingClientRect();
      const score = (el.tagName === 'BUTTON' ? 1000 : 0) + (el.getAttribute('role') === 'button' ? 500 : 0) - (r.width * r.height / 10000);
      if (!best || score > best.score) best = { el, score };
    }
    return best?.el || null;
  };
  const clickElement = async (el) => {
    if (!visible(el)) throw new Error('ui_not_found');
    const r = el.getBoundingClientRect();
    window.postMessage({ type: "FROM_PAGE_CLICK", x: r.left + r.width / 2, y: r.top + r.height / 2 }, "*");
    await pause(250);
  };
  const adIsOpen = () => {
    // The #goog_fullscreen_ad hash may remain after the ad closes, so visible wheel controls win.
    if (findWatchAd() || findSpin()) return false;
    const adFrames = Array.from(document.querySelectorAll('iframe[src*="googleads"],iframe[src*="doubleclick"],iframe[id*="google_ads"]'));
    if (adFrames.some(visible)) return true;
    return location.hash.includes('goog_fullscreen_ad');
  };
  const findInventoryButton = () => findText([
    /^invent[aá]rio$/i, /^inventory$/i, /^inventario$/i, /^inventaire$/i, /^inventario\s*$/i
  ]);
  const findFreeGold = () => findText([/^ouro gr[aá]tis!?$/i, /^free gold!?$/i, /^oro gratis!?$/i, /^or gratuit!?$/i]);
  const findWatchAd = () => findText([
    /^assistir v[ií]deo$/i, /assistir.*v[ií]deo/i, /^watch.*video$/i, /watch.*ad/i,
    /^ver.*v[ií]deo$/i, /ver.*an[uú]ncio/i
  ]);
  const findSpin = () => findText([/^girar$/i, /girar.*roleta/i, /^spin$/i, /spin.*wheel/i]);
  const adControlLabel = el => normalize([
    el?.getAttribute?.('aria-label'), el?.getAttribute?.('title'),
    el?.getAttribute?.('data-tooltip'), el?.innerText, el?.textContent
  ].filter(Boolean).join(' '));
  const findAdControl = kind => {
    const selectors = 'button,[role="button"],a,div,span,[aria-label],[title],[data-tooltip]';
    let best = null;
    for (const el of document.querySelectorAll(selectors)) {
      if (!visible(el)) continue;
      const label = adControlLabel(el);
      if (!label || label.length > 100) continue;
      const closeMatch = /^(fechar|close|dismiss|done|concluir|×|✕|✖|x)$/i.test(label) ||
        /fechar (o )?an[uú]ncio|close ad|dismiss ad|close video|fechar v[ií]deo/i.test(label);
      const advanceMatch = /^(pular|skip|avan[cç]ar|continuar|continue|next|pr[oó]ximo|>>|›|»|→)$/i.test(label) ||
        /skip ad|pular an[uú]ncio|ir para o final|go to end|next ad|pr[oó]ximo an[uú]ncio/i.test(label);
      if ((kind === 'close' && !closeMatch) || (kind === 'advance' && !advanceMatch)) continue;
      const r = el.getBoundingClientRect();
      // Ad controls tend to live near the top/right edge. Prefer those without requiring it.
      const edgeBonus = (r.right > innerWidth * .72 ? 500 : 0) + (r.top < innerHeight * .35 ? 300 : 0);
      const score = (el.tagName === 'BUTTON' ? 1000 : 0) + (el.getAttribute('role') === 'button' ? 500 : 0) + edgeBonus;
      if (!best || score > best.score) best = { el, score };
    }
    return best?.el || null;
  };
  const findClose = () => findAdControl('close');
  const findAdvance = () => findAdControl('advance');
  // Google fullscreen ads can expose an X before the reward is earned. Clicking it opens
  // a confirmation dialog such as "Close Ad? You will lose your reward". Never confirm it.
  const rewardLossDialogVisible = () => {
    const bodyText = normalize(document.body?.innerText || document.body?.textContent || '');
    return /close ad\?|you will lose your reward|lose your reward|perder[aá].*recompensa|perder.*recompensa/i.test(bodyText);
  };
  const findResumeAd = () => findText([
    /^resume$/i, /^retomar$/i, /^continuar$/i, /^continue$/i, /voltar.*an[uú]ncio/i, /resume.*ad/i
  ]);
  async function waitFor(predicate, timeout, token, interval = 300) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (token !== generation) throw new Error('stopped');
      let value = null;
      try { value = predicate(); } catch (_) {}
      if (value) return value;
      await pause(interval);
    }
    return null;
  }
  async function closeAd(token) {
    setState({ status: 'ad', phase: 'watching_ad', nextAt: null, error: null });
    const openedAt = Date.now();
    // A real ad close/skip control never appears the instant the ad opens. Waiting a few
    // seconds before honoring findClose()/findAdvance() avoids clicking a stray Wolvesville
    // control left visible behind the ad overlay (e.g. a modal "X" or a "Continuar" button)
    // that matches the same broad close/advance text and would dismiss the flow immediately.
    const minWatchMs = 4000;
    let readySignals = 0;
    // Ads are multi-stage: sometimes a Skip/arrow appears first, then the final X/Close.
    // Keep observing until the Wolvesville UI is genuinely back instead of assuming one click ends it.
    while (Date.now() - openedAt < 75000) {
      if (token !== generation) throw new Error('stopped');
      if (!adIsOpen() && (findFreeGold() || findSpin() || findWatchAd())) {
        // A wheel control left behind the ad overlay can read as "visible" for one instant
        // even though the ad still covers it on screen. Require the signal twice in a row,
        // ~300ms apart, before trusting that the ad genuinely closed.
        readySignals++;
        if (readySignals >= 2) return true;
        await pause(300);
        continue;
      }
      readySignals = 0;

      // If an early X opened the "lose your reward" confirmation, immediately resume the ad.
      // This makes the close detection dynamic: an early close attempt is rejected and watching continues.
      if (rewardLossDialogVisible()) {
        const resume = findResumeAd();
        if (resume) {
          setState({ status: 'ad', phase: 'resuming_ad' });
          setGoldDiagnostic({ response: 'Early close detected: reward is not ready yet. Clicking RESUME and continuing the ad.' });
          await clickElement(resume);
          await pause(1200);
          setState({ status: 'ad', phase: 'watching_ad' });
          continue;
        }
        // Never let the generic close detector click CLOSE inside this confirmation.
        setGoldDiagnostic({ response: 'Reward-loss confirmation detected. Waiting for RESUME instead of closing the ad.' });
        await pause(350);
        continue;
      }

      if (Date.now() - openedAt >= minWatchMs) {
        const close = findClose();
        if (close) {
          setState({ status: 'closing_ad', phase: 'closing_ad' });
          setGoldDiagnostic({ response: 'Ad close control detected. Clicking and waiting for Wolvesville to return.' });
          await clickElement(close);
          const closeOutcome = await waitFor(() => {
            if (rewardLossDialogVisible()) return 'too_early';
            if (!adIsOpen() && (findFreeGold() || findSpin() || findWatchAd())) return 'closed';
            return null;
          }, 4500, token, 180);
          if (closeOutcome === 'closed') return true;
          if (closeOutcome === 'too_early') {
            const resume = findResumeAd() || await waitFor(findResumeAd, 2500, token, 150);
            if (resume) {
              setState({ status: 'ad', phase: 'resuming_ad' });
              setGoldDiagnostic({ response: 'Close was too early and would lose the reward. RESUME selected automatically.' });
              await clickElement(resume);
              await pause(1200);
            }
            setState({ status: 'ad', phase: 'watching_ad' });
            continue;
          }
          // It may have closed only one ad stage. Resume observation for a final X.
          setState({ status: 'ad', phase: 'watching_ad' });
          await pause(700);
          continue;
        }

        const advance = findAdvance();
        if (advance) {
          setState({ status: 'advancing_ad', phase: 'advancing_ad' });
          setGoldDiagnostic({ response: 'Ad skip/advance control detected. Advancing to the final ad screen.' });
          await clickElement(advance);
          await pause(1200);
          setState({ status: 'ad', phase: 'watching_ad' });
          continue;
        }
      }

      // If an ad control lives inside a protected cross-origin frame, do not guess its
      // screen position. Blind top-right clicks can hit Wolvesville controls such as Help (?).
      // Keep observing until a real, inspectable ad control or a known Wolvesville state appears.
      setState({ status: 'ad', phase: 'watching_ad' });
      await pause(450);
    }
    return !adIsOpen() && !!(findFreeGold() || findSpin() || findWatchAd());
  }
  async function openInventoryIfNeeded(token) {
    // At the beginning of a farm cycle Wolvesville may be on the main menu.
    // Enter Inventory first; the Free Gold control lives on the customization/inventory screen.
    if (findFreeGold() || findWatchAd() || findSpin() || adIsOpen()) return true;
    setState({ status: 'checking', phase: 'opening_inventory', error: null });
    let inventory = findInventoryButton();
    if (!inventory) inventory = await waitFor(findInventoryButton, 10000, token, 250);
    if (!inventory) return false;
    setGoldDiagnostic({ response: 'Inventory button found. Opening Inventory before Gold Wheel.' });
    await clickElement(inventory);
    return !!(findFreeGold() || findWatchAd() || findSpin() ||
      await waitFor(() => findFreeGold() || findWatchAd() || findSpin(), 10000, token, 250));
  }
  async function openGoldWheel(token, reason = 'Opening Gold Wheel') {
    if (findWatchAd() || findSpin()) return true;
    setState({ status: 'checking', phase: 'opening_gold_wheel', error: null });
    let freeGold = findFreeGold();
    if (!freeGold) freeGold = await waitFor(findFreeGold, 10000, token, 250);
    if (!freeGold) return false;
    setGoldDiagnostic({ response: reason + ': Ouro grátis button found. Opening wheel.' });
    await clickElement(freeGold);
    return !!(findWatchAd() || findSpin() || await waitFor(() => findWatchAd() || findSpin(), 10000, token, 250));
  }
  async function cycle(token) {
    const beforeSpins = GOLD_WHEEL_SPINS_COUNTER;
    const beforeSilver = Number(INVENTORY?.silverCount) || 0;
    setGoldDiagnostic({ endpoint: 'UI automation', method: 'DOM + trusted click', status: null, contentType: 'ui', response: 'Starting Gold Wheel flow', error: null });
    setState({ busy: true, status: 'checking', phase: 'opening_gold_wheel', error: null, nextAt: null });

    // Start from the Wolvesville main menu when necessary: Inventory -> Free Gold -> ad/wheel.
    const inventoryReady = await openInventoryIfNeeded(token);
    if (!inventoryReady && !findFreeGold() && !findWatchAd() && !findSpin() && !adIsOpen()) throw new Error('inventory_button_not_found');
    // Wolvesville returns to the avatar/customization screen after a fullscreen ad.
    // Always enter the Gold Wheel from the visible "Ouro grátis!" control when needed.
    const openedAtStart = await openGoldWheel(token, 'Starting cycle');
    if (!openedAtStart && !adIsOpen() && !findWatchAd() && !findSpin()) throw new Error('gold_button_not_found');
    setState({ status: 'checking', phase: 'finding_ad_button' });
    let watch = findWatchAd();
    if (!watch && !adIsOpen()) watch = await waitFor(findWatchAd, 10000, token);
    if (watch) {
      setGoldDiagnostic({ response: 'Watch video button found. Opening ad.' });
      await clickElement(watch);
    }

    if (token !== generation) throw new Error('stopped');
    // adIsOpen() only recognizes Google Ads iframes/hash. Some ad networks never match that
    // heuristic, so rely on it as a best-effort signal only: if we just clicked to watch an ad,
    // always wait it out via closeAd() instead of skipping straight to Spin when it stays false.
    const adOpened = adIsOpen() || await waitFor(adIsOpen, 7000, token, 250) || !!watch;
    if (adOpened) {
      setGoldDiagnostic({ response: 'Ad opened. Waiting for completion before closing.' });
      const closed = await closeAd(token);
      if (!closed) throw new Error('ad_close_failed');
      setGoldDiagnostic({ response: 'Ad closed. Reopening Gold Wheel from Ouro grátis before spinning.' });
      // The game returns to the avatar screen after the ad. Re-enter the wheel before looking for Girar.
      const reopened = await openGoldWheel(token, 'After ad');
      if (!reopened && !findSpin() && GOLD_WHEEL_SPINS_COUNTER <= beforeSpins) throw new Error('gold_button_not_found');
    } else {
      // The ad may have just been completed manually; continue if spin is already available.
      if (!findSpin() && GOLD_WHEEL_SPINS_COUNTER <= beforeSpins) throw new Error('ad_button_not_found');
    }

    if (token !== generation) throw new Error('stopped');
    // Some Wolvesville builds auto-spin after the ad. If that happened, there is nothing else to click.
    const autoReward = await waitFor(() => GOLD_WHEEL_SPINS_COUNTER > beforeSpins, 2500, token, 200);
    if (!autoReward) {
      setState({ status: 'ready_to_spin', phase: 'finding_spin_button' });
      // Some builds ask to confirm a second ad ("Watch a short video ad to spin the wheel!")
      // right before the spin instead of showing the Spin button directly. Handle it here too.
      let spin = findSpin();
      const spinWaitStarted = Date.now();
      while (!spin && Date.now() - spinWaitStarted < 10000) {
        if (token !== generation) throw new Error('stopped');
        const confirmWatch = findWatchAd();
        if (confirmWatch) {
          setGoldDiagnostic({ response: '"Watch video to spin" prompt detected. Clicking Watch video.' });
          await clickElement(confirmWatch);
          // adIsOpen() is a best-effort signal only (it only recognizes Google Ads iframes/hash);
          // always wait it out via closeAd() since we just clicked to watch an ad regardless.
          await waitFor(adIsOpen, 7000, token, 250);
          const closed = await closeAd(token);
          if (!closed) throw new Error('ad_close_failed');
          spin = findSpin();
          continue;
        }
        await pause(250);
        spin = findSpin();
      }
      if (!spin) throw new Error('spin_button_not_found');
      setGoldDiagnostic({ response: 'Spin button found. Starting wheel.' });
      await clickElement(spin);
      setState({ status: 'spinning', phase: 'waiting_spin_complete' });

      // Do not make reward parsing a fatal dependency. Wolvesville can award the coins
      // without exposing the reward event in the format intercepted by this extension.
      // A cycle is considered complete when either the normal reward event arrives,
      // the visible balance changes, or the wheel returns to a known ready state.
      const completed = await waitFor(() => {
        if (GOLD_WHEEL_SPINS_COUNTER > beforeSpins) return 'reward_event';
        const currentSilver = Number(INVENTORY?.silverCount) || 0;
        if (currentSilver > beforeSilver) return 'balance_changed';
        if (findWatchAd() || findFreeGold()) return 'wheel_ready';
        return null;
      }, 45000, token, 250);

      if (!completed) {
        // A slow/odd animation is now a warning, not a farm-killing reward_timeout.
        // Give the UI a short grace period, then continue the next cycle if possible.
        setGoldDiagnostic({ response: 'Wheel completion signal was not explicit. Continuing without requiring reward parsing.', error: null });
        await pause(1500);
      }

      if (GOLD_WHEEL_SPINS_COUNTER <= beforeSpins) {
        // The game completed the spin but our old winner parser did not fire.
        // Count the completed cycle without altering the real inventory balance.
        const currentSilver = Number(INVENTORY?.silverCount) || 0;
        const delta = Math.max(0, currentSilver - beforeSilver);
        GOLD_WHEEL_SPINS_COUNTER += 1;
        GOLD_WHEEL_SILVER_SESSION += delta;
        TOOLS.record("gold", delta, 1);
        sendUIUpdate();
        setGoldDiagnostic({
          response: delta > 0
            ? 'Wheel completed. Reward inferred from balance change: +' + delta + ' coins.'
            : 'Wheel completed. Reward value was not identified, but the farm will continue.',
          error: null
        });
      }
    }

    const earned = GOLD_WHEEL_SILVER_SESSION;
    setGoldDiagnostic({ status: 200, response: 'UI cycle completed. Next cycle can start without depending on reward parsing.', error: null });
    if (token !== generation) throw new Error('stopped');
    if (state.active) {
      setState({ busy: false, status: 'checking', phase: 'next_cycle', nextAt: Date.now() + 1800 });
      await pause(1800);
      if (token === generation && state.active) return cycle(token);
    } else {
      setState({ busy: false, status: 'stopped', phase: null, nextAt: null, error: null });
    }
    return earned;
  }
  async function run(token) {
    try {
      await cycle(token);
    } catch (error) {
      if (error.message === 'stopped' || token !== generation) return;
      const known = {
        inventory_button_not_found: 'inventory_button_not_found', ad_button_not_found: 'ad_button_not_found', gold_button_not_found: 'gold_button_not_found', ad_close_failed: 'ad_close_failed',
        spin_button_not_found: 'spin_button_not_found', reward_timeout: 'reward_timeout',
        ui_not_found: 'ui_not_found'
      };
      const code = known[error.message] || 'network';
      setGoldDiagnostic({ error: code, response: 'UI automation stopped at phase: ' + (state.phase || 'unknown') + '. Error: ' + code });
      setState({ active: false, busy: false, status: 'error', phase: state.phase, nextAt: null, error: code });
    }
  }
  function start() {
    if (state.active || state.busy) return;
    state.active = true;
    const token = ++generation;
    void run(token);
  }
  function stop() {
    generation++;
    setState({ active: false, busy: false, status: 'stopped', phase: null, nextAt: null, error: null });
  }
  function spinOnce() {
    if (state.active || state.busy) return;
    const token = ++generation;
    state.active = false;
    void run(token);
  }
  return { start, stop, spinOnce, snapshot };
}

const GOLD_FARM = createGoldUiFarm();
window.addEventListener("pagehide", () => {
  const sessions = TOOLS.snapshot().sessions;
  for (const farm of ["xp", "gold"]) if (sessions[farm].active) TOOLS.notice("disconnect", farm);
  GOLD_FARM.stop(); TOOLS.close();
});

// =============================================================================
// ROLE MANAGEMENT
// =============================================================================

/**
 * Get role information by its ID
 * @param {string} roleId - Role ID
 * @returns {Object} Role information
 */
const getRole = (roleId) => {
  return JSON.parse(localStorage.getItem("roles-meta-data")).roles[roleId];
};

/**
 * Set the player's role
 * @param {string} roleId - Role ID
 */
const setRole = (roleId) => {
  ROLE = getRole(roleId);
};

// =============================================================================
// FETCH INTERCEPTION
// =============================================================================

/**
 * Map of requests to intercept with their handlers
 */
const requestsToCatch = {
  // Sign up with email/password
  "https://auth.api-wolvesville.com/players/signUpWithEmailAndPassword": (
    response,
  ) => {
    if (response?.idToken) {
      AUTHTOKENS.idToken = response?.idToken;
      AUTHTOKENS.refreshToken = response.refreshToken;
    }
  },

  // Create ID token
  "https://auth.api-wolvesville.com/players/createIdToken": (response) => {
    if (response?.idToken) {
      AUTHTOKENS.idToken = response?.idToken;
      AUTHTOKENS.refreshToken = response.refreshToken;
    }
  },

  // Cloudflare Turnstile verification
  "https://auth.api-wolvesville.com/cloudflareTurnstile/verify": (response) => {
    if (response.jwt) {
      AUTHTOKENS["Cf-JWT"] = response.jwt || "";
      console.log("🛡️ Cloudflare token intercepted");
    }
  },

  // Retrieve player info
  "https://core.api-wolvesville.com/players/meAndCheckAppVersion": (
    response,
  ) => {
    if (response.player) {
      const { username, level } = response.player;
      if (!PLAYER) {
        console.log(
          "👋 Hello " +
            username +
            ", you are level " +
            level +
            " right now, ready to gain XP?",
        );
      }
      PLAYER = response.player;
      if (username) {
        AUTH_USERNAME = username;
        try { localStorage.setItem("bot-username", username); } catch (e) {}
      }
      sendUIUpdate();
    }
  },

  // Retrieve inventory
  "https://core.api-wolvesville.com/inventory?": (response, url) => {
    if (Number.isFinite(response.silverCount)) {
      INVENTORY = response;
    }

  },

  // Check if a game is running (blocked)
  "https://game.api-wolvesville.com/api/public/game/running": (response) => {
    return new Response(JSON.stringify({ running: false }));
  },

  // Golden wheel spin (with roses)
  "https://core.api-wolvesville.com/rewards/goldenWheelSpin": (response) => {
    if (response?.length) {
      const winner = response.find((item) => item.winner);
      if (winner) {
        const reward = winner.silver > 0 ? "🪙" + winner.silver : winner.type;
        console.log(reward + " looted from 🌹 wheel");
        INVENTORY.silverCount += winner.silver;
        INVENTORY.roseCount -= 30;

        window.postMessage(
          {
            type: "UPDATE_UI",
            wheelResult: "Rose Wheel: Won " + reward,
            coins: INVENTORY.silverCount,
            roses: INVENTORY.roseCount,
          },
          "*",
        );
      }
    }
  },

  // Observe free spins made by the game itself. Farm requests bypass this interceptor.
  "https://core.api-wolvesville.com/rewards/wheelRewardWithSecret/": (response) => {
    const winner = Array.isArray(response) ? response.find(item => item?.winner) : null;
    if (winner) recordGoldReward(winner);
  },

  // Check wheel availability
  "https://core.api-wolvesville.com/rewards/wheelItems/v2": (response) => {
    if (response.nextRewardAvailableTime) {
      goldWheelAvailable = false;
      goldWheelStatus =
        "Unavailable until " +
        new Date(response.nextRewardAvailableTime).toLocaleString();
      $(".lv-modal-gold-wheel-status")
        .text(goldWheelStatus)
        .css({ color: "#ff603b" });
    } else {
      goldWheelAvailable = true;
      goldWheelStatus = "Available";
      $(".lv-modal-gold-wheel-status")
        .text("Available")
        .css({ color: "#67c23a" });
    }
    sendUIUpdate();
  },
};

/**
 * Intercept fetch requests to capture important responses
 */
const fetchInterceptor = () => {
  const { fetch: originalFetch } = window;

  window.fetch = async (...args) => {
    const url = args[0] instanceof Request ? args[0].url : String(args[0]);

    // Block certain protection requests
    if (
      url.includes("/players/webAutomatio") ||
      url.includes("/players/webBo") ||
      url.includes("about:blank")
    ) {
      return;
    }

    // Modify inventory request
    if (url.startsWith("https://core.api-wolvesville.com/inventory?")) {
      args[0] = "https://core.api-wolvesville.com/inventory?";
    }

    // Clone the request to read headers
    let requestClone;
    if (args[0] instanceof Request) {
      requestClone = args[0].clone();
    } else {
      const requestUrl = args[0];
      const requestInit = args[1] || {};
      requestClone = new Request(requestUrl, requestInit);
    }

    // Capture tokens from headers
    for (const [key, value] of requestClone.headers.entries()) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === "authorization" && value.startsWith("Bearer ")) {
        if (!AUTHTOKENS.idToken) {
          console.log("auto token found in api");
        }
        AUTHTOKENS.idToken = value.slice(7);
      }
      if (lowerKey === "cf-jwt") {
        AUTHTOKENS["Cf-JWT"] = value;
      }
    }

    // Find the handler for this URL
    const handler =
      requestsToCatch[
        Object.keys(requestsToCatch).find((key) => url.startsWith(key))
      ];

    if (handler) {
      log("fetch called with args:", args);
      const response = await originalFetch(...args);
      let result;
      try {
        const data = await response.clone().json();
        log("intercepted response data:", data);
        result = handler(data);
      } catch (error) {
        log("Failed to parse intercepted response as JSON:", error);
      }

      if (result) {
        log(result, response);
      }
      return result || response;
    } else {
      return originalFetch(...args);
    }
  };
};

// =============================================================================
// WEBSOCKET INTERCEPTION
// =============================================================================

/**
 * Intercept WebSocket messages
 * @param {Function} callback - Function called for each message
 */
function socketInterceptor(callback) {
  callback = callback || log;

  let descriptor = Object.getOwnPropertyDescriptor(
    MessageEvent.prototype,
    "data",
  );
  const originalGetter = descriptor.get;

  function newGetter() {
    let isWebSocket = this.currentTarget instanceof WebSocket;
    if (!isWebSocket) {
      return originalGetter.call(this);
    }

    let data = originalGetter.call(this);
    Object.defineProperty(this, "data", { value: data });

    callback({
      data: data,
      socket: this.currentTarget,
      event: this,
    });

    return data;
  }

  descriptor.get = newGetter;
  Object.defineProperty(MessageEvent.prototype, "data", descriptor);
}

/**
 * Handler for received WebSocket messages
 * @param {Object} event - Event containing data
 */
const onMessage = (event) => {
  const prefix = event.data.slice(0, 2);

  // Socket.IO messages start with "42"
  if (prefix === "42") {
    const parsed = messageParser(event.data);
    log(parsed);
    if (parsed?.length) {
      messageDispatcher(parsed);
    }
  }
};

/**
 * Parse a Socket.IO message
 * @param {string} raw - Raw message
 * @returns {Array|undefined} Parsed message
 */
function messageParser(raw) {
  let message = raw.slice(2);
  message = message.replaceAll('"{', "{");
  message = message.replaceAll('}"', "}");
  message = message.replaceAll('\\"', '"');

  let parsed = undefined;
  try {
    parsed = JSON.parse(message);
  } catch (e) {}

  return parsed;
}

// =============================================================================
// AUTO-PLAY SOCKET CONNECTION
// =============================================================================

/**
 * Connect a regular socket to retrieve XP
 */
const connectRegularSocket = () => {
  if (!IS_AUTHENTICATED || !(LV_SETTINGS.AUTO_PLAY || LV_SETTINGS.AUTO_REPLAY) || !TOOLS.allow("xp")) return;
  const rewardGameId = GAME_ID;

  const socketUrl = "wss://" + SERVER_URL.replace("https://", "") + "/";

  REGULARSOCKET = _myExtensionSocketIO_(socketUrl, {
    query: {
      firebaseToken: AUTHTOKENS.idToken,
      gameId: GAME_ID,
      reconnect: true,
      ids: 1,
      "Cf-JWT": AUTHTOKENS["Cf-JWT"],
      apiV: 1,
      EIO: 4,
    },
    transports: ["websocket"],
  });

  guardXpSocket(REGULARSOCKET, true);
  REGULARSOCKET.on("disconnect", () => {
    console.log("🤖 Parallel socket disconnected");
    REGULARSOCKET = undefined;
  });

  REGULARSOCKET.on("game-joined", () => {
    console.log("🤖 Parallel socket connected");
  });

  // Retrieve end-game rewards
  REGULARSOCKET.on("game-over-awards-available", (data) => {
    DAY_COUNT = 0;
    DAY_VOTING = [];
    GAME_VOTING = "";

    const parsed = JSON.parse(data);

    recordXpAward(rewardGameId, parsed.playerAward.awardedTotalXp);
    if (parsed.playerAward.canClaimDoubleXp) {
      REGULARSOCKET.emit("game-over-double-xp");
      console.log("Claim double xp");
    } else {
      console.log("🧪 " + parsed.playerAward.awardedTotalXp + " xp");

      // Send XP to server
      if (PLAYER && PLAYER.id && AUTH_USERNAME) {
        const xpData = {
          player_id: PLAYER.id,
          xp_amount: parsed.playerAward.awardedTotalXp,
          username: AUTH_USERNAME,
        };
        try {
          sendXpToBackground(xpData)
            .then((r) => {})
            .catch(() => {});
        } catch (e) {}
      }

      if (parsed.playerAward.awardedLevels) {
        PLAYER.level += parsed.playerAward.awardedLevels;
        TOTAL_UP_LEVEL += parsed.playerAward.awardedLevels;
        log("🆙 " + PLAYER.level);
      }

      sendUIUpdate();

      setTimeout(() => {
        REGULARSOCKET?.disconnect();
      }, 500);
    }
  });

  REGULARSOCKET.onAny((...args) => {
    log(args);
  });
};

/**
 * Connect a socket for full auto-play
 * Handles automatic votes as werewolf
 */
const connectSocket = () => {
  if (!IS_AUTHENTICATED || !LV_SETTINGS.AUTO_PLAY || !TOOLS.allow("xp")) return;
  const rewardGameId = GAME_ID;

  console.log("mr socket called");

  var couplesInfo = [];
  var deadPlayers = [];
  var voteTarget = undefined;
  var hasAskedWho = false;
  var werewolvesRoles = [];
  var lastVote = undefined;

  const socketUrl = "wss://" + SERVER_URL.replace("https://", "") + "/";

  SOCKET = _myExtensionSocketIO_(socketUrl, {
    query: {
      firebaseToken: AUTHTOKENS.idToken,
      gameId: GAME_ID,
      reconnect: true,
      ids: 1,
      "Cf-JWT": AUTHTOKENS["Cf-JWT"],
      apiV: 1,
      EIO: 4,
    },
    transports: ["websocket"],
  });

  guardXpSocket(SOCKET);
  SOCKET.on("disconnect", () => {
    console.log("🤖 Parallel socket disconnected");
    SOCKET = undefined;
  });

  SOCKET.on("game-joined", () => {
    console.log("🤖 Parallel socket connected");
  });

  // Players killed
  SOCKET.on("game-players-killed", (data) => {
    const parsed = JSON.parse(data);
    parsed.victims.forEach((victim) => {
      const player = PLAYERS.find((p) => p?.id === victim.targetPlayerId);
      if (player) {
        deadPlayers.push(player?.id);
        console.log(
          "☠️ " +
            (parseInt(player.gridIdx) + 1) +
            ". " +
            player.username +
            " (" +
            victim.targetPlayerRole +
            ") by " +
            victim.cause,
        );
      } else {
        console.error("dead player not found");
      }
    });
  });

  // Cupid lovers
  SOCKET.on("game-cupid-lover-ids-and-roles", (data) => {
    const parsed = JSON.parse(data);

    if (!PLAYER) getPLAYER();

    if (PLAYER && ROLE) {
      // Filter to not include current player
      const otherLovers = parsed.loverPlayerIds.filter(
        (id) => id !== PLAYER?.id,
      );
      const otherRoles = parsed.loverRoles.filter((id) => id !== ROLE?.id);

      couplesInfo = otherLovers.map((id, idx) => ({
        id: id,
        role: otherRoles[idx],
      }));

      if (couplesInfo?.length === 1) {
        const lover = PLAYERS.find((p) => p?.id === couplesInfo[0]?.id);
        console.log(
          "💘 Your lover is " +
            (lover.gridIdx + 1) +
            ". " +
            lover.username +
            " (" +
            couplesInfo[0].role +
            ")",
        );
      } else if (couplesInfo?.length === 2) {
        const lover1 = PLAYERS.find((p) => p?.id === couplesInfo[0]?.id);
        const lover2 = PLAYERS.find((p) => p?.id === couplesInfo[1]?.id);
        console.log(
          "💘 Your lovers are " +
            (lover1.gridIdx + 1) +
            ". " +
            lover1.username +
            " (" +
            couplesInfo[0].role +
            ") and " +
            (lover2.gridIdx + 1) +
            ". " +
            lover2.username +
            " (" +
            couplesInfo[1].role +
            ")",
        );
      } else {
        console.error("Couple not found ", parsed);
      }
    } else {
      console.error("PLAYER or ROLE not found", PLAYER, ROLE);
    }
  });

  // Night started - vote as wolf
  SOCKET.on("game-night-started", () => {
    setTimeout(() => {
      if (ROLE && ROLE.team === "WEREWOLF") {
        // Find a non-wolf to vote for
        const nonWolf = couplesInfo.find(
          (c) => getRole(c.role).team !== "WEREWOLF",
        );
        if (nonWolf) {
          const target = PLAYERS.find((p) => p?.id === nonWolf?.id);
          if (target) {
            console.log(
              "👉 Vote " + (target.gridIdx + 1) + ". " + target.username,
            );
          }
          lastVote = nonWolf?.id;
          SOCKET.emit(
            "game-werewolves-vote-set",
            JSON.stringify({ targetPlayerId: nonWolf?.id }),
          );
        }
      }
    }, 1000);
  });

  // Werewolves roles update
  SOCKET.on("game-werewolves-set-roles", (data) => {
    const parsed = JSON.parse(data);
    werewolvesRoles = Object.entries(parsed.werewolves).map(([id, role]) => ({
      id,
      role,
    }));

    // Junior werewolf asks "Who?"
    if (
      !hasAskedWho &&
      couplesInfo?.length &&
      werewolvesRoles?.length &&
      ROLE.team === "WEREWOLF" &&
      ROLE?.id === "junior-werewolf" &&
      couplesInfo.find((c) => getRole(c.role).team !== "WEREWOLF")
    ) {
      hasAskedWho = true;
      setTimeout(() => {
        SOCKET.emit(
          "game:chat-werewolves:msg",
          JSON.stringify({ msg: "Who?" }),
        );
      }, 2000);
    }
  });

  // Werewolves chat
  SOCKET.on("game:chat-werewolves:msg", (data) => {
    const parsed = JSON.parse(data);

    // Reply to "who?" if we are a wolf
    if (
      ROLE &&
      ROLE.team === "WEREWOLF" &&
      parsed.authorId !== PLAYER?.id &&
      parsed.msg &&
      parsed.msg.toLowerCase().includes("who")
    ) {
      const target = PLAYERS.find((p) => p?.id === couplesInfo[0]?.id);
      if (target) {
        setTimeout(() => {
          SOCKET.emit(
            "game:chat-werewolves:msg",
            JSON.stringify({ msg: "" + (target.gridIdx + 1) }),
          );
        }, 1000);
      }
    }

    // Junior werewolf follows the mentioned number
    if (
      ROLE &&
      ROLE?.id === "junior-werewolf" &&
      parsed.msg &&
      parsed.authorId !== PLAYER?.id
    ) {
      const numbers = parsed.msg.match(/\d+/);
      if (numbers && numbers?.length) {
        const gridNum = parseInt(numbers[0]);
        const target = PLAYERS.find((p) => p.gridIdx + 1 === gridNum);
        if (target) {
          voteTarget = target.id;
          console.log(
            "🐾 Select " + (target.gridIdx + 1) + ". " + target.username,
          );
          SOCKET.emit(
            "game-junior-werewolf-selected-player",
            JSON.stringify({ targetPlayerId: target.id }),
          );
        }
      }
    }
  });

  // Werewolves vote
  SOCKET.on("game-werewolves-vote-set", (data) => {
    const parsed = JSON.parse(data);

    if (parsed.playerId === PLAYER?.ID) return;

    // Junior werewolf follows the vote
    if (
      !voteTarget &&
      ROLE &&
      ROLE?.id === "junior-werewolf" &&
      parsed.playerId !== PLAYER?.id
    ) {
      voteTarget = parsed.targetPlayerId;
      const target = PLAYERS.find((p) => p?.id === parsed.targetPlayerId);
      if (target) {
        console.log(
          "🐾 Select " + (target.gridIdx + 1) + ". " + target.username,
        );
      }
      SOCKET.emit(
        "game-junior-werewolf-selected-player",
        JSON.stringify({ targetPlayerId: parsed.targetPlayerId }),
      );
    }

    // Follow junior werewolf vote
    if (
      ROLE &&
      ROLE?.id !== "junior-werewolf" &&
      werewolvesRoles.find(
        (w) => w.role === "junior-werewolf" && w?.id === parsed.playerId,
      )
    ) {
      const target = PLAYERS.find((p) => p?.id === parsed.targetPlayerId);
      setTimeout(() => {
        if (target) {
          console.log(
            "👉 Vote " + (target.gridIdx + 1) + ". " + target.username,
          );
        }
        if (lastVote !== parsed.targetPlayerId) {
          lastVote = parsed.targetPlayerId;
          SOCKET.emit(
            "game-werewolves-vote-set",
            JSON.stringify({ targetPlayerId: parsed.targetPlayerId }),
          );
        }
      }, 1000);
    } else if (
      ROLE &&
      ROLE?.id !== "junior-werewolf" &&
      !werewolvesRoles.find(
        (w) => w.role === "junior-werewolf" && w?.id === parsed.playerId,
      ) &&
      couplesInfo.find((c) =>
        ["priest", "vigilante", "gunner"].includes(c.role),
      )
    ) {
      // Inform about lover with special role
      const target = PLAYERS.find((p) => p?.id === parsed.targetPlayerId);
      setTimeout(() => {
        if (target) {
          console.log(
            "👉 Vote " + (target.gridIdx + 1) + ". " + target.username,
          );
          SOCKET.emit(
            "game:chat-werewolves:msg",
            JSON.stringify({
              msg: lover.gridIdx + 1 + " is " + lover.role,
            }),
          );
        }
        if (lastVote !== parsed.targetPlayerId) {
          lastVote = parsed.targetPlayerId;
          SOCKET.emit(
            "game-werewolves-vote-set",
            JSON.stringify({ targetPlayerId: parsed.targetPlayerId }),
          );
        }
      }, 1000);
    }
  });

  // Day vote
  SOCKET.on("game-day-voting-started", () => {
    if (!PLAYER) getPLAYER();

    if (PLAYER && !deadPlayers.includes(PLAYER?.id)) {
      // Find a wolf among lovers
      const wolf = couplesInfo.find((c) => getRole(c.role).team === "WEREWOLF");

      if (wolf) {
        if (ROLE && ROLE.team === "WEREWOLF") {
          SOCKET.emit("game:chat-public:msg", JSON.stringify({ msg: "wc" }));
        }

        const target = PLAYERS.find((p) => p?.id === wolf?.id);
        if (target) {
          console.log(
            "👉 Vote " + (target.gridIdx + 1) + ". " + target.username,
          );
        }
        SOCKET.emit(
          "game-day-vote-set",
          JSON.stringify({ targetPlayerId: wolf?.id }),
        );
      } else {
        // Vote for oneself or say "solo"
        if (ROLE && ROLE.team === "WEREWOLF") {
          SOCKET.emit("game:chat-public:msg", JSON.stringify({ msg: "me" }));
        } else if (
          ROLE &&
          [
            "serial-killer",
            "arsonist",
            "corruptor",
            "bandit",
            "cannibal",
            "evil-detective",
            "bomber",
            "alchemist",
            "illusionist",
            "zombie",
            "blight",
            "sect-leader",
            "siren",
          ].includes(ROLE.id)
        ) {
          SOCKET.emit("game:chat-public:msg", JSON.stringify({ msg: "solo" }));
        }
      }
    }
  });

  // React to messages "me" or "wc" in chat
  SOCKET.on("game:chat-public:msg", (data) => {
    const parsed = JSON.parse(data);

    if (!PLAYER) getPLAYER();

    if (
      PLAYER &&
      !deadPlayers.includes(PLAYER?.id) &&
      parsed.authorId !== PLAYER?.id &&
      parsed.msg &&
      ROLE &&
      ROLE.team === "VILLAGER" &&
      ["Me", "me", "ME", "m", "M", "wc", "Wc", "WC"].includes(parsed.msg)
    ) {
      const voter = PLAYERS.find((p) => p?.id === parsed.authorId);
      if (voter) {
        SOCKET.emit(
          "game-day-vote-set",
          JSON.stringify({ targetPlayerId: voter.id }),
        );
        console.log("👉 Vote " + (voter.gridIdx + 1) + ". " + voter.username);
      }
    }
  });

  // Follow day votes
  SOCKET.on("game-day-vote-set", (data) => {
    const parsed = JSON.parse(data);

    if (!PLAYER) getPLAYER();

    if (PLAYER && !deadPlayers.includes(PLAYER?.id)) {
      const target = PLAYERS.find((p) => p?.id === parsed.targetPlayerId);

      DAY_VOTING.push(PLAYER.id);
      DAY_VOTING.push(target.id);

      // Priest kills
      if (ROLE && ROLE?.id === "priest") {
        setTimeout(() => {
          if (target) {
            console.log(
              "💦 Kill " + (target.gridIdx + 1) + ". " + target.username,
            );
          }
          SOCKET.emit(
            "game-priest-kill-player",
            JSON.stringify({ targetPlayerId: parsed.targetPlayerId }),
          );
        }, 1000);
      }
      // Vigilante shoots
      else if (ROLE && ROLE.id === "vigilante") {
        setTimeout(() => {
          if (target) {
            console.log(
              "🔫 Kill " + (target.gridIdx + 1) + ". " + target.username,
            );
          }
          SOCKET.emit(
            "game-vigilante-shoot",
            JSON.stringify({ targetPlayerId: parsed.targetPlayerId }),
          );
        }, 1000);
      }
      // Gunner shoots
      else if (ROLE && ROLE?.id === "gunner") {
        setTimeout(() => {
          if (target) {
            console.log(
              "🔫 Kill " + (target.gridIdx + 1) + ". " + target.username,
            );
          }
          SOCKET.emit(
            "game-gunner-shoot-player",
            JSON.stringify({ targetPlayerId: parsed.targetPlayerId }),
          );
        }, 1000);
      }
    }
  });

  // Players status
  SOCKET.on("game-reconnect-set-players", (data) => {
    const parsed = JSON.parse(data);
    Object.values(parsed).forEach((player) => {
      if (!player.isAlive) {
        deadPlayers.push(player.id);
      }
    });
  });

  // End-game rewards
  SOCKET.on("game-over-awards-available", (data) => {
    const parsed = JSON.parse(data);

    recordXpAward(rewardGameId, parsed.playerAward.awardedTotalXp);
    if (parsed.playerAward.canClaimDoubleXp) {
      SOCKET.emit("game-over-double-xp");
      console.log("Claim double xp");
    } else {
      console.log("🧪 " + parsed.playerAward.awardedTotalXp + " xp gained.");

      if (PLAYER && PLAYER.id && AUTH_USERNAME) {
        const xpData = {
          player_id: PLAYER.id,
          xp_amount: parsed.playerAward.awardedTotalXp,
          username: AUTH_USERNAME,
        };
        try {
          sendXpToBackground(xpData)
            .then((r) => {})
            .catch(() => {});
        } catch (e) {}
      }

      if (parsed.playerAward.awardedLevels) {
        PLAYER.level += parsed.playerAward.awardedLevels;
        TOTAL_UP_LEVEL += parsed.playerAward.awardedLevels;
        log("🆙 " + PLAYER.level);
      }

      sendUIUpdate();

      setTimeout(() => {
        SOCKET?.disconnect();
      }, 500);
    }
  });

  SOCKET.onAny((...args) => {
    log(args);
  });
};

// =============================================================================
// WEBSOCKET MESSAGE HANDLER
// =============================================================================

/**
 * Map of game events to handle
 */
const messagesToCatch = {
  // Game joined
  "game-joined": (data) => {
    if (SOCKET || REGULARSOCKET) return;

    console.log("🔗 Game joined");
    const values = Object.values(data);
    GAME_ID = values[0];
    SERVER_URL = values[1];
    setTimeout(setPlayersLevel, 1000);
  },

  // Game settings changed
  "game-settings-changed": (data) => {
    GAME_SETTINGS = data;
  },

  // Game starting soon
  "game-starting": () => {
    if (SOCKET || REGULARSOCKET) return;
    console.log("🚩 Game starting in 5 seconds...");
  },

  // Game started
  "game-started": (data) => {
    if (SOCKET || REGULARSOCKET) return;

    console.log("🚀 Game started");
    GAME_STATUS = "started";
    GAME_STARTED_AT = new Date().getTime();

    setRole(data.role);
    console.log("You are " + ROLE.name + " (" + ROLE?.id + ")");

    PLAYERS = data.players;
    setTimeout(setPlayersLevel, 1000);

    setTimeout(() => {
      // Connect socket for custom all-coupled
      if (
        !SOCKET &&
        LV_SETTINGS.AUTO_PLAY &&
        GAME_SETTINGS.gameMode === "custom" &&
        GAME_SETTINGS.allCoupled &&
        GAME_ID &&
        SERVER_URL
      ) {
        connectSocket();
      }

      // Connect regular socket for other modes
      if (
        !REGULARSOCKET &&
        !(GAME_SETTINGS.gameMode === "custom") &&
        GAME_ID &&
        SERVER_URL
      ) {
        connectRegularSocket();
      }
    }, 1000);
  },

  // Player joined (ignored)
  "player-joined-and-equipped-items": (data) => {},

  // Game status (ignored)
  "game-set-game-status": (data) => {},

  // Reconnection
  "game-reconnect-set-game-status": (data) => {
    setTimeout(() => {
      if (
        !SOCKET &&
        LV_SETTINGS.AUTO_PLAY &&
        GAME_SETTINGS.gameMode === "custom" &&
        GAME_SETTINGS.allCoupled &&
        GAME_ID &&
        SERVER_URL
      ) {
        connectSocket();
      }
      if (
        !REGULARSOCKET &&
        !(GAME_SETTINGS.gameMode === "custom") &&
        GAME_ID &&
        SERVER_URL
      ) {
        connectRegularSocket();
      }
    }, 1000);
  },

  // Players list
  "players-and-equipped-items": (data) => {
    if (GAME_STATUS === "started") {
      PLAYERS = data.players;
      setTimeout(setPlayersLevel, 1000);
    }
  },

  // Reconnectio regular socket for other
  "game-reconnect-set-players": (data) => {
    if (SOCKET || REGULARSOCKET) return;

    PLAYERS = Object.values(data);
    setTimeout(setPlayersLevel, 1000);

    if (PLAYER) {
      const me = PLAYERS.find((p) => p.username === PLAYER.username);
      if (me) {
        if (me.spectate) {
          console.log("You are Spectator");
        } else {
          setRole(me.role);
          console.log("You are " + ROLE.name + " (" + ROLE?.id + ")");
        }
      }
    }
  },

  // Night started
  "game-night-started": () => {
    const me = PLAYERS.find((p) => p?.id === PLAYER?.id);
    setTimeout(setPlayersLevel, 1000);
  },

  // Players killed
  "game-players-killed": (data) => {
    if (SOCKET || REGULARSOCKET) return;

    data.victims.forEach((victim) => {
      const player = PLAYERS.find((p) => p?.id === victim.targetPlayerId);
      if (player) {
        console.log(
          "☠️ " +
            (parseInt(player.gridIdx) + 1) +
            ". " +
            player.username +
            " (" +
            victim.targetPlayerRole +
            ") by " +
            victim.cause,
        );
      }
    });
  },

  // Game over
  "game-game-over": () => {
    if (GAME_STATUS === "over") return;
    TOOLS.gameFinished(GAME_ID);

    GAME_STATUS = "over";
    let message = "🏁 Game over";

    if (GAME_STARTED_AT) {
      const duration = new Date().getTime() - GAME_STARTED_AT;
      message += " (" + (duration / 1000).toFixed(0) + "s)";
      GAME_STARTED_AT = 0;
    }

    console.log(message);
  },

  // Rewards available
  "game-over-awards-available": (data) => {
    if (SOCKET || REGULARSOCKET) return;

    recordXpAward(GAME_ID, data.playerAward.awardedTotalXp);
    console.log("🧪 " + data.playerAward.awardedTotalXp + " xp");

    clearChat();

    if (data.playerAward.awardedLevels) {
      PLAYER.level += data.playerAward.awardedLevels;
      TOTAL_UP_LEVEL += data.playerAward.awardedLevels;
      console.log("🆙 " + PLAYER.level);
    }
  },

  // Disconnection
  disconnect: () => {
    ROLE = undefined;
    PLAYERS = [];
    GAME_ID = undefined;
    SERVER_URL = undefined;
    GAME_SETTINGS = undefined;

    setTimeout(() => {
      if (SOCKET) SOCKET.disconnect();
      if (REGULARSOCKET) REGULARSOCKET.disconnect();
    }, 1000);
  },
};

/**
 * Dispatch messages to appropriate handlers
 * @param {Array} message - Parsed message [eventName, data]
 */
const messageDispatcher = (message) => {
  const eventName = message[0];
  const data = message.length > 1 ? message[1] : null;
  const handler = messagesToCatch[eventName];

  if (handler) {
    handler(data);
  }
};

// =============================================================================
// LEVEL DISPLAY
// =============================================================================

/**
 * Display player levels in the UI
 */
function setPlayersLevel() {
  if (!LV_SETTINGS.SHOW_HIDDEN_LVL) return;

  PLAYERS.forEach((player) => {
    const searchText = parseInt(player.gridIdx) + 1 + " " + player.username;
    const elements = $('div:contains("' + searchText + '")');
    const gridNum = parseInt(player.gridIdx) + 1;
    const username = player.username;
    const level = player.level;

    let clanTag = "";
    if (player.clanTag) {
      clanTag = "" + player.clanTag;
    }

    let displayText = gridNum + " " + username + " [" + level + "] " + clanTag;

    if (elements?.length) {
      elements[elements.length - 1].innerHTML = displayText;
      elements[elements.length - 1].className = "lv-username";
      elements[elements.length - 1].parentElement.className = "lv-username-box";
    }
  });
}

// =============================================================================
// CHAT HIDING
// =============================================================================

/**
 * Hide chat messages except from a specific player
 * @param {string} playerNum - Player number to keep visible
 */
const playerChatHiding = (playerNum) => {
  const dayElements = $('div:contains("Day ")');
  const firstDay = dayElements.last()[0];

  let className = "";
  if (firstDay && firstDay.className) {
    const classes = firstDay.className.trim().split(/\s+/);
    className = classes[classes.length - 1];
  }

  if (className) {
    $("span." + className).each(function () {
      const text = $(this).text().trim();
      const firstWord = text.split(" ")[0];

      if (/^\d/.test(firstWord) && firstWord !== playerNum.toString()) {
        const parent = $(this).closest("div");
        parent.hide();
      }
    });
  }
};

/**
 * Undo chat hiding
 */
const undoChatHiding = () => {
  const dayElements = $('div:contains("Day ")');
  const firstDay = dayElements.last()[0];

  let className = "";
  if (firstDay && firstDay.className) {
    const classes = firstDay.className.trim().split(/\s+/);
    className = classes[classes.length - 1];
  }

  if (className) {
    $("span." + className).each(function () {
      const parent = $(this).closest("div");
      parent.show();
    });
  }
};

/**
 * Hide messages not mentioning a player
 * @param {string} mentionText - Mention text to search for
 */
const playerChatHidingMention = (mentionText) => {
  const dayElements = $('div:contains("Day ")');
  const firstDay = dayElements.last()[0];

  let className = "";
  if (firstDay && firstDay.className) {
    const classes = firstDay.className.trim().split(/\s+/);
    className = classes[classes.length - 1];
  }

  if (className) {
    $("span." + className).each(function () {
      const parent = $(this).closest("div");
      const fullText = parent.text();
      const spanText = parent.find("span." + className).text();
      const messageText = fullText.replace(spanText, "");

      const regex = new RegExp("\\b" + mentionText + "\\b");
      if (!regex.test(messageText)) {
        parent.hide();
      }
    });
  }
};

/**
 * Undo mention hiding
 */
const undoChatHidingMention = () => {
  const dayElements = $('div:contains("Day ")');
  const firstDay = dayElements.last()[0];

  let className = "";
  if (firstDay && firstDay.className) {
    const classes = firstDay.className.trim().split(/\s+/);
    className = classes[classes.length - 1];
  }

  if (className) {
    $("span." + className).each(function () {
      const parent = $(this).closest("div");
      parent.show();
    });
  }
};

// =============================================================================
// AUTO-REPLAY
// =============================================================================

/**
 * Handle auto-replay
 */
const handleAutoReplay = () => {
  // Clean up existing interval
  if (AUTO_REPLAY_INTERVAL) {
    clearInterval(AUTO_REPLAY_INTERVAL);
    AUTO_REPLAY_INTERVAL = undefined;
  }

  if (!LV_SETTINGS.AUTO_REPLAY) {
    return;
  }

  /**
   * Simulate a click on an element
   * @param {Element} element - Element to click
   */
  function simulateClick(element) {
    if (!LV_SETTINGS.AUTO_REPLAY || !TOOLS.allow("xp")) return;
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    window.postMessage({ type: "FROM_PAGE_CLICK", x: x, y: y }, "*");
  }

  AUTO_REPLAY_INTERVAL = setInterval(() => {
    if (!LV_SETTINGS.AUTO_REPLAY) {
      return;
    }

    // Click on "Join"
    const joinButtons = $('div:contains("START GAME")');
    if (joinButtons?.length) {
      simulateClick(joinButtons[joinButtons.length - 1]);
    }

    // Click on "Continue"
    const continueButtons = $('div:contains("Continue")');
    if (continueButtons?.length) {
      simulateClick(continueButtons[continueButtons.length - 1]);
    }

    // Click on "Play again"
    const playAgainButtons = $('div:contains("Play again")');
    if (playAgainButtons?.length) {
      simulateClick(playAgainButtons[playAgainButtons.length - 1]);

      setTimeout(() => {
        const okButtons = $('div:contains("OK")');
        if (okButtons?.length) {
          simulateClick(okButtons[okButtons.length - 1]);
        }
      }, 500);
    }
  }, 1000);
};

// =============================================================================
// UI AND OVERLAYS
// =============================================================================

/** @type {number} Last time the XP progress bar was scraped from the game UI */
let lastXpProgressScan = 0;
/** @type {{current:number,total:number}|null} Cached XP progress toward the next level */
let cachedXpProgress = null;

/**
 * Read the "current/total" XP text the game itself renders next to the level badge.
 * There is no API field for this, so it is scraped straight from the DOM using a
 * text pattern instead of generated CSS classes, which change between game builds.
 * @returns {{current:number,total:number}|null}
 */
function scanXpProgress() {
  if (typeof document === "undefined") return null;
  for (const el of document.querySelectorAll('div[dir="auto"]')) {
    const match = (el.textContent || "").trim().match(/^(\d{1,10})\/(\d{1,10})$/);
    if (match) return { current: Number(match[1]), total: Number(match[2]) };
  }
  return null;
}

/**
 * Throttled accessor for scanXpProgress(): sendUIUpdate() runs far more often
 * than the XP bar can change, so the DOM is only rescanned every few seconds.
 */
function getXpProgress() {
  const now = Date.now();
  if (now - lastXpProgressScan > 3000) {
    cachedXpProgress = scanXpProgress();
    lastXpProgressScan = now;
  }
  return cachedXpProgress;
}

/**
 * Send UI update to popup
 */
function sendUIUpdate() {
  window.postMessage(
    {
      type: "UPDATE_UI",
      username: PLAYER?.username || AUTH_USERNAME,
      level: PLAYER?.level,
      xpProgress: getXpProgress(),
      licenseExpiry: licenseExpiry,
      authStatus: IS_AUTHENTICATED ? "authorized" : "unauthorized",
      coins: INVENTORY?.silverCount || 0,
      roses: INVENTORY?.roseCount || 0,
      sessionXP: TOTAL_XP_SESSION,
      goldCommandId,
      tools: TOOLS.snapshot(),
      toolsReply,
      diagnostics: {engine:true, player:!!PLAYER?.id, inventory:!!INVENTORY,
        authentication:!!AUTHTOKENS.idToken, wheel:goldWheelStatus, game:!!GAME_ID},
      goldFarm: GOLD_FARM.snapshot(),
      goldDiagnostic: { ...goldDiagnostic, farmError: GOLD_FARM.snapshot().error },
      goldSessionSpins: GOLD_WHEEL_SPINS_COUNTER,
      goldSessionEarned: GOLD_WHEEL_SILVER_SESSION,
      goldWheelAvailable: goldWheelAvailable,
      goldWheelStatus: goldWheelStatus,
    },
    "*",
  );
}

/**
 * Show a small notice on the game page when there is no valid license token.
 * This does not block the game itself: IS_AUTHENTICATED already gates the
 * automation, so this is just a visible nudge to go activate a token.
 */
function showDeactivatedOverlay() {
  if (document.getElementById("llb-deactivated-overlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "llb-deactivated-overlay";
  overlay.style.cssText =
    "position:fixed;bottom:16px;right:16px;z-index:2147483647;max-width:280px;" +
    "padding:12px 14px;border-radius:10px;background:#1a0d10;border:1px solid #e21b2d;" +
    "color:#fff;font:600 12px/1.4 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;" +
    "box-shadow:0 8px 24px rgba(0,0,0,.4);";
  overlay.textContent =
    "4utoWolves: token de licença ausente ou expirado. Abra a extensão para ativar.";
  (document.body || document.documentElement).appendChild(overlay);
}

/**
 * Remove the license notice once a valid token is active again.
 */
function hideDeactivatedOverlay() {
  const overlay = document.getElementById("llb-deactivated-overlay");
  if (overlay) overlay.remove();
}

/**
 * Show custom message (disabled - no server messages)
 * @param {string} message - Message to display
 */
function showCustomMessageModal(message) {
  // Does nothing - no server messages
}

/**
 * Clear chat
 */
function clearChat() {
  $(".lv-chat-container").empty();
  HISTORY.length = 0;
  log("[4utoWolves] Chat cleared.");
}

/**
 * Format a date/time
 * @param {Date} date - Date to format
 * @returns {string} Formatted time HH:MM:SS.mmm
 */
function formatTime(date) {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  const ms = date.getMilliseconds().toString().padStart(3, "0");

  return hours + ":" + minutes + ":" + seconds + "." + ms;
}

// =============================================================================
// MISCELLANEOUS UTILITIES
// =============================================================================

/**
 * Retrieve player information via API
 */
const getPLAYER = () => {
  log("getPLAYER called");
  fetch("https://core.api-wolvesville.com/players/meAndCheckAppVersion", {
    method: "PUT",
    headers: getHeaders(),
  });
};

/**
 * Inject CSS styles
 */
const injectStyles = () => {
  const styles = `
    <style>
    .lv-username {
      color: #ffffff; /* White text */
      font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-weight: 500;
    }
    .lv-username-box {
      background-color: #000000; /* Black background */
      padding: 2px 8px 4px 8px;
      border-radius: 8px;
    }
    </style>
  `;
  $("html").append(styles);
};

/**
 * Remove Wolvesville protections
 */
const removeWovProtections = () => {
  const startButtons = $('div:contains("START GAME")');
  const okButtons = $('div:contains("OK")');
  const inventoryButtons = $('div:contains("INVENTORY")');

  if (startButtons?.length && okButtons?.length && inventoryButtons?.length) {
    startButtons[startButtons?.length - 1].remove();
    okButtons[okButtons?.length - 1].remove();
  }
};

/**
 * Patch localStorage to block certain writes
 */
const patchLocalStorage = () => {
  var originalSetItem = localStorage.setItem;

  localStorage.setItem = function (key, value) {
    if (key == "open-page") {
      localStorage.removeItem(key);
      return;
    }
    originalSetItem.apply(this, arguments);
  };
};

// =============================================================================
// EVENT LISTENERS
// =============================================================================

// Listen for messages from popup/content-script
window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || typeof event.data !== "object") return;
  if (event.data.type === "TOOLS_COMMAND") { handleToolsCommand(event.data); return; }
  // UI update request
  if (event.data.type === "REQUEST_UI_DATA") {
    sendUIUpdate();
  }

  // Settings request
  if (event.data.type === "REQUEST_SETTINGS") {
    window.postMessage({ type: "SETTINGS_LOADED", settings: LV_SETTINGS }, "*");
  }

  // The popup reopens with a blank token field even though the token is still
  // stored/valid; let it ask for the saved token so it can show it back.
  if (event.data.type === "REQUEST_LICENSE_TOKEN") {
    window.postMessage({ type: "LICENSE_TOKEN_INFO", token: LICENSE.getStoredToken() }, "*");
  }

  // License token pasted in the popup: store it and verify right away,
  // instead of waiting for the next 5-minute recheck.
  if (event.data.type === "SET_LICENSE_TOKEN") {
    LICENSE.setStoredToken(typeof event.data.token === "string" ? event.data.token.trim() : "");
    recheckAuthentication().then((valid) => {
      if (valid) enableAutomationFeaturesOnce();
      window.postMessage(
        { type: "LICENSE_UPDATE_RESULT", commandId: event.data.commandId, valid, licenseExpiry },
        "*",
      );
    });
  }

  // Setting change
  if (event.data.type === "SETTING_CHANGE") {
    const { key, value } = event.data;
    if (!Object.hasOwn(LV_SETTINGS, key) || typeof value !== "boolean") return;
    // Auto Play / Auto Replay actually run the game via connectSocket()/connectRegularSocket(),
    // which already require IS_AUTHENTICATED - but without this check the popup toggle would
    // still flip to "enabled" with no valid token, which is misleading.
    if ((key === "AUTO_PLAY" || key === "AUTO_REPLAY") && value && !IS_AUTHENTICATED) {
      sendSettings();
      return;
    }
    LV_SETTINGS[key] = value;
    if (key === "AUTO_PLAY" || key === "AUTO_REPLAY") {
      TOOLS.setActive("xp", LV_SETTINGS.AUTO_PLAY || LV_SETTINGS.AUTO_REPLAY);
      TOOLS.allow("xp");
    }
    saveSetting();
    sendSettings();

    if (key === "AUTO_REPLAY") handleAutoReplay();

    console.log("⚙️ Setting changed: " + key + " = " + value);
  }

  if (["GOLD_FARM_START", "GOLD_FARM_STOP", "SPIN_GOLD_WHEEL"].includes(event.data?.type)) {
    if (event.source !== window) return;
    goldCommandId = event.data.commandId || null;
  }
  if (event.data.type === "GOLD_FARM_START" && IS_AUTHENTICATED) GOLD_FARM.start();
  if (event.data.type === "GOLD_FARM_STOP") GOLD_FARM.stop();
  if (event.data.type === "SPIN_GOLD_WHEEL" && IS_AUTHENTICATED) GOLD_FARM.spinOnce();

  // The paid wheel is separate and can only be requested explicitly.
  if (event.data.type === "SPIN_ROSE_WHEEL") {
    fetch("https://core.api-wolvesville.com/rewards/goldenWheelSpin", {
      method: "POST",
      headers: getHeaders(),
    }).catch(() => {});
  }

});

// Listen for auth requests from page
window.addEventListener("message", (event) => {
  if (
    event.data.type === "AUTH_REQUEST_TO_BACKGROUND" &&
    typeof chrome !== "undefined" &&
    chrome.runtime &&
    chrome.runtime.sendMessage
  ) {
    chrome.runtime.sendMessage({
      type: "AUTH_REQUEST",
      username: event.data.username,
      messageId: event.data.messageId,
    });
  }
});

// Remove protections periodically
setInterval(removeWovProtections, 5000);

// =============================================================================
// INITIALIZATION
// =============================================================================

/** @type {boolean} Guards handleAutoReplay/sendUIUpdate setup so a later successful recheck doesn't redo it */
let automationFeaturesEnabled = false;

/**
 * One-time setup for the features that only make sense once a valid
 * license is active. Safe to call again after a later successful recheck.
 */
function enableAutomationFeaturesOnce() {
  if (automationFeaturesEnabled) return;
  automationFeaturesEnabled = true;
  handleAutoReplay();
  setInterval(() => {
    if (IS_AUTHENTICATED) sendUIUpdate();
  }, 4000);
}

/**
 * Main entry point
 */
const main = async () => {
  // Load settings
  loadSettings();

  // Retrieve tokens
  getAuthtokens();

  // Activate interceptors
  fetchInterceptor();
  socketInterceptor(onMessage);

  // Send settings after a delay
  setTimeout(() => {
    sendSettings();
  }, 1000);

  // Wait a bit
  await new Promise((r) => setTimeout(r, 2000));

  // Retrieve player if not yet loaded
  if (!PLAYER) {
    getPLAYER();
    await new Promise((r) => setTimeout(r, 3000));
  }

  // Verify the license token
  const authenticated = await authenticateBot();
  setAuthState(authenticated);

  if (authenticated) {
    enableAutomationFeaturesOnce();
  } else {
    if (SOCKET) {
      SOCKET.disconnect();
      SOCKET = undefined;
    }
    if (REGULARSOCKET) {
      REGULARSOCKET.disconnect();
      REGULARSOCKET = undefined;
    }
  }

  // Re-check periodically even if the first check failed (e.g. a transient
  // network hiccup with the license server right at page load), so a valid
  // stored token recovers on its own shortly instead of requiring a reload
  // or a manual click on "Ativar token". Once authenticated, this is just a
  // safety net for eventual expiry, so a short interval costs nothing.
  setInterval(async () => {
    if (await recheckAuthentication()) enableAutomationFeaturesOnce();
  }, 60 * 1000);
};

// Inject styles
injectStyles();

// Start the bot
main();

// Listen for page load
window.addEventListener("load", function () {});
