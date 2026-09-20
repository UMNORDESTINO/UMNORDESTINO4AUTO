/** Single-flight free-wheel controller. Starts stopped; state lives in the game tab. */
(function (root) {
  'use strict';
  root.createGoldFarm = function ({ request, secret, onReward, onChange, canSpin = () => true, now = Date.now,
    schedule = (fn, ms) => setTimeout(fn, ms), cancel = id => clearTimeout(id) }) {
    const state = { active: false, busy: false, status: 'stopped', nextAt: null, error: null };
    let timer, generation = 0;
    const snapshot = () => ({ ...state });
    const emit = () => onChange(snapshot());
    function stop() {
      generation++;
      cancel(timer);
      state.active = false;
      state.status = 'stopped';
      state.nextAt = null;
      state.error = null;
      emit();
    }
    function waitUntil(time, token) {
      state.status = 'waiting';
      state.nextAt = time;
      if (state.active) {
        timer = schedule(() => {
          if (token !== generation || !state.active) return;
          if (now() < time) { waitUntil(time, token); return; }
          void run(token);
        }, Math.min(2147483647, Math.max(1000, time - now())));
      }
    }
    function availability(data) {
      if (!data || typeof data !== 'object' || Array.isArray(data) || data.code || data.error ||
          (!Object.hasOwn(data, 'nextRewardAvailableTime') && !Array.isArray(data.items))) {
        throw new Error('invalid_response');
      }
      const raw = data.nextRewardAvailableTime;
      if (raw == null || raw === 0) return 0;
      const time = typeof raw === 'number' ? raw : Date.parse(raw);
      if (!Number.isFinite(time) || time < 0) throw new Error('invalid_response');
      return time;
    }
    async function run(token) {
      if (state.busy || token !== generation) return;
      state.busy = true;
      state.status = 'checking';
      state.error = null;
      state.nextAt = null;
      emit();
      try {
        if (!canSpin()) { stop(); return; }
        const data = await request('/rewards/wheelItems/v2', 'GET');
        if (token !== generation) return;
        if (!canSpin()) { stop(); return; }
        const nextAt = availability(data);
        if (nextAt > now()) { waitUntil(nextAt, token); return; }
        state.status = 'spinning';
        emit();
        const result = await request('/rewards/wheelRewardWithSecret/' + secret(), 'POST');
        const winners = Array.isArray(result) ? result.filter(item => item && item.winner) : [];
        if (winners.length !== 1 || (winners[0].silver != null &&
            (typeof winners[0].silver !== 'number' || !Number.isFinite(winners[0].silver) || winners[0].silver < 0))) {
          throw new Error(result?.code || result?.error ? 'rejected' : 'invalid_response');
        }
        // A submitted spin may finish after Stop. Count it, but never schedule another.
        onReward(winners[0]);
        if (token !== generation) return;
        if (state.active) waitUntil(now() + 5000, token);
        else state.status = 'stopped';
      } catch (error) {
        if (token === generation) {
          state.active = false;
          state.status = 'error';
          state.nextAt = null;
          state.error = ['auth', 'limit', 'network', 'timeout', 'rejected', 'invalid_response'].includes(error.message) ? error.message : 'network';
        }
      } finally {
        state.busy = false;
        emit();
      }
    }
    function start() {
      if (state.active || state.busy) return;
      cancel(timer);
      state.active = true;
      void run(++generation);
    }
    function spinOnce() {
      if (state.active || state.busy) return;
      cancel(timer);
      void run(++generation);
    }
    return { start, stop, spinOnce, snapshot };
  };
})(globalThis);
