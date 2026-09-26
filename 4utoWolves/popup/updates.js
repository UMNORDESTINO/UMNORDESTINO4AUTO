/** GitHub-backed update history. Remote content is rendered only as text. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id), badge = byId('updatesBadge'), list = byId('updatesList'), panel = byId('updatesPanel'), button = byId('updatesButton');
  let state = null, refreshing = false;
  const t = source => window.popupI18n.t(source);
  const language = () => window.popupI18n.locale;
  function render() {
    const unread = state?.unreadIds?.length || 0;
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.classList.toggle('hidden', unread === 0);
    badge.setAttribute('aria-label', `${t('Novidades não lidas')}: ${unread}`);
    byId('updatesRefresh').disabled = refreshing || !state?.configured;
    byId('updatesStatus').textContent = refreshing ? t('Verificando atualizações...') :
      !state?.configured ? t('Aguardando configuração do repositório.') :
        state.error ? t('Não foi possível buscar as atualizações. Exibindo o histórico salvo.') :
          !state.updates?.length ? t('Nenhuma atualização publicada.') : t('Atualizações verificadas.');
    list.replaceChildren();
    for (const update of state?.updates || []) {
      const article = document.createElement('article'); article.className = 'update-item'; article.dataset.unread = String(state.unreadIds.includes(update.id));
      const meta = document.createElement('div'); meta.className = 'update-meta';
      const version = document.createElement('span'); version.textContent = `v${update.version}`;
      const date = document.createElement('time'); date.dateTime = update.date; date.textContent = new Date(update.date + 'T00:00:00Z').toLocaleDateString(language(), { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC' }); meta.append(version, date);
      const title = document.createElement('h4'); title.textContent = update.title[language()] || update.title['pt-BR'];
      const description = document.createElement('p'); description.textContent = update.description[language()] || update.description['pt-BR'];
      article.append(meta, title, description);
      if (update.url) { const link = document.createElement('a'); link.href = update.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = t('Saiba mais'); article.append(link); }
      list.append(article);
    }
  }
  async function load(type = 'GET_UPDATES') {
    refreshing = type === 'REFRESH_UPDATES'; render();
    try { state = await chrome.runtime.sendMessage({ type }); }
    catch { state = { configured: false, updates: [], unreadIds: [], error: 'runtime_error' }; }
    refreshing = false; render();
  }
  async function markVisibleRead() {
    if (!state?.unreadIds?.length) return;
    try { state = await chrome.runtime.sendMessage({ type: 'MARK_UPDATES_READ', ids: state.unreadIds }); render(); } catch { }
  }
  function openPanel() {
    panel.classList.remove('hidden'); button.setAttribute('aria-expanded', 'true'); byId('updatesClose').focus();
    setTimeout(() => void markVisibleRead(), 500);
  }
  function closePanel() { panel.classList.add('hidden'); button.setAttribute('aria-expanded', 'false'); button.focus(); }
  byId('updatesRefresh').addEventListener('click', () => void load('REFRESH_UPDATES'));
  button.addEventListener('click', openPanel);
  byId('updatesClose').addEventListener('click', closePanel);
  panel.addEventListener('click', event => { if (event.target === panel) closePanel(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.classList.contains('hidden')) closePanel(); });
  chrome.runtime.onMessage.addListener(message => { if (message?.type === 'UPDATES_CHANGED' && message.state) { state = message.state; render(); } });
  window.addEventListener('languagechange', render);
  void load();
})();
