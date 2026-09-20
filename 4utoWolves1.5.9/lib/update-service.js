import {UPDATE_FEED_URL, UPDATE_CACHE_KEY, UPDATE_SEEN_KEY, fetchUpdateFeed, updateState} from './update-feed.mjs';

const ALARM = "4utowolves-update-feed";
let activeRefresh = null;

async function storedState() {
  const data = await chrome.storage.local.get([UPDATE_CACHE_KEY, UPDATE_SEEN_KEY]);
  const cache = data[UPDATE_CACHE_KEY] || null;
  const state = updateState(cache?.feed || {updates:[]}, data[UPDATE_SEEN_KEY]);
  return {configured:!!UPDATE_FEED_URL, ...state, checkedAt:cache?.checkedAt || null, error:cache?.error || null};
}

export async function refreshUpdates() {
  if (activeRefresh) return activeRefresh;
  activeRefresh = (async () => {
    const data = await chrome.storage.local.get([UPDATE_CACHE_KEY, UPDATE_SEEN_KEY]);
    const cached = data[UPDATE_CACHE_KEY] || null;
    try {
      const result = await fetchUpdateFeed({cached});
      const cache = {feed:result.feed, etag:result.etag, checkedAt:Date.now(), error:null};
      await chrome.storage.local.set({[UPDATE_CACHE_KEY]:cache});
    } catch (error) {
      await chrome.storage.local.set({[UPDATE_CACHE_KEY]:{...(cached || {feed:{updates:[]},etag:null}),checkedAt:Date.now(),error:error.message || "network_error"}});
    }
    const state = await storedState();
    chrome.runtime.sendMessage({type:"UPDATES_CHANGED", state}).catch(() => {});
    return state;
  })().finally(() => { activeRefresh = null; });
  return activeRefresh;
}

export async function markUpdatesRead(ids) {
  const state = await storedState();
  const valid = new Set(state.updates.map(item=>item.id));
  const data = await chrome.storage.local.get(UPDATE_SEEN_KEY);
  const seen = new Set(Array.isArray(data[UPDATE_SEEN_KEY]) ? data[UPDATE_SEEN_KEY] : []);
  for (const id of Array.isArray(ids) ? ids : []) if (valid.has(id)) seen.add(id);
  const pruned = [...seen].filter(id=>valid.has(id)).slice(-200);
  await chrome.storage.local.set({[UPDATE_SEEN_KEY]:pruned});
  const next = await storedState();
  chrome.runtime.sendMessage({type:"UPDATES_CHANGED", state:next}).catch(() => {});
  return next;
}

export function installUpdateService() {
  chrome.runtime.onInstalled.addListener(() => { chrome.alarms.create(ALARM,{delayInMinutes:1,periodInMinutes:360}); void refreshUpdates(); });
  chrome.runtime.onStartup.addListener(() => { chrome.alarms.create(ALARM,{periodInMinutes:360}); void refreshUpdates(); });
  chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === ALARM) void refreshUpdates(); });
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "GET_UPDATES") { storedState().then(sendResponse).catch(()=>sendResponse({configured:!!UPDATE_FEED_URL,updates:[],unreadIds:[],error:"storage_error"})); return true; }
    if (message?.type === "REFRESH_UPDATES") { refreshUpdates().then(sendResponse); return true; }
    if (message?.type === "MARK_UPDATES_READ") { markUpdatesRead(message.ids).then(sendResponse); return true; }
  });
  chrome.alarms.create(ALARM,{periodInMinutes:360});
}
