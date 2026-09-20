import './tools-text.js';

const signatures = new Map();
const recent = new Map();
export async function handleToolsUpdate(data, tabId) {
  if (!Number.isInteger(tabId) || !data) return;
  if (data.type === 'UPDATE_UI' && data.tools) {
    const snapshot = {notifications:data.tools.settings?.notifications,
      xp:!!data.tools.sessions?.xp?.active, gold:!!data.tools.sessions?.gold?.active};
    const signature=JSON.stringify(snapshot);
    if (signatures.get(tabId)!==signature) {
      signatures.set(tabId,signature);
      await chrome.storage.session.set({['tools-tab-'+tabId]:snapshot});
    }
  }
  if (data.type === 'TOOLS_NOTICE') await notify(data.notice,tabId);
}
async function notify(notice,tabId) {
  if (!notice || !['goal','error','disconnect'].includes(notice.kind) || !['xp','gold'].includes(notice.farm)) return;
  const key=`tools-${tabId}-${notice.farm}-${notice.kind}-${notice.reason||''}`;
  if (Date.now()-(recent.get(key)||0)<10000) return;
  recent.set(key,Date.now());
  if (recent.size>100) recent.delete(recent.keys().next().value);
  const saved=await chrome.storage.local.get('4utowolves-language');
  const language=saved['4utowolves-language']||'pt-BR';
  const t=source=>globalThis.toolsText(source,language);
  const message=notice.kind==='goal'?{goal:'Meta atingida',count:'Limite de partidas ou giros atingido',time:'Limite de tempo atingido'}[notice.reason]||'Meta atingida':
    notice.kind==='error'?'A farm encontrou um erro. Abra a extensão para conferir.':'A conexão com o jogo foi encerrada.';
  await chrome.notifications.create(key,{type:'basic',iconUrl:'icons/icon128.png',title:'4utoWolves · '+t(notice.farm==='xp'?'Farm de XP':'Farm de Ouro'),message:t(message)});
}
chrome.tabs.onRemoved.addListener(tabId=>{
  const key='tools-tab-'+tabId;
  chrome.storage.session.get(key).then(async result=>{
    const state=result[key];
    if(state?.notifications?.disconnect)for(const farm of ['xp','gold'])if(state[farm])await notify({kind:'disconnect',farm},tabId);
    await chrome.storage.session.remove(key);signatures.delete(tabId);
  }).catch(()=>{});
});
