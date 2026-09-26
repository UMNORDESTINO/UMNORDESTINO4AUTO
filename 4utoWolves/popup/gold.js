/** Controls the farm in the game tab. Closing this popup never stops the farm. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const start = byId('goldFarmStart'), spin = byId('goldFarmSpin');
  let state = null, lastResponse = 0, pending = null, targetTabId = null, authorized = null;
  const t = source => window.popupI18n.t(source);
  const errors = {
    auth: 'Abra ou recarregue o Wolvesville para conectar.',
    limit: 'Limite de giros atingido. Farm interrompida.',
    network: 'Falha de conexão. Confira o jogo antes de tentar novamente.',
    timeout: 'O giro não foi confirmado. Confira o jogo antes de tentar novamente.',
    rejected: 'O jogo recusou a solicitação. Farm interrompida.',
    invalid_response: 'Resposta da roleta não reconhecida. Farm interrompida.',
    ad_button_not_found: 'Não encontrei o botão Assistir vídeo. Abra a roleta de ouro.',
    inventory_button_not_found: 'Não encontrei o botão Inventário / Inventory na tela inicial.',
    gold_button_not_found: 'Não encontrei o botão Ouro grátis! para voltar à roleta.',
    ad_close_failed: 'O anúncio terminou, mas não consegui fechar a tela automaticamente.',
    spin_button_not_found: 'O anúncio terminou, mas o botão Girar não apareceu.',
    reward_timeout: 'A roleta girou, mas o prêmio não foi confirmado a tempo.',
    ui_not_found: 'A interface mudou e o controle esperado não foi encontrado.',
  };
  function render() {
    const ready = state && Date.now() - lastResponse < 12000;
    const locked = ready && authorized === false;
    const status = !ready ? 'offline' : locked ? 'locked' : state.status;
    byId('goldStatusCard').dataset.state = status;
    byId('goldStatusTitle').textContent = {
      offline: 'Aguardando o jogo', locked: 'Token necessário', stopped: 'Farm parada', checking: 'Preparando farm',
      ad: 'Assistindo anúncio', closing_ad: 'Fechando anúncio', ready_to_spin: 'Pronta para girar', checking: state?.phase === 'opening_gold_wheel' ? 'Abrindo roleta' : 'Preparando farm',
      spinning: 'Girando roleta', waiting: 'Aguardando giro', error: 'Farm interrompida',
    }[status];
    byId('goldStatusBadge').textContent = {
      offline: 'OFFLINE', locked: 'BLOQUEADA', stopped: 'DESATIVADA', checking: 'PREPARANDO',
      ad: 'ANÚNCIO', closing_ad: 'FECHANDO', ready_to_spin: 'PRONTA',
      spinning: 'GIRANDO', waiting: 'AGUARDANDO', error: 'ERRO',
    }[status];
    let description = !ready ? t('Abra ou recarregue o Wolvesville para conectar.') :
      locked ? t('Gere um token grátis nas configurações para liberar a farm.') :
      state.error ? t(errors[state.error] || errors.network) :
      state.busy && !state.active && status === 'stopped' ? t('Finalizando o giro já enviado.') :
      status === 'checking' ? t('Procurando o botão Assistir vídeo.') :
      status === 'ad' ? t('Anúncio aberto. Aguardando o tempo do vídeo terminar.') :
      status === 'closing_ad' ? t('Tentando fechar o anúncio concluído.') :
      status === 'ready_to_spin' ? t('Anúncio concluído. Procurando o botão Girar.') :
      status === 'spinning' ? t('Roleta girando. Aguardando a confirmação do prêmio.') :
      t('Aguardando você iniciar a automação.');
    if (ready && status === 'waiting' && Number.isFinite(state.nextAt)) {
      const seconds = Math.max(0, Math.ceil((state.nextAt - Date.now()) / 1000));
      const time = [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(n => String(n).padStart(2, '0')).join(':');
      description = t(state.active ? 'Próxima verificação em {time}.' : 'Roleta disponível em {time}.').replace('{time}', time);
    }
    byId('goldDescription').textContent = description;
    byId('goldStartLabel').textContent = state?.active ? 'Parar Farm' : 'Iniciar Farm';
    start.setAttribute('aria-pressed', String(!!state?.active));
    start.disabled = !ready || locked || !!pending || (!state.active && state.busy);
    spin.disabled = !ready || locked || !!pending || state.active || state.busy || (state.nextAt > Date.now());
    start.title = spin.title = !ready ? 'Aguardando conexão com o jogo' : locked ? 'Gere um token grátis para liberar' : pending ? 'Aguardando confirmação do jogo' : '';
    start.setAttribute('aria-busy', String(!!pending));
    spin.setAttribute('aria-busy', String(!!pending || !!state?.busy));
  }
  function metric(id, value, prefix = '') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return;
    const element = byId(id);
    element.dataset.numericValue = value;
    element.dataset.numericPrefix = prefix;
    element.textContent = prefix + value.toLocaleString(window.popupI18n.locale);
  }
  async function command(type) {
    if (pending) return;
    const commandId = crypto.randomUUID();
    const timeout = setTimeout(() => {
      if (pending?.id !== commandId) return;
      pending = null;
      lastResponse = 0;
      render();
      showFooterNotification(t('Gere seu token grátis: clique no ícone de perfil para acessar o site.'), 'error');
    }, 18000);
    pending = {id: commandId, timeout};
    render();
    try {
      if (targetTabId === null) throw new Error('offline');
      const response = await chrome.tabs.sendMessage(targetTabId, {
        type: 'POPUP_TO_PAGE', data: {type, commandId},
      });
      if (!response?.success) throw new Error('offline');
    } catch {
      clearTimeout(timeout);
      if (pending?.id === commandId) pending = null;
      lastResponse = 0;
      render();
      showFooterNotification(t('Recarregue o jogo para conectar a extensão.'), 'error');
    }
  }
  start.addEventListener('click', () => { if (!start.disabled) void command(state.active ? 'GOLD_FARM_STOP' : 'GOLD_FARM_START'); });
  spin.addEventListener('click', () => { if (!spin.disabled) void command('SPIN_GOLD_WHEEL'); });
  port.onMessage.addListener(message => {
    if (message?.type !== 'UPDATE_UI') return;
    if (message.sourceTabId !== undefined && message.sourceTabId !== targetTabId) return;
    authorized = message.authStatus === 'authorized';
    metric('goldSessionSpins', message.goldSessionSpins);
    metric('goldSessionEarned', message.goldSessionEarned, '+');
    metric('goldTotalCoins', message.coins);
    if (message.goldFarm && ['stopped','checking','spinning','waiting','error'].includes(message.goldFarm.status)) {
      state = message.goldFarm;
      lastResponse = Date.now();
      if (pending && pending.id === message.goldCommandId) { clearTimeout(pending.timeout); pending = null; }
    }
    render();
  });
  port.onDisconnect.addListener(() => { lastResponse = 0; render(); });
  const timer = setInterval(render, 1000);
  window.addEventListener('languagechange', render);
  window.addEventListener('pagehide', () => { clearInterval(timer); if (pending) clearTimeout(pending.timeout); }, {once:true});
  render();
  chrome.tabs.query({url: '*://www.wolvesville.com/*'}).then(tabs => {
    if (!tabs[0]) return;
    targetTabId = tabs[0].id;
    return chrome.tabs.sendMessage(targetTabId, {type: 'POPUP_TO_PAGE', data: {type: 'REQUEST_UI_DATA'}});
  }).catch(() => { lastResponse = 0; render(); });
})();
