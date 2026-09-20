/** Popup-only translations. Game commands and account data stay unchanged. */
(() => {
  'use strict';
  const languages = ['pt-BR', 'en', 'es', 'fr'];
  // Source text, Portuguese, English, Spanish, French.
  const rows = [
    ['Automation Panel','Painel de automação','Automation Panel','Panel de automatización','Panneau d’automatisation'],
    ['Farm de XP','Farm de XP','XP Farm','Farm de XP','Farm XP'],
    ['Perfil','Perfil','Profile','Perfil','Profil'],
    ['Fechar','Fechar','Close','Cerrar','Fermer'],
    ['Seja bem-vindo(a)','Seja bem-vindo(a)','Welcome','Bienvenido/a','Bienvenue'],
    ['Nível atual','Nível atual','Current level','Nivel actual','Niveau actuel'],
    ['Aguardando dados de XP do jogo.','Aguardando dados de XP do jogo.','Waiting for XP data from the game.','Esperando datos de XP del juego.','En attente des données XP du jeu.'],
    ['XP restantes para o próximo nível','XP restantes para o próximo nível','XP left for the next level','XP restante para el próximo nivel','XP restant avant le niveau suivant'],
    ['Tudo pronto para sua próxima partida','Tudo pronto para sua próxima partida','Ready for your next game','Todo listo para tu próxima partida','Tout est prêt pour votre prochaine partie'],
    ['AUTOMATION STATUS','STATUS DA AUTOMAÇÃO','AUTOMATION STATUS','ESTADO DE AUTOMATIZACIÓN','ÉTAT DE L’AUTOMATISATION'],
    ['Aguardando o jogo','Aguardando o jogo','Waiting for the game','Esperando el juego','En attente du jeu'],
    ['Abra o Wolvesville para conectar.','Abra o Wolvesville para conectar.','Open Wolvesville to connect.','Abre Wolvesville para conectar.','Ouvrez Wolvesville pour vous connecter.'],
    ['WAITING','AGUARDANDO','WAITING','ESPERANDO','EN ATTENTE'],
    ['ACTIVE','ATIVO','ACTIVE','ACTIVO','ACTIF'],
    ['PAUSED','PAUSADO','PAUSED','EN PAUSA','EN PAUSE'],
    ['OFFLINE','SEM CONEXÃO','OFFLINE','SIN CONEXIÓN','HORS LIGNE'],
    ['ENABLED','ATIVADO','ENABLED','ACTIVADO','ACTIVÉ'],
    ['DISABLED','DESATIVADO','DISABLED','DESACTIVADO','DÉSACTIVÉ'],
    ['Resumo','Resumo','Summary','Resumen','Résumé'],
    ['sessão','sessão','session','sesión','session'],
    ['Coins','Moedas','Coins','Monedas','Pièces'],
    ['Ouro','Ouro','Gold','Oro','Or'],
    ['Farm de Ouro','Farm de Ouro','Gold Farm','Farm de Oro','Farm d’or'],
    ['Automatize a Gold Wheel e acompanhe a sessão','Automatize a Gold Wheel e acompanhe a sessão','Automate the Gold Wheel and track your session','Automatiza la ruleta de oro y sigue tu sesión','Automatisez la roue d’or et suivez votre session'],
    ['STATUS DA FARM','STATUS DA FARM','FARM STATUS','ESTADO DEL FARM','ÉTAT DU FARM'],
    ['Farm parada','Farm parada','Farm stopped','Farm detenido','Farm arrêté'],
    ['PARADA','PARADA','STOPPED','DETENIDO','ARRÊTÉ'],
    ['Aguardando você iniciar a automação.','Aguardando você iniciar a automação.','Waiting for you to start automation.','Esperando que inicies la automatización.','En attente du démarrage de l’automatisation.'],
    ['Resumo da sessão','Resumo da sessão','Session summary','Resumen de la sesión','Résumé de la session'],
    ['Giros','Giros','Spins','Giros','Tours'],
    ['Ouro ganho','Ouro ganho','Gold earned','Oro ganado','Or gagné'],
    ['Total','Total','Total','Total','Total'],
    ['Controles','Controles','Controls','Controles','Commandes'],
    ['Iniciar Farm','Iniciar Farm','Start Farm','Iniciar Farm','Démarrer'],
    ['Girar uma vez','Girar uma vez','Spin once','Girar una vez','Tourner une fois'],
    ['Verificando roleta','Verificando roleta','Checking wheel','Verificando ruleta','Vérification'],
    ['Girando roleta','Girando roleta','Spinning wheel','Girando ruleta','Tour en cours'],
    ['Aguardando giro','Aguardando giro','Waiting to spin','Esperando giro','En attente'],
    ['Farm interrompida','Farm interrompida','Farm stopped','Farm interrumpido','Farm interrompu'],
    ['VERIFICANDO','VERIFICANDO','CHECKING','VERIFICANDO','VÉRIFICATION'],
    ['GIRANDO','GIRANDO','SPINNING','GIRANDO','EN COURS'],
    ['ERRO','ERRO','ERROR','ERROR','ERREUR'],
    ['Parar Farm','Parar Farm','Stop Farm','Parar Farm','Arrêter'],
    ['Consultando a disponibilidade da roleta.','Consultando a disponibilidade da roleta.','Checking wheel availability.','Consultando la disponibilidad de la ruleta.','Vérification de la disponibilité de la roue.'],
    ['Aguardando a confirmação do prêmio.','Aguardando a confirmação do prêmio.','Waiting for reward confirmation.','Esperando la confirmación del premio.','En attente de confirmation du gain.'],
    ['Finalizando o giro já enviado.','Finalizando o giro já enviado.','Finishing the submitted spin.','Finalizando el giro enviado.','Finalisation du tour déjà lancé.'],
    ['Próxima verificação em {time}.','Próxima verificação em {time}.','Next check in {time}.','Próxima comprobación en {time}.','Prochaine vérification dans {time}.'],
    ['Roleta disponível em {time}.','Roleta disponível em {time}.','Wheel available in {time}.','Ruleta disponible en {time}.','Roue disponible dans {time}.'],
    ['Limite de giros atingido. Farm interrompida.','Limite de giros atingido. Farm interrompida.','Spin limit reached. Farm stopped.','Límite de giros alcanzado. Farm detenido.','Limite de tours atteinte. Farm arrêté.'],
    ['Falha de conexão. Confira o jogo antes de tentar novamente.','Falha de conexão. Confira o jogo antes de tentar novamente.','Connection failed. Check the game before trying again.','Error de conexión. Revisa el juego antes de volver a intentarlo.','Échec de connexion. Vérifiez le jeu avant de réessayer.'],
    ['O giro não foi confirmado. Confira o jogo antes de tentar novamente.','O giro não foi confirmado. Confira o jogo antes de tentar novamente.','Spin not confirmed. Check the game before trying again.','Giro sin confirmar. Revisa el juego antes de volver a intentarlo.','Tour non confirmé. Vérifiez le jeu avant de réessayer.'],
    ['O jogo recusou a solicitação. Farm interrompida.','O jogo recusou a solicitação. Farm interrompida.','The game rejected the request. Farm stopped.','El juego rechazó la solicitud. Farm detenido.','Le jeu a refusé la demande. Farm arrêté.'],
    ['Resposta da roleta não reconhecida. Farm interrompida.','Resposta da roleta não reconhecida. Farm interrompida.','Unrecognized wheel response. Farm stopped.','Respuesta de la ruleta no reconocida. Farm detenido.','Réponse de la roue non reconnue. Farm arrêté.'],
    ['Em breve','Em breve','Coming soon','Próximamente','Bientôt'],

    ['Roses','Rosas','Roses','Rosas','Roses'],
    ['Ações rápidas','Ações rápidas','Quick actions','Acciones rápidas','Actions rapides'],
    ['XP da sessão','XP da sessão','Session XP','XP de la sesión','XP de la session'],
    ['Session XP','XP da sessão','Session XP','XP de la sesión','XP de la session'],
    ['Tools','Ferramentas','Tools','Herramientas','Outils'],
    ['Wheels','Roletas','Wheels','Ruletas','Roues'],
    ['Gold Wheel','Roleta de ouro','Gold Wheel','Ruleta de oro','Roue d’or'],
    ['Rose Wheel','Roleta de rosas','Rose Wheel','Ruleta de rosas','Roue de roses'],
    ['Checking...','Verificando...','Checking...','Comprobando...','Vérification...'],
    ['30 🌹 per spin','30 🌹 por giro','30 🌹 per spin','30 🌹 por giro','30 🌹 par tour'],
    ['Settings','Configurações','Settings','Ajustes','Réglages'],
    ['Nível','Nível','Level','Nivel','Niveau'],
    ['Licença','Licença','License','Licencia','Licence'],
    ['Unlimited','Ilimitada','Unlimited','Ilimitada','Illimitée'],
    ['Automatically restart when game ends','Reiniciar automaticamente ao terminar a partida','Automatically restart when game ends','Reiniciar al terminar la partida','Relancer automatiquement à la fin de la partie'],
    ['Auto play in custom couple games','Jogar automaticamente em partidas personalizadas de casais','Auto play in custom couple games','Jugar automáticamente en partidas personalizadas de parejas','Jouer automatiquement dans les parties personnalisées en couples'],
    ['Show Hidden Level','Mostrar níveis ocultos','Show Hidden Level','Mostrar niveles ocultos','Afficher les niveaux masqués'],
    ['Mostrar níveis ocultos','Mostrar níveis ocultos','Show hidden levels','Mostrar niveles ocultos','Afficher les niveaux masqués'],
    ["Display other players' levels",'Exibir os níveis dos outros jogadores',"Display other players’ levels",'Mostrar los niveles de otros jugadores','Afficher les niveaux des autres joueurs'],
    ['Debug Mode','Modo de depuração','Debug Mode','Modo de depuración','Mode débogage'],
    ['Modo de depuração','Modo de depuração','Debug mode','Modo de depuración','Mode débogage'],
    ['Enable console logging','Ativar registros no console','Enable console logging','Activar registros en la consola','Activer les journaux dans la console'],
    ['Mensagens','Mensagens','Messages','Mensajes','Messages'],
    ['Informações','Informações','Information','Información','Informations'],
    ['Sobre o 4utoWolves','Sobre o 4utoWolves','About 4utoWolves','Acerca de 4utoWolves','À propos de 4utoWolves'],
    ['Nome','Nome','Name','Nombre','Nom'],
    ['Versão','Versão','Version','Versión','Version'],
    ['Novidades não lidas','Novidades não lidas','Unread updates','Novedades no leídas','Nouveautés non lues'],
    ['Notificações','Notificações','Notifications','Notificaciones','Notifications'],
    ['Fechar notificações','Fechar notificações','Close notifications','Cerrar notificaciones','Fermer les notifications'],
    ['Histórico de atualizações','Histórico de atualizações','Update history','Historial de actualizaciones','Historique des mises à jour'],
    ['Atualizar','Atualizar','Refresh','Actualizar','Actualiser'],
    ['Aguardando configuração do repositório.','Aguardando configuração do repositório.','Waiting for repository configuration.','Esperando la configuración del repositorio.','En attente de la configuration du dépôt.'],
    ['Nenhuma atualização publicada.','Nenhuma atualização publicada.','No updates published.','No hay actualizaciones publicadas.','Aucune mise à jour publiée.'],
    ['Não foi possível buscar as atualizações. Exibindo o histórico salvo.','Não foi possível buscar as atualizações. Exibindo o histórico salvo.','Could not fetch updates. Showing saved history.','No se pudieron buscar las actualizaciones. Mostrando el historial guardado.','Impossible de récupérer les mises à jour. Affichage de l’historique enregistré.'],
    ['Atualizações verificadas.','Atualizações verificadas.','Updates checked.','Actualizaciones comprobadas.','Mises à jour vérifiées.'],
    ['Verificando atualizações...','Verificando atualizações...','Checking for updates...','Buscando actualizaciones...','Recherche des mises à jour...'],
    ['Saiba mais','Saiba mais','Learn more','Más información','En savoir plus'],
    ['Suporte','Suporte','Support','Soporte','Assistance'],
    ['Support','Suporte','Support','Soporte','Assistance'],
    ['Discord Server','Servidor do Discord','Discord Server','Servidor de Discord','Serveur Discord'],
    ['Join our community','Entre na nossa comunidade','Join our community','Únete a nuestra comunidad','Rejoignez notre communauté'],
    ['Navegação principal','Navegação principal','Main navigation','Navegación principal','Navigation principale'],
    ['Home','Início','Home','Inicio','Accueil'],
    ['Idioma da extensão','Idioma da extensão','Extension language','Idioma de la extensión','Langue de l’extension'],
    ['Escolha o idioma do painel.','Escolha o idioma do painel.','Choose the panel language.','Elige el idioma del panel.','Choisissez la langue du panneau.'],
    ['Auto Play ativo','Auto Play ativo','Auto Play enabled','Auto Play activado','Auto Play activé'],
    ['Auto Play desligado','Auto Play desligado','Auto Play disabled','Auto Play desactivado','Auto Play désactivé'],
    ['Abra ou recarregue o Wolvesville para conectar.','Abra ou recarregue o Wolvesville para conectar.','Open or reload Wolvesville to connect.','Abre o recarga Wolvesville para conectar.','Ouvrez ou rechargez Wolvesville pour vous connecter.'],
    ['Aguardando as configurações da partida.','Aguardando as configurações da partida.','Waiting for game settings.','Esperando los ajustes de la partida.','En attente des réglages de la partie.'],
    ['Ativado para jogos personalizados de casais.','Ativado para jogos personalizados de casais.','Enabled for custom couple games.','Activado para partidas personalizadas de parejas.','Activé pour les parties personnalisées en couples.'],
    ['Ative o Auto Play nas ações rápidas.','Ative o Auto Play nas ações rápidas.','Enable Auto Play in quick actions.','Activa Auto Play en acciones rápidas.','Activez Auto Play dans les actions rapides.'],
    ['Aguardando conexão com o jogo','Aguardando conexão com o jogo','Waiting for game connection','Esperando conexión con el juego','En attente de connexion au jeu'],
    ['Aguardando confirmação do jogo','Aguardando confirmação do jogo','Waiting for game confirmation','Esperando confirmación del juego','En attente de confirmation du jeu'],
    ['Ativar','Ativar','Enable','Activar','Activer'],
    ['Desativar','Desativar','Disable','Desactivar','Désactiver'],
    ['O jogo não confirmou a alteração. Tente novamente.','O jogo não confirmou a alteração. Tente novamente.','The game did not confirm the change. Try again.','El juego no confirmó el cambio. Inténtalo de nuevo.','Le jeu n’a pas confirmé le changement. Réessayez.'],
    ['Abra o Wolvesville para alterar esta opção.','Abra o Wolvesville para alterar esta opção.','Open Wolvesville to change this option.','Abre Wolvesville para cambiar esta opción.','Ouvrez Wolvesville pour modifier cette option.'],
    ['Recarregue o jogo para conectar a extensão.','Recarregue o jogo para conectar a extensão.','Reload the game to connect the extension.','Recarga el juego para conectar la extensión.','Rechargez le jeu pour connecter l’extension.'],
    ['Não foi possível alterar a opção.','Não foi possível alterar a opção.','Could not change this option.','No se pudo cambiar la opción.','Impossible de modifier cette option.'],
    ['Available','Disponível','Available','Disponible','Disponible'],
    ['Unavailable','Indisponível','Unavailable','No disponible','Indisponible'],
    ['Spinning Gold Wheel...','Girando a roleta de ouro...','Spinning Gold Wheel...','Girando la ruleta de oro...','La roue d’or tourne...'],
    ['Gold Wheel unavailable','Roleta de ouro indisponível','Gold Wheel unavailable','Ruleta de oro no disponible','Roue d’or indisponible'],
    ['Spinning Rose Wheel...','Girando a roleta de rosas...','Spinning Rose Wheel...','Girando la ruleta de rosas...','La roue de roses tourne...'],
    ['Not enough roses','Rosas insuficientes','Not enough roses','No hay suficientes rosas','Pas assez de roses'],
    ['Message from 4utoWolves','Mensagem do 4utoWolves','Message from 4utoWolves','Mensaje de 4utoWolves','Message de 4utoWolves'],
    ['I Understand','Entendi','I Understand','Entendido','J’ai compris'],
    ['Close','Fechar','Close','Cerrar','Fermer'],
    ['Active','Ativa','Active','Activa','Active'],
    ['NOT AUTHORIZED — BOT DEACTIVATED','NÃO AUTORIZADO — BOT DESATIVADO','NOT AUTHORIZED — BOT DEACTIVATED','NO AUTORIZADO — BOT DESACTIVADO','NON AUTORISÉ — BOT DÉSACTIVÉ'],
    ['NOT AUTHORIZED','NÃO AUTORIZADO','NOT AUTHORIZED','NO AUTORIZADO','NON AUTORISÉ'],
    ['BOT DEACTIVATED','BOT DESATIVADO','BOT DEACTIVATED','BOT DESACTIVADO','BOT DÉSACTIVÉ'],
    ['Your license is inactive. The bot is disabled until a valid license is present.','Sua licença está inativa. O bot fica desativado até que haja uma licença válida.','Your license is inactive. The bot is disabled until a valid license is present.','Tu licencia está inactiva. El bot está desactivado hasta que haya una licencia válida.','Votre licence est inactive. Le bot reste désactivé jusqu’à ce qu’une licence valide soit disponible.'],
    ['⚠️ Extension Reloaded','⚠️ Extensão recarregada','⚠️ Extension Reloaded','⚠️ Extensión recargada','⚠️ Extension rechargée'],
    ['Please reload the Wolvesville page to continue.','Recarregue a página do Wolvesville para continuar.','Please reload the Wolvesville page to continue.','Recarga la página de Wolvesville para continuar.','Rechargez la page de Wolvesville pour continuer.'],
    ['Reload Page','Recarregar página','Reload Page','Recargar página','Recharger la page'],
  ];
  const dictionary = new Map(rows.map(([source, ...values]) => [source, values]));
  let language = 'pt-BR';
  try { const saved = localStorage.getItem('4utowolves-language'); if (languages.includes(saved)) language = saved; } catch {}
  const bindings = new WeakMap();
  const attributes = new WeakMap();
  function t(source) {
    const values = dictionary.get(source);
    return values ? values[languages.indexOf(language)] : source;
  }
  function translate(source) {
    const xpRemaining = source.match(/^([\d.,]+) XP restantes para o próximo nível$/);
    if (xpRemaining) return xpRemaining[1] + ' ' + t('XP restantes para o próximo nível');
    const action = source.match(/^(Ativar|Desativar) (Auto Play|Auto Replay)$/);
    if (action) return t(action[1]) + ' ' + action[2];
    const waiting = source.match(/^(Auto Play|Auto Replay): (.+)$/);
    if (waiting) return waiting[1] + ': ' + t(waiting[2]);
    const roses = source.match(/^(\d+) 🌹 — Need 30$/);
    if (roses) return roses[1] + [' 🌹 — Precisa de 30',' 🌹 — Need 30',' 🌹 — Se necesitan 30',' 🌹 — 30 nécessaires'][languages.indexOf(language)];
    const coins = source.match(/^\+(\d+) Coins$/);
    if (coins) return '+' + coins[1] + ' ' + t('Coins');
    if (source.startsWith('Unavailable until ')) return ['Indisponível até ','Unavailable until ','No disponible hasta ','Indisponible jusqu’au '][languages.indexOf(language)] + source.slice(18);
    const reward = source.match(/^(Gold|Rose) Wheel: Won (.+)$/);
    if (reward) return t(reward[1] + ' Wheel') + ': ' + ['Ganhou ','Won ','Ganaste ','Gain : '][languages.indexOf(language)] + reward[2];
    if (source.startsWith('Active until ')) return ['Ativa até ','Active until ','Activa hasta ','Active jusqu’au '][languages.indexOf(language)] + source.slice(13);
    return t(source);
  }
  function updateValue(current, previous) {
    const source = previous && previous.rendered === current ? previous.source : current;
    const trimmed = source.trim();
    return { source, rendered: source.replace(trimmed, translate(trimmed)) };
  }
  const observer = new MutationObserver(apply);
  function apply() {
    observer.disconnect();
    document.documentElement.lang = language;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || el.closest('script, style, option, .llb-modal-content, [data-no-i18n]')) continue;
      const binding = updateValue(node.nodeValue, bindings.get(node));
      bindings.set(node, binding);
      if (node.nodeValue !== binding.rendered) node.nodeValue = binding.rendered;
    }
    for (const el of document.querySelectorAll('[title], [aria-label]')) {
      if (el.closest('[data-no-i18n]')) continue;
      const saved = attributes.get(el) || {};
      for (const attr of ['title', 'aria-label']) {
        if (!el.hasAttribute(attr)) continue;
        const binding = updateValue(el.getAttribute(attr), saved[attr]);
        saved[attr] = binding;
        if (el.getAttribute(attr) !== binding.rendered) el.setAttribute(attr, binding.rendered);
      }
      attributes.set(el, saved);
    }
    for (const el of document.querySelectorAll('[data-numeric-value]')) {
      const formatted = (el.dataset.numericPrefix || "") + Number(el.dataset.numericValue).toLocaleString(language);
      el.textContent = formatted;
      if (el.id.startsWith('home')) el.title = formatted;
    }
    const selector = document.getElementById('extensionLanguage');
    if (selector) selector.value = language;
    observer.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['title','aria-label']});
  }
  function setLanguage(value) {
    if (!languages.includes(value)) return;
    language = value;
    try { localStorage.setItem('4utowolves-language', language); } catch {}
    try { chrome.storage.local.set({'4utowolves-language':language}).catch(()=>{}); } catch {}
    apply();
    window.dispatchEvent(new Event('languagechange'));
  }
  window.popupI18n = { t, get locale() { return language; }, setLanguage };
  try { chrome.storage.local.set({'4utowolves-language':language}).catch(()=>{}); } catch {}
  document.getElementById('extensionLanguage').addEventListener('change', event => setLanguage(event.target.value));
  apply();
})();
