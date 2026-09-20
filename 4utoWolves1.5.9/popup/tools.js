/** Tools UI. Commands are acknowledged by the engine in the selected game tab. */
(() => {
  'use strict';
  const root = document.getElementById('page-misc'), results = document.getElementById('page-results'), settingsSystem = document.getElementById('settingsSystem'), settingsNotifications = document.getElementById('settingsNotifications'), byId = id => document.getElementById(id);
  const roots = [root, results, settingsSystem, settingsNotifications];
  const queryAll = selector => roots.flatMap(node => [...node.querySelectorAll(selector)]);
  const locale = () => window.popupI18n.locale;
  const t = source => { const text = toolsText(source, locale()); return text === source ? window.popupI18n.t(source) : text; };
  const number = n => Number.isFinite(n) ? n.toLocaleString(locale(), { maximumFractionDigits: 1 }) : '—';
  const time = ms => { if (!Number.isFinite(ms)) return '—'; const s = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(v => String(v).padStart(2, '0')).join(':'); };
  const fields = { xp: { goal: 'toolsXpGoal', stopGoal: 'toolsXpStopGoal' }, gold: { goal: 'toolsGoldGoal', stopGoal: 'toolsGoldStopGoal' }, notifications: { goal: 'toolsNotifyGoal', error: 'toolsNotifyError', disconnect: 'toolsNotifyDisconnect' } };
  let tabId = null, packet = null, lastResponse = 0, dirty = false, pending = null, feedback = '', notificationsGranted = null;
  let profileSignature = '', historySignature = '', chartSignature = '';
  function element(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
  function live() { return !!packet?.tools && Date.now() - lastResponse < 12000; }
  function readSettings() { const settings = {}; for (const [group, items] of Object.entries(fields)) { settings[group] = {}; for (const [key, id] of Object.entries(items)) { const input = byId(id); settings[group][key] = input.type === 'checkbox' ? input.checked : input.value === '' ? 0 : input.valueAsNumber; } } return settings; }
  function fillSettings() { if (dirty || !packet?.tools) return; for (const [group, items] of Object.entries(fields)) for (const [key, id] of Object.entries(items)) { const input = byId(id), value = packet.tools.settings[group][key]; if (input.type === 'checkbox') input.checked = value; else input.value = value; } }
  function stat(list, label, value) { list.append(element('dt', t(label)), element('dd', value)); }
  function renderSessions() {
    const container = byId('toolsSessionStats'); container.replaceChildren();
    if (!packet?.tools) { container.append(element('p', t('Aguardando dados'), 'tools-hint')); return; }
    for (const farm of ['xp', 'gold']) {
      const s = packet.tools.sessions[farm], pref = packet.tools.settings[farm];
      const elapsed = s.elapsedMs + (s.active && live() ? Math.max(0, Date.now() - lastResponse) : 0);
      const rate = elapsed >= 1000 && s.earned > 0 ? s.earned * 3600000 / elapsed : null;
      const card = element('section', undefined, 'tools-session');
      card.append(element('h3', farm === 'xp' ? 'XP' : t('Ouro')));
      const label = element('p', t(s.active && live() ? 'Em atividade' : 'Parada'), 'tools-hint'); card.append(label);
      const list = element('dl'); stat(list, 'Ganhos', number(s.earned)); stat(list, farm === 'xp' ? 'Partidas' : 'Giros', number(s.count)); stat(list, 'Tempo ativo', time(elapsed)); stat(list, farm === 'xp' ? 'XP por hora' : 'Ouro por hora', number(rate));
      if (pref.goal > 0) { const remaining = Math.max(0, pref.goal - s.earned); stat(list, 'Faltam', number(remaining)); stat(list, 'Tempo estimado', remaining === 0 ? t('Meta concluída') : time(rate ? remaining / rate * 3600000 : null)); }
      card.append(list);
      const progress = document.createElement('progress'); progress.max = pref.goal || 1; progress.value = Math.min(s.earned, pref.goal || 0); progress.setAttribute('aria-label', t(farm === 'xp' ? 'Meta de XP' : 'Meta de Ouro')); card.append(progress);
      card.append(element('p', pref.goal > 0 ? `${number(s.earned)} / ${number(pref.goal)}` : t('Sem meta'), 'tools-hint'));
      if (s.reason) card.append(element('p', t(s.reason === 'goal' ? 'Meta atingida' : 'Parada'), 'tools-limit'));
      container.append(card);
    }
    container.append(element('p', t('A estimativa usa a média da sessão e pode variar.'), 'tools-hint'));
  }
  function renderProfiles() {
    const profiles = packet?.tools.profiles || [], signature = locale() + JSON.stringify(profiles);
    if (signature === profileSignature) return; profileSignature = signature;
    const select = byId('toolsProfiles'), previous = select.value; select.replaceChildren();
    if (!profiles.length) select.append(new Option(t('Sem perfis salvos'), ''));
    for (const profile of profiles) select.append(new Option(profile.name, profile.id));
    if (profiles.some(p => p.id === previous)) select.value = previous;
  }
  function renderHistory() {
    const rows = packet?.tools.history || [], signature = locale() + JSON.stringify(rows);
    if (signature === historySignature) return; historySignature = signature;
    const container = byId('toolsHistory'); container.replaceChildren();
    if (!rows.length) { container.append(element('p', t('Sem sessões registradas'), 'tools-hint')); return; }
    for (const row of [...rows].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 6)) {
      const item = element('article', undefined, 'tools-history-row');
      item.append(element('strong', `${row.farm === 'xp' ? 'XP' : t('Ouro')} · ${new Date(row.startedAt ?? row.createdAt).toLocaleString(locale())}`));
      item.append(element('p', `${t('Ganhos')}: ${number(row.earned)} · ${t(row.farm === 'xp' ? 'Partidas' : 'Giros')}: ${number(row.count)} · ${time(row.elapsedMs)}`)); container.append(item);
    }
  }
  function barChart(id, rows, key) {
    const container = byId(id); if (!container) return;
    if (!rows.length) { container.replaceChildren(element('p', t('Sem dados suficientes para o gráfico'), 'tools-hint')); return; }
    const max = Math.max(1, ...rows.map(row => row[key] || 0));
    const barWidth = 26, gap = 9, height = 84;
    const chartWidth = rows.length * (barWidth + gap) + gap;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${chartWidth} ${height + 16}`);
    svg.setAttribute('class', 'tools-chart-svg');
    svg.setAttribute('role', 'img');
    rows.forEach((row, i) => {
      const value = row[key] || 0, barHeight = Math.max(2, Math.round(value / max * height));
      const x = gap + i * (barWidth + gap), y = height - barHeight;
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bar.setAttribute('x', x); bar.setAttribute('y', y); bar.setAttribute('width', barWidth); bar.setAttribute('height', barHeight); bar.setAttribute('rx', 4);
      bar.setAttribute('class', row.farm === 'xp' ? 'tools-chart-bar-xp' : 'tools-chart-bar-gold');
      const valueLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      valueLabel.setAttribute('x', x + barWidth / 2); valueLabel.setAttribute('y', Math.max(9, y - 4)); valueLabel.setAttribute('text-anchor', 'middle'); valueLabel.setAttribute('class', 'tools-chart-value'); valueLabel.textContent = number(value);
      const dateLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      dateLabel.setAttribute('x', x + barWidth / 2); dateLabel.setAttribute('y', height + 12); dateLabel.setAttribute('text-anchor', 'middle'); dateLabel.setAttribute('class', 'tools-chart-label'); dateLabel.textContent = new Date(row.startedAt ?? row.createdAt ?? Date.now()).toLocaleDateString(locale(), { day: '2-digit', month: '2-digit' });
      svg.append(bar, valueLabel, dateLabel);
    });
    container.replaceChildren(svg);
  }
  function renderCharts() {
    const rows = packet?.tools.history || [], signature = locale() + JSON.stringify(rows);
    if (signature === chartSignature) return; chartSignature = signature;
    const recent = [...rows].sort((a, b) => (a.startedAt ?? a.createdAt ?? 0) - (b.startedAt ?? b.createdAt ?? 0)).slice(-8);
    barChart('toolsChartEarned', recent, 'earned');
    barChart('toolsChartCount', recent, 'count');
  }
  function renderDiagnostics() {
    const container = byId('toolsDiagnostics'); container.replaceChildren();
    stat(container, 'Extensão', chrome.runtime.id ? t('Disponível') : t('Aguardando dados'));
    const d = packet?.diagnostics || {};
    for (const [label, key] of [['Motor do jogo', 'engine'], ['Dados da conta', 'player'], ['Dados do inventário', 'inventory'], ['Autenticação', 'authentication']]) stat(container, label, live() && d[key] ? t('Disponível') : t('Aguardando dados'));
    const wheel = packet?.goldFarm?.status;
    stat(container, 'Roleta', !live() ? t('Aguardando dados') : wheel === 'waiting' ? t('WAITING') : wheel === 'error' ? t('Unavailable') : packet.goldWheelAvailable ? t('Available') : t('Checking...'));
    stat(container, 'Permissão de notificações', notificationsGranted === null ? '—' : t(notificationsGranted ? 'Disponível' : 'Bloqueada'));
    stat(container, 'Atualização', lastResponse ? new Date(lastResponse).toLocaleTimeString(locale()) : '—');
  }
  function render() {
    root.querySelector('.page-title').textContent = t('Tools');
    for (const node of queryAll('[data-tool-text]')) node.textContent = t(node.dataset.toolText);
    fillSettings(); renderSessions(); renderProfiles(); renderHistory(); renderCharts(); renderDiagnostics();
    for (const button of queryAll('button')) button.disabled = !!pending || !live();
    byId('toolsExportCsv').disabled = !packet?.tools;
    byId('toolsRefresh').disabled = tabId === null || !!pending;
    byId('toolsProfileApply').disabled = byId('toolsProfileDelete').disabled = !live() || !!pending || !byId('toolsProfiles').value;
    for (const input of queryAll('input,select')) input.disabled = !!pending;
    byId('toolsFeedback').textContent = t(pending ? 'Aguardando confirmação' : packet?.tools.persistenceError ? 'Não foi possível salvar no navegador.' : feedback || (dirty ? 'Alterações não salvas' : ''));
  }
  async function command(action, extra = {}) {
    if (!live() || pending) { feedback = 'Abra o jogo para usar as ferramentas.'; render(); return; }
    const commandId = crypto.randomUUID();
    const timeout = setTimeout(() => { if (pending?.id === commandId) { pending = null; feedback = 'A alteração não foi confirmada. Recarregue o jogo.'; render(); } }, 10000);
    pending = { id: commandId, action, timeout }; render();
    try { const response = await chrome.tabs.sendMessage(tabId, { type: 'POPUP_TO_PAGE', data: { type: 'TOOLS_COMMAND', action, commandId, ...extra } }); if (!response?.success) throw Error('offline'); }
    catch { clearTimeout(timeout); pending = null; lastResponse = 0; feedback = 'Abra o jogo para usar as ferramentas.'; render(); }
  }
  byId('toolsPrefs').addEventListener('submit', event => { event.preventDefault(); if (event.target.reportValidity()) void command('save', { settings: readSettings() }); });
  for (const items of Object.values(fields)) for (const id of Object.values(items)) byId(id).addEventListener('input', () => { dirty = true; feedback = ''; byId('toolsFeedback').textContent = t('Alterações não salvas'); });
  for (const id of Object.values(fields.notifications)) byId(id).addEventListener('change', () => void command('save', { settings: readSettings() }));
  for (const button of queryAll('[data-tool-action="reset"]')) button.addEventListener('click', () => { if (confirm(t('Confirmar reinício dos contadores? A farm será parada e a sessão atual ficará no histórico.'))) void command('reset', { farm: button.dataset.farm }); });
  byId('toolsRestore').addEventListener('click', () => { if (confirm(t('Restaurar as metas e alertas padrão?'))) void command('restore'); });
  byId('toolsProfileSave').addEventListener('click', () => { if (dirty) { feedback = 'Primeiro salve as alterações das metas e alertas.'; render(); return; } void command('saveProfile', { name: byId('toolsProfileName').value }); });
  byId('toolsProfileApply').addEventListener('click', () => { if (confirm(t('Aplicar este perfil e substituir as metas atuais?'))) void command('applyProfile', { profileId: byId('toolsProfiles').value }); });
  byId('toolsProfileDelete').addEventListener('click', () => { if (confirm(t('Excluir o perfil selecionado?'))) void command('deleteProfile', { profileId: byId('toolsProfiles').value }); });
  function exportReport() {
    if (!packet?.tools) return;
    const rows = new Map(packet.tools.history.map(row => [row.id, row])); for (const s of Object.values(packet.tools.sessions)) rows.set(s.id, s);
    const quote = value => '"' + String(value ?? '').replace(/^([=+@-])/, '\'$1').replaceAll('"', '""') + '"';
    const text = '\uFEFF' + ['farm,started_at,ended_at,active_ms,earned,count', ...[...rows.values()].map(s => [s.farm, s.startedAt ? new Date(s.startedAt).toISOString() : '', s.endedAt ? new Date(s.endedAt).toISOString() : '', s.elapsedMs, s.earned, s.count].map(quote).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' })), link = element('a'); link.href = url; link.download = `4utowolves-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  byId('toolsExportCsv').addEventListener('click', () => exportReport());
  async function refresh(showFeedback = true) { if (tabId === null) return; try { await chrome.tabs.sendMessage(tabId, { type: 'POPUP_TO_PAGE', data: { type: 'REQUEST_UI_DATA' } }); if (showFeedback) feedback = 'Verificação solicitada'; } catch { lastResponse = 0; } render(); }
  byId('toolsRefresh').addEventListener('click', () => void refresh());
  port.onMessage.addListener(message => {
    if (message?.type !== 'UPDATE_UI' || !message.tools || (message.sourceTabId !== undefined && message.sourceTabId !== tabId)) return;
    packet = message; lastResponse = Date.now();
    if (pending && pending.id === message.toolsReply?.id) {
      clearTimeout(pending.timeout);
      if (message.toolsReply.ok) { if (['save', 'applyProfile', 'restore'].includes(pending.action)) dirty = false; feedback = 'Salvo'; }
      else feedback = { busy: 'Aguarde o giro em andamento antes de zerar.', invalid_profile: 'Informe um nome de perfil com até 40 caracteres.', profile_limit: 'Limite de 20 perfis. Exclua um perfil antes de criar outro.' }[message.toolsReply.error] || 'Confira os valores informados.';
      pending = null;
    }
    render();
  });
  port.onDisconnect.addListener(() => { lastResponse = 0; render(); });
  window.addEventListener('languagechange', render);
  const timer = setInterval(() => { if (root.classList.contains('active') || results.classList.contains('active') || document.getElementById('page-options').classList.contains('active')) render(); }, 1000);
  window.addEventListener('pagehide', () => { clearInterval(timer); if (pending) clearTimeout(pending.timeout); }, { once: true });
  chrome.notifications?.getPermissionLevel().then(level => { notificationsGranted = level === 'granted'; render(); }).catch(() => { });
  chrome.tabs.query({ url: '*://www.wolvesville.com/*' }).then(tabs => { if (tabs[0]) { tabId = tabs[0].id; void refresh(false); } }).catch(() => { });
  render();
})();
