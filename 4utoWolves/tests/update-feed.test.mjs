import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchUpdateFeed, updateState, validateUpdateFeed} from '../lib/update-feed.mjs';

const valid={updates:[{
  id:'1.5.0',version:'1.5.0',date:'2026-09-13',
  title:{'pt-BR':'Nova versão',en:'New version',es:'Nueva versión',fr:'Nouvelle version'},
  description:{'pt-BR':'Descrição',en:'Description',es:'Descripción',fr:'Description'},
  url:'https://github.com/example/project/releases/tag/1.5.0',
}]};

test('validates and normalizes a multilingual feed',()=>{
  const feed=validateUpdateFeed(valid);assert.equal(feed.updates[0].id,'1.5.0');assert.equal(feed.updates[0].title.fr,'Nouvelle version');
});

test('rejects duplicate ids, missing languages, HTML-sized payloads and unsafe links',async()=>{
  assert.throws(()=>validateUpdateFeed({updates:[valid.updates[0],valid.updates[0]]}),/invalid_feed/);
  assert.throws(()=>validateUpdateFeed({updates:[{...valid.updates[0],title:{'pt-BR':'x'}}]}),/invalid_feed/);
  assert.throws(()=>validateUpdateFeed({updates:[{...valid.updates[0],url:'javascript:alert(1)'}]}),/invalid_feed/);
  await assert.rejects(()=>fetchUpdateFeed({url:'https://example.test/feed',fetchFn:async()=>({ok:true,status:200,headers:new Headers(),text:async()=>'{"updates":[]}'+(' '.repeat(300000))})}),/feed_too_large/);
});

test('uses etag and cached data on a 304 response',async()=>{
  let headers;const cached={feed:valid,etag:'"abc"'};
  const result=await fetchUpdateFeed({url:'https://example.test/feed',cached,fetchFn:async(url,options)=>{headers=options.headers;return {ok:false,status:304,headers:new Headers(),text:async()=>''};}});
  assert.equal(headers['If-None-Match'],'"abc"');assert.equal(result.feed,valid);assert.equal(result.updated,false);
});

test('does no network request before the repository URL is configured',async()=>{
  let called=false;const result=await fetchUpdateFeed({url:'',fetchFn:async()=>{called=true;}});assert.equal(called,false);assert.equal(result.configured,false);
});

test('calculates unread updates from stable ids',()=>{
  const state=updateState(validateUpdateFeed(valid),[]);assert.deepEqual(state.unreadIds,['1.5.0']);assert.deepEqual(updateState(state,['1.5.0']).unreadIds,[]);
});
