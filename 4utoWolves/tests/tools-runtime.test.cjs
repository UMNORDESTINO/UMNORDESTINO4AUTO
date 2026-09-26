const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),{randomUUID}=require('node:crypto');
function runtime(){
  const data=new Map(),messages=[],listeners=[];
  const context=vm.createContext({console:{log(){},error(){}},crypto:{randomUUID},Date,Map,Set,Promise,AbortController,
    localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},
    setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){},
    window:{fetch:async()=>({ok:true,status:200,json:async()=>({})}),addEventListener(type,fn){if(type==='message')listeners.push(fn)},postMessage:m=>messages.push(m)}});
  for(const file of ['lib/tools-controller.js','lib/gold-farm.js','lib/bot-logic.js']){
    let code=fs.readFileSync(file,'utf8');if(file.endsWith('bot-logic.js'))code=code.slice(0,code.lastIndexOf('// Inject styles'));
    vm.runInContext(code,context,{filename:file});
  }
  return {context,messages,run:code=>vm.runInContext(code,context),send:data=>listeners.forEach(fn=>fn({source:context.window,data}))};
}
test('XP tools limits stop both toggles and block queued gameplay emits',()=>{
  const x=runtime();
  x.run(`const settings=TOOLS.snapshot().settings;settings.xp.goal=50;TOOLS.configure(settings);LV_SETTINGS.AUTO_PLAY=true;LV_SETTINGS.AUTO_REPLAY=true;TOOLS.setActive('xp',true);
    let sent=0;const socket={emit(){sent++}};guardXpSocket(socket);socket.emit('game-day-vote-set',{});recordXpAward('game-1',50);socket.emit('game-day-vote-set',{});`);
  assert.equal(x.run('sent'),1);assert.equal(x.run('LV_SETTINGS.AUTO_PLAY'),false);assert.equal(x.run('LV_SETTINGS.AUTO_REPLAY'),false);assert.equal(x.run('TOTAL_XP_SESSION'),50);
});
test('tools commands acknowledge settings and reset without changing inventory',()=>{
  const x=runtime();x.run('INVENTORY={silverCount:500,roseCount:100};recordGoldReward({silver:25});');
  x.send({type:'TOOLS_COMMAND',action:'reset',farm:'gold',commandId:'reset-1'});
  const reply=x.messages.filter(m=>m.type==='UPDATE_UI').at(-1);
  assert.equal(reply.toolsReply.id,'reset-1');assert.equal(reply.toolsReply.ok,true);assert.equal(reply.goldSessionEarned,0);assert.equal(reply.coins,525);
  assert.ok(reply.tools.history.some(s=>s.farm==='gold'&&s.earned===25));
});
test('saving a reached XP goal switches off existing automation',()=>{
  const x=runtime();x.run(`LV_SETTINGS.AUTO_PLAY=true;TOOLS.setActive('xp',true);recordXpAward('game-1',100);`);
  const settings=x.run('TOOLS.snapshot().settings');settings.xp.goal=50;
  x.send({type:'TOOLS_COMMAND',action:'save',settings,commandId:'save-1'});
  assert.equal(x.run('LV_SETTINGS.AUTO_PLAY'),false);assert.equal(x.run('TOOLS.snapshot().sessions.xp.reason'),'goal');
});
test('browser notices use the selected language and track active tabs without a popup',async()=>{
  const notices=[],session={};let onRemoved;
  const context=vm.createContext({console,Date,Map,globalThis:null,chrome:{
    storage:{local:{get:async()=>({'4utowolves-language':'en'})},session:{set:async data=>Object.assign(session,data),get:async key=>({[key]:session[key]}),remove:async key=>delete session[key]}},
    notifications:{create:async(id,data)=>notices.push({id,...data})},tabs:{onRemoved:{addListener:fn=>onRemoved=fn}},
  }});context.globalThis=context;
  vm.runInContext(fs.readFileSync('lib/tools-text.js','utf8'),context);
  vm.runInContext(fs.readFileSync('lib/tools-notifications.js','utf8').replace("import './tools-text.js';",'').replace('export async function','async function'),context);
  await vm.runInContext(`handleToolsUpdate({type:'TOOLS_NOTICE',notice:{kind:'goal',farm:'xp',reason:'goal'}},7)`,context);
  assert.equal(notices[0].message,'Goal reached');
  await vm.runInContext(`handleToolsUpdate({type:'UPDATE_UI',tools:{settings:{notifications:{disconnect:true}},sessions:{xp:{active:true},gold:{active:false}}}},7)`,context);
  onRemoved(7);await new Promise(r=>setImmediate(r));assert.equal(notices.length,2);assert.equal(notices[1].message,'The game connection was closed.');
});
