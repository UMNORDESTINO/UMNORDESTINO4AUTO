const {test} = require('node:test');
const assert = require('node:assert/strict');
require('../lib/gold-farm.js');
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup(responses) {
  let time = 100000;
  const calls = [], rewards = [], timers = new Map();
  let id = 0;
  const farm = globalThis.createGoldFarm({
    request: async (path, method) => {
      calls.push({path,method});
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return typeof next === 'function' ? next() : next;
    },
    secret: () => 'test-secret', onReward: reward => rewards.push(reward), onChange() {},
    now: () => time, schedule(fn, ms) {timers.set(++id,{fn,at:time+ms});return id}, cancel(id){timers.delete(id)},
  });
  return {farm,calls,rewards,timers,async advance(ms){time+=ms;for(const [id,t] of [...timers])if(t.at<=time){timers.delete(id);t.fn();}await flush();}};
}
const available = {nextRewardAvailableTime:null,items:[]};
const prize = [{winner:true,silver:25}];
test('starts stopped and a single spin never schedules another or uses the paid endpoint', async()=>{
  const x=setup([available,prize]);assert.equal(x.calls.length,0);assert.equal(x.farm.snapshot().active,false);
  x.farm.spinOnce();x.farm.spinOnce();await flush();
  assert.deepEqual(x.calls.map(c=>c.method),['GET','POST']);
  assert.equal(x.calls[1].path,'/rewards/wheelRewardWithSecret/test-secret');
  assert.equal(x.rewards.length,1);assert.equal(x.timers.size,0);assert.equal(x.farm.snapshot().status,'stopped');
});
test('waits for server deadline and rechecks before posting',async()=>{
  const x=setup([{nextRewardAvailableTime:110000},available,prize]);x.farm.start();await flush();
  assert.equal(x.farm.snapshot().status,'waiting');await x.advance(9999);assert.equal(x.calls.length,1);
  await x.advance(1);assert.deepEqual(x.calls.map(c=>c.method),['GET','GET','POST']);assert.equal(x.rewards.length,1);
  x.farm.stop();await x.advance(60000);assert.equal(x.calls.length,3);
});
test('stop during availability lookup prevents the spin',async()=>{
  let resolve;const x=setup([()=>new Promise(r=>resolve=r)]);x.farm.start();x.farm.stop();resolve(available);await flush();
  assert.equal(x.calls.length,1);assert.equal(x.farm.snapshot().status,'stopped');assert.equal(x.timers.size,0);
});
test('stop during submitted spin counts eventual reward but never restarts',async()=>{
  let resolve;const x=setup([available,()=>new Promise(r=>resolve=r)]);x.farm.start();await flush();
  x.farm.stop();x.farm.start();resolve(prize);await flush();
  assert.equal(x.rewards.length,1);assert.equal(x.farm.snapshot().active,false);assert.equal(x.timers.size,0);
});
for (const error of ['timeout','network','limit','auth']) test(`${error} stops without retry`,async()=>{
  const x=setup([available,new Error(error)]);x.farm.start();await flush();await x.advance(60000);
  assert.equal(x.calls.length,2);assert.equal(x.farm.snapshot().error,error);assert.equal(x.farm.snapshot().active,false);
  assert.equal(x.rewards.length,0);assert.equal(x.timers.size,0);
});
test('unknown availability fails closed instead of treating missing fields as permission',async()=>{
  const x=setup([{}]);x.farm.start();await flush();assert.equal(x.calls.length,1);assert.equal(x.farm.snapshot().error,'invalid_response');
});
test('rejected rewards and malformed rewards never increment totals',async()=>{
  for(const result of [{code:'limit'},[],[{winner:true,silver:-1}],[{winner:true,silver:3},{winner:true,silver:4}]]){
    const x=setup([available,result]);x.farm.start();await flush();assert.equal(x.rewards.length,0);assert.equal(x.farm.snapshot().active,false);
  }
});
test('each automatic spin checks availability again and stops at the next server deadline',async()=>{
  const x=setup([available,prize,{nextRewardAvailableTime:200000}]);x.farm.start();await flush();await x.advance(5000);
  assert.deepEqual(x.calls.map(c=>c.method),['GET','POST','GET']);assert.equal(x.farm.snapshot().nextAt,200000);
});
