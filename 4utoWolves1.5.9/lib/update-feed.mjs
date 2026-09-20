export const UPDATE_FEED_URL = "https://raw.githubusercontent.com/UMNORDESTINO/UMNORDESTINO4AUTO/main/updates.json";

export const UPDATE_CACHE_KEY = "4utowolves-update-feed-v1";
export const UPDATE_SEEN_KEY = "4utowolves-update-seen-v1";
const LANGUAGES = ["pt-BR", "en", "es", "fr"];
const MAX_BYTES = 256 * 1024;

function localized(value, maxLength) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = {};
  for (const language of LANGUAGES) {
    const text = value[language];
    if (typeof text !== "string" || !text.trim() || text.length > maxLength) return null;
    result[language] = text.trim();
  }
  return result;
}

export function validateUpdateFeed(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.updates) || value.updates.length > 100) {
    throw new Error("invalid_feed");
  }
  const ids = new Set();
  const updates = value.updates.map(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("invalid_feed");
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const version = typeof item.version === "string" ? item.version.trim() : "";
    const date = typeof item.date === "string" ? item.date.trim() : "";
    const title = localized(item.title, 120);
    const description = localized(item.description, 2000);
    if (!/^[A-Za-z0-9._-]{1,80}$/.test(id) || ids.has(id) || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + "T00:00:00Z")) || !title || !description) {
      throw new Error("invalid_feed");
    }
    ids.add(id);
    let url = null;
    if (item.url !== undefined && item.url !== null && item.url !== "") {
      try { const parsed = new URL(item.url); if (parsed.protocol !== "https:") throw new Error(); url = parsed.href; }
      catch { throw new Error("invalid_feed"); }
    }
    return {id, version, date, title, description, url};
  });
  updates.sort((a,b) => b.date.localeCompare(a.date) || b.version.localeCompare(a.version));
  return {updates};
}

export async function fetchUpdateFeed({url = UPDATE_FEED_URL, fetchFn = fetch, cached = null} = {}) {
  if (!url) return {configured:false, updated:false, feed:cached?.feed || {updates:[]}, etag:cached?.etag || null};
  const headers = {Accept:"application/json"};
  if (cached?.etag) headers["If-None-Match"] = cached.etag;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetchFn(url, {headers, cache:"no-store", signal:controller.signal});
    if (response.status === 304 && cached?.feed) return {configured:true, updated:false, feed:cached.feed, etag:cached.etag || null};
    if (!response.ok) throw new Error("http_error");
    const length = Number(response.headers?.get?.("content-length"));
    if (Number.isFinite(length) && length > MAX_BYTES) throw new Error("feed_too_large");
    const text = await response.text();
    if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error("feed_too_large");
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error("invalid_feed"); }
    return {configured:true, updated:true, feed:validateUpdateFeed(parsed), etag:response.headers?.get?.("etag") || null};
  } finally { clearTimeout(timeout); }
}

export function updateState(feed, seenIds = []) {
  const seen = new Set(Array.isArray(seenIds) ? seenIds.filter(id => typeof id === "string") : []);
  const updates = feed?.updates || [];
  return {updates, unreadIds:updates.filter(item => !seen.has(item.id)).map(item => item.id)};
}
