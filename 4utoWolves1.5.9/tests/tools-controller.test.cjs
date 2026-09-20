const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../lib/tools-controller.js');
require('../lib/gold-farm.js');
function setup(storage) {
  let clock=1000,n=0;const values=new Map(),stops=[],notices=[],resets=[];
  storage ||= {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  const tools=createToolsController({storage,now:()=>clock,id:()=>String(++n),onStop:(...args)=>stops.push(args),onNotice:notice=>notices.push(notice),onReset:f=>resets.push(f)});
  return {tools,stops,notices,resets,storage,advance(ms){clock+=ms;tools.tick();}};
}
test('goals stop only the matching farm and notify once',()=>{
  const x=setup(),settings=x.tools.snapshot().settings;settings.xp.goal=100;x.tools.configure(settings);
  x.tools.setActive('xp',true);x.tools.setActive('gold',true);x.tools.record('xp',100);x.tools.tick();x.tools.tick();
  assert.deepEqual(x.stops,[['xp','goal']]);assert.equal(x.notices.length,1);
  assert.equal(x.tools.snapshot().sessions.gold.active,true);assert.equal(x.tools.allow('xp'),false);
});
test('goals can track and notify without stopping',()=>{
  const x=setup(),settings=x.tools.snapshot().settings;settings.gold.goal=10;settings.gold.stopGoal=false;x.tools.configure(settings);
  x.tools.setActive('gold',true);x.tools.record('gold',15,1);
  assert.equal(x.stops.length,0);assert.equal(x.tools.snapshot().sessions.gold.progress,1);assert.equal(x.tools.snapshot().sessions.gold.remaining,0);
});
test('elapsed time counts active periods and ignores popup or pause duration',()=>{
  const x=setup();
  x.tools.setActive('xp',true);x.advance(20000);x.tools.setActive('xp',false);x.advance(120000);
  assert.equal(x.tools.snapshot().sessions.xp.elapsedMs,20000);
});
test('match events and base/double XP do not double count',()=>{
  const x=setup();x.tools.gameFinished('game-1');x.tools.xpAward('game-1',50);x.tools.xpAward('game-1',50);x.tools.xpAward('game-1',100);x.tools.gameFinished('game-1');
  assert.equal(x.tools.snapshot().sessions.xp.count,1);assert.equal(x.tools.snapshot().sessions.xp.earned,100);
});
test('rates and estimates have no invented result before earnings',()=>{
  const x=setup(),settings=x.tools.snapshot().settings;settings.gold.goal=200;x.tools.configure(settings);
  assert.equal(x.tools.snapshot().sessions.gold.rate,null);assert.equal(x.tools.snapshot().sessions.gold.etaMs,null);
  x.tools.setActive('gold',true);x.advance(60000);x.tools.record('gold',100,2);
  assert.equal(x.tools.snapshot().sessions.gold.rate,6000);assert.equal(x.tools.snapshot().sessions.gold.etaMs,60000);
});
test('profiles and history survive a new engine while activity starts disabled',()=>{
  const x=setup();const settings=x.tools.snapshot().settings;settings.gold.goal=3;x.tools.configure(settings);x.tools.saveProfile('Gold goal');
  x.tools.setActive('gold',true);x.advance(3000);x.tools.record('gold',15,1);x.tools.close();
  const y=setup(x.storage);assert.equal(y.tools.snapshot().settings.gold.goal,3);assert.equal(y.tools.snapshot().profiles[0].name,'Gold goal');assert.equal(y.tools.snapshot().history.length,1);assert.equal(y.tools.snapshot().sessions.gold.active,false);
});
test('reset affects only its session and preserves history and account-independent totals',()=>{
  const x=setup();x.tools.record('xp',10,1);x.tools.record('gold',25,2);x.tools.reset('xp');
  assert.equal(x.tools.snapshot().sessions.xp.earned,0);assert.equal(x.tools.snapshot().sessions.gold.earned,25);assert.ok(x.tools.snapshot().history.some(s=>s.farm==='xp'&&s.earned===10));assert.deepEqual(x.resets,['xp']);
});
test('reset preserves duplicate award protection',()=>{
  const x=setup();x.tools.xpAward('game-1',20);x.tools.reset('xp');x.tools.xpAward('game-1',20);assert.equal(x.tools.snapshot().sessions.xp.count,0);assert.equal(x.tools.snapshot().sessions.xp.earned,0);
});
test('invalid input is rejected without changing saved limits',()=>{
  const x=setup();for(const n of [-1,Infinity,1.5,1000000001]){const s=x.tools.snapshot().settings;s.xp.goal=n;assert.throws(()=>x.tools.configure(s));assert.equal(x.tools.snapshot().settings.xp.goal,0);}
});
test('applying profiles enforces newly reached limits; restoring keeps profiles/history',()=>{
  const x=setup(),s=x.tools.snapshot().settings;s.gold.goal=10;x.tools.configure(s);x.tools.saveProfile('Goal');x.tools.restore();x.tools.setActive('gold',true);x.tools.record('gold',15,1);x.tools.applyProfile(x.tools.snapshot().profiles[0].id);
  assert.equal(x.stops[0][0],'gold');x.tools.restore();assert.equal(x.tools.snapshot().profiles.length,1);assert.ok(x.tools.snapshot().history.length);assert.equal(x.tools.snapshot().settings.gold.goal,0);
});
test('disabled notification preferences prevent emitted notices',()=>{
  const x=setup(),s=x.tools.snapshot().settings;s.xp.goal=1;s.notifications={goal:false,error:false,disconnect:false};x.tools.configure(s);x.tools.record('xp',2);x.tools.notice('error','gold');x.tools.notice('disconnect','xp');assert.equal(x.notices.length,0);
});
test('write failures are visible and do not discard in-memory counters',()=>{
  const x=setup({getItem:()=>null,setItem(){throw Error('quota')}});x.tools.record('gold',10,1);assert.equal(x.tools.snapshot().persistenceError,true);assert.equal(x.tools.snapshot().sessions.gold.earned,10);
});
test('gold goal stops automatic gold farming immediately after the confirmed reward',async()=>{
  let farm;const data=new Map(),requests=[],notices=[];
  const tools=createToolsController({storage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},id:()=>Math.random().toString(),onStop:f=>{if(f==='gold')farm.stop()},onNotice:n=>notices.push(n)});
  const settings=tools.snapshot().settings;settings.gold.goal=5;tools.configure(settings);
  farm=createGoldFarm({request:async(path,method)=>{requests.push(method);return method==='GET'?{nextRewardAvailableTime:null}:[{winner:true,silver:5}]},secret:()=>'',canSpin:()=>tools.allow('gold'),onReward:r=>tools.record('gold',r.silver,1),onChange:s=>tools.setActive('gold',s.active||(s.busy&&s.status!=='stopped'&&s.status!=='error'))});
  farm.start();await new Promise(r=>setImmediate(r));assert.equal(farm.snapshot().active,false);assert.deepEqual(requests,['GET','POST']);assert.equal(tools.snapshot().sessions.gold.count,1);
  farm.start();await new Promise(r=>setImmediate(r));assert.deepEqual(requests,['GET','POST']);assert.equal(farm.snapshot().active,false);
});
