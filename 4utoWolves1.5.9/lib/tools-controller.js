/** Session accounting and limits, independent of the popup lifetime. */
(function (root) {
  'use strict';
  root.createToolsController = function ({ storage, now = Date.now, id = () => crypto.randomUUID(), onStop = () => {}, onNotice = () => {}, onReset = () => {} }) {
    const key = '4utowolves-tools-v1';
    const defaults = () => ({
      xp: {goal:0, stopGoal:true},
      gold: {goal:0, stopGoal:true},
      notifications: {goal:true, error:true, disconnect:true},
    });
    const clone = value => JSON.parse(JSON.stringify(value));
    function normalize(value) {
      const result = defaults();
      if (!value || typeof value !== 'object') throw new Error('invalid_settings');
      for (const farm of ['xp','gold']) {
        const n = value[farm]?.goal ?? 0;
        if (!Number.isSafeInteger(n) || n < 0 || n > 1e9) throw new Error('invalid_settings');
        result[farm].goal = n;
        if (typeof value[farm]?.stopGoal === 'boolean') result[farm].stopGoal = value[farm].stopGoal;
      }
      for (const field of Object.keys(result.notifications)) {
        if (typeof value.notifications?.[field] === 'boolean') result.notifications[field] = value.notifications[field];
      }
      return result;
    }
    function read() { try { return JSON.parse(storage.getItem(key)) || {}; } catch { return {}; } }
    const stored = read();
    let settings;
    try { settings = normalize(stored.settings || defaults()); } catch { settings = defaults(); }
    let profiles = Array.isArray(stored.profiles) ? stored.profiles.filter(p => {
      try { return typeof p.id === 'string' && typeof p.name === 'string' && !!normalize(p.settings); } catch { return false; }
    }).slice(0,20) : [];
    let persistenceError = false;
    const sessions = {};
    const gameCounts = new Set(), awards = new Map();
    let lastWrite = 0;
    function fresh(farm) { return {id:id(), farm, createdAt:now(), startedAt:null, endedAt:null, active:false, activeSince:null, elapsedMs:0, earned:0, count:0, reason:null, notified:[]}; }
    for (const farm of ['xp','gold']) sessions[farm] = fresh(farm);
    function elapsed(s) { return s.elapsedMs + (s.active ? Math.max(0,now()-s.activeSince) : 0); }
    function history() { const rows = read().history; return Array.isArray(rows) ? rows.filter(s => s && typeof s.id === 'string').slice(-100) : []; }
    function save(rows = history()) {
      try { storage.setItem(key,JSON.stringify({settings,profiles,history:rows.slice(-100)})); persistenceError = false; }
      catch { persistenceError = true; }
      lastWrite = now();
    }
    function persist() {
      const rows = history();
      for (const farm of ['xp','gold']) {
        const s = sessions[farm];
        if (s.startedAt === null && s.earned === 0 && s.count === 0) continue;
        const entry = {...clone(s), elapsedMs:elapsed(s), updatedAt:now(), active:false, activeSince:null, endedAt:s.endedAt || now()};
        const index = rows.findIndex(row => row.id === s.id);
        if (index >= 0) rows[index] = entry; else rows.push(entry);
      }
      save(rows);
    }
    function setActive(farm, active) {
      const s = sessions[farm];
      if (!s || s.active === active) return;
      if (active) { s.activeSince = now(); s.startedAt ??= now(); s.endedAt = null; }
      else { s.elapsedMs = elapsed(s); s.activeSince = null; s.endedAt = now(); }
      s.active = active;
      persist();
    }
    function reached(farm) {
      const s = sessions[farm], pref = settings[farm];
      return [
        ['goal',pref.goal > 0 && s.earned >= pref.goal,pref.stopGoal],
      ];
    }
    function check(farm) {
      const s = sessions[farm];
      let blocked = false;
      for (const [reason,hit,stop] of reached(farm)) {
        if (!hit) continue;
        if (!s.notified.includes(reason)) {
          s.notified.push(reason);
          if (settings.notifications.goal) onNotice({kind:'goal',farm,reason});
        }
        if (stop) {
          blocked = true;
          if (s.active) { s.reason = reason; setActive(farm,false); onStop(farm,reason); }
        }
      }
      return !blocked;
    }
    function record(farm, amount = 0, count = 0) {
      if (!sessions[farm] || !Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(count) || count < 0) return;
      const s = sessions[farm];
      s.startedAt ??= now();
      s.earned += amount; s.count += count;
      check(farm); persist();
    }
    function gameFinished(gameId) {
      if (!gameId || gameCounts.has(gameId)) return;
      gameCounts.add(gameId);
      if (gameCounts.size > 1000) gameCounts.delete(gameCounts.values().next().value);
      record('xp',0,1);
    }
    function xpAward(gameId, value) {
      if (!gameId || !Number.isFinite(value) || value < 0) return 0;
      gameFinished(gameId);
      const previous = awards.get(gameId) || 0;
      const delta = Math.max(0,value-previous);
      awards.set(gameId,Math.max(previous,value));
      if (awards.size > 1000) awards.delete(awards.keys().next().value);
      if (delta) record('xp',delta,0);
      return delta;
    }
    function snapshot() {
      const result = {settings:clone(settings), profiles:clone(profiles), history:history(), sessions:{}, persistenceError};
      for (const farm of ['xp','gold']) {
        const s = sessions[farm], ms = elapsed(s), pref = settings[farm];
        const rate = ms >= 1000 && s.earned > 0 ? s.earned*3600000/ms : null;
        result.sessions[farm] = {...clone(s), elapsedMs:ms, rate,
          progress:pref.goal > 0 ? Math.min(1,s.earned/pref.goal) : null,
          remaining:pref.goal > 0 ? Math.max(0,pref.goal-s.earned) : null,
          etaMs:pref.goal > 0 && s.earned >= pref.goal ? 0 : pref.goal > 0 && rate ? (pref.goal-s.earned)/rate*3600000 : null};
      }
      return result;
    }
    function configure(value) { settings = normalize(value); for (const s of Object.values(sessions)) s.notified=[]; save(); for (const farm of ['xp','gold']) check(farm); return snapshot(); }
    function reset(farm) {
      const targets = farm === 'all' ? ['xp','gold'] : [farm];
      if (targets.some(f => !sessions[f])) throw new Error('invalid_settings');
      for (const f of targets) { setActive(f,false); onStop(f,'reset'); }
      persist();
      for (const f of targets) { sessions[f] = fresh(f); onReset(f); }
      // Award deduplication survives a reset so a repeated game event is not counted again.
      return snapshot();
    }
    function saveProfile(name) {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 40) throw new Error('invalid_profile');
      const existing = profiles.find(p => p.name === name.trim());
      if (!existing && profiles.length >= 20) throw new Error('profile_limit');
      const profile = {id:existing?.id || id(),name:name.trim(),settings:clone(settings)};
      profiles = profiles.filter(p=>p.id!==profile.id); profiles.push(profile); save();
    }
    function applyProfile(profileId) { const p=profiles.find(p=>p.id===profileId); if (!p) throw new Error('invalid_profile'); configure(p.settings); }
    function deleteProfile(profileId) { profiles=profiles.filter(p=>p.id!==profileId); save(); }
    function notice(kind,farm) { if (settings.notifications[kind]) onNotice({kind,farm}); }
    function tick() { for (const farm of ['xp','gold']) if (sessions[farm].active) check(farm); if (now()-lastWrite>=5000 && Object.values(sessions).some(s=>s.active)) persist(); }
    function close() { for (const farm of ['xp','gold']) setActive(farm,false); persist(); }
    return {snapshot,configure,reset,saveProfile,applyProfile,deleteProfile,restore:()=>configure(defaults()),setActive,record,gameFinished,xpAward,allow:check,notice,tick,close};
  };
})(globalThis);
