import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createAPI } from '../server/api.mjs';
import { MemoryStore } from './memory-store.mjs';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6p1sAAAAASUVORK5CYII=';
function setup(){
  const stores={notes:new MemoryStore(),images:new MemoryStore()}, api=createAPI(()=>stores);
  const request=(path,options={})=>api(new Request('https://birthday.example'+path,options));
  const connect=async()=> (await request('/api/session')).headers.get('set-cookie').split(';')[0];
  const send=(cookie,values={},headers={})=>request('/api/notes',{method:'POST',headers:{cookie,origin:'https://birthday.example','content-type':'application/json',...headers},body:JSON.stringify({id:randomUUID(),from:'Jane',text:'Happy birthday!',...values})});
  return {stores,request,connect,send};
}
test('sessions are secure; separate browsers share wishes but see their own thread',async()=>{
  const {request,connect,send}=setup();
  const response=await request('/api/session');
  assert.match(response.headers.get('set-cookie'),/HttpOnly.*SameSite=Lax.*Secure/);
  const first=await connect(),second=await connect();
  assert.notEqual(first,second);
  assert.equal((await send(first)).status,201);
  assert.equal((await send(second,{from:'Aunt Grace'})).status,201);
  assert.equal((await (await request('/api/notes')).json()).notes.length,2);
  const mine=await (await request('/api/notes?mine=1',{headers:{cookie:first}})).json();
  assert.equal(mine.notes.length,1); assert.equal(mine.notes[0].from,'Jane');
  assert.equal((await request('/api/notes?mine=1')).status,401);
});
test('parallel sends are independent and retries cannot duplicate or overwrite a note',async()=>{
  const {request,connect,send}=setup(),cookie=await connect(), id=randomUUID();
  const replies=await Promise.all([send(cookie,{id}),send(cookie,{id}),send(cookie),send(cookie)]);
  assert.ok(replies.every(r=>r.ok));
  await send(cookie,{id,text:'Changed text'});
  const {notes}=await (await request('/api/notes')).json();
  assert.equal(notes.length,3); assert.ok(notes.every(n=>n.text==='Happy birthday!'));
});
test('image-only notes survive upload and are served as the original image',async()=>{
  const {request,connect,send}=setup(),cookie=await connect();
  const response=await send(cookie,{text:'',image:{kind:'sticker',data:png}});
  assert.equal(response.status,201);
  const {note}=await response.json();
  const image=await request('/api/images/'+note.img.id);
  assert.equal(image.status,200); assert.equal(image.headers.get('content-type'),'image/png');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()),Buffer.from(png.split(',')[1],'base64'));
  assert.equal((await request('/api/images/'+'0'.repeat(64))).status,404);
});
test('rejects invalid, oversized, empty and cross-origin submissions',async()=>{
  const {connect,send}=setup(),cookie=await connect();
  for(const values of [{from:''},{from:'a'.repeat(61)},{text:'x'.repeat(1501)},{text:' '},{id:'bad'}, {image:{kind:'photo',data:'data:image/png;base64,aGVsbG8='}}, {image:{kind:'photo',data:'data:image/svg+xml;base64,PHN2Zz4='}}]) {
    assert.equal((await send(cookie,values)).status,400);
  }
  assert.equal((await send(cookie,{}, {origin:'https://other.example'})).status,403);
  assert.equal((await send('')).status,401);
  assert.equal((await send(cookie,{text:'x'.repeat(2_900_000)})).status,413);
});
test('storage failures return a retryable error, not a false success',async()=>{
  const api=createAPI(()=>{throw new Error('test outage');});
  const response=await api(new Request('https://birthday.example/api/notes'));
  assert.equal(response.status,503);
  assert.match((await response.json()).error,/temporarily unavailable/);
});
