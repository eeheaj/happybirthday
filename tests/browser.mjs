import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createAPI } from '../server/api.mjs';
import { MemoryStore } from './memory-store.mjs';

const stores={notes:new MemoryStore(),images:new MemoryStore()};
const api=createAPI(()=>stores);
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript'};
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://'+req.headers.host);
    if(url.pathname.startsWith('/api/')){
      const chunks=[]; for await(const chunk of req) chunks.push(chunk);
      const response=await api(new Request(url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})}));
      res.writeHead(response.status,Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    const pathname=['/','/write','/write/'].includes(url.pathname)?'/index.html':url.pathname;
    const file=resolve('public','.'+pathname);
    if(!file.startsWith(resolve('public')+'/') && !file.startsWith(resolve('public')+'\\')){res.writeHead(403).end();return;}
    const bytes=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'}).end(bytes);
  }catch{res.writeHead(404).end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const options={headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']};
if(process.env.BROWSER_EXECUTABLE) options.executablePath=process.env.BROWSER_EXECUTABLE;
else if(!existsSync(chromium.executablePath())){
  const fallback=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
  if(fallback) options.executablePath=fallback;
}
let browser;
try{
  browser=await chromium.launch(options);
  console.log('Browser launched.');
  const errors=[];
  const watch=page=>{page.setDefaultTimeout(20000);page.on('pageerror',error=>{errors.push(error.message);console.error('Page error:',error.message);});page.on('console',message=>{if(message.type()==='error' && message.text().includes('THREE'))errors.push(message.text());});};
  const momContext=await browser.newContext({viewport:{width:1440,height:1000}});
  const mom=await momContext.newPage(); watch(mom);
  await mom.goto(base);
  await mom.waitForFunction(()=>typeof glOK!=='undefined' && glOK && dbState==='ready');
  await mkdir('test-results',{recursive:true});
  await mom.screenshot({path:'test-results/cake-desktop.png'});
  console.log('Desktop cake rendered.');
  assert.equal(await mom.locator('#doodle').isVisible(),false);
  await mom.goto('about:blank');

  const writerContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const writer=await writerContext.newPage();watch(writer);
  await writer.goto(base+'/write/');
  await writer.waitForFunction(()=>connected);
  console.log('Contributor connected.');
  await writer.locator('#fromInput').fill('Aunt Grace');
  await writer.locator('#msgInput').fill('Happy birthday, Mom! Sending so much love.');
  await writer.locator('#sendBtn').click();
  await writer.waitForFunction(()=>document.querySelectorAll('.bubble').length===1);
  await writer.reload();
  await writer.waitForFunction(()=>document.querySelectorAll('.bubble').length===1);
  assert.equal(await writer.locator('#msgInput').inputValue(),'');
  console.log('Text sent and persisted across reload.');

  // Produce an opaque photo locally to exercise the actual image processor and upload.
  const photo=await writer.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=240;const g=c.getContext('2d');g.fillStyle='#E2456B';g.fillRect(0,0,320,240);g.fillStyle='#fff';g.font='32px serif';g.fillText('Love you, Mom!',40,125);return c.toDataURL('image/png');});
  await writer.locator('#fileInput').setInputFiles({name:'birthday.png',mimeType:'image/png',buffer:Buffer.from(photo.split(',')[1],'base64')});
  await writer.waitForFunction(()=>att && !preparing);
  await writer.locator('#msgInput').fill('A little birthday postcard.');
  await writer.locator('#sendBtn').click();
  await writer.waitForFunction(()=>document.querySelectorAll('.bubble').length===2);
  await writer.locator('#doodleBtn').click();
  const pad=writer.locator('#pad'), box=await pad.boundingBox();
  await writer.mouse.move(box.x+40,box.y+40);await writer.mouse.down();
  await writer.mouse.move(box.x+160,box.y+180,{steps:12});await writer.mouse.up();
  await writer.locator('#padDone').click();
  await writer.waitForFunction(()=>att && att.kind==='sticker');
  await writer.locator('#sendBtn').click();
  await writer.waitForFunction(()=>document.querySelectorAll('.bubble').length===3);
  console.log('Photo and doodle sent.');
  await writer.screenshot({path:'test-results/contributor-mobile.png',fullPage:true});
  assert.equal(await writer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);

  await mom.bringToFront();
  await mom.goto(base);
  await mom.waitForFunction(()=>glOK && dbState==='ready');
  await mom.locator('#blowBtn').focus();await mom.keyboard.down('Space');
  await mom.waitForFunction(()=>!lit);await mom.keyboard.up('Space');
  await mom.waitForFunction(()=>document.querySelector('#board').classList.contains('open'));
  await mom.waitForFunction(()=>document.querySelectorAll('.tile').length===3,{},{timeout:15000});
  await mom.screenshot({path:'test-results/scrapbook-desktop.png'});
  await mom.locator('.tile.photo').click();
  await mom.waitForFunction(()=>document.querySelector('#viewer').classList.contains('open'));
  assert.equal(await mom.locator('#vMsg').textContent(),'A little birthday postcard.');
  await mom.waitForFunction(()=>document.querySelector('#vImg').complete && document.querySelector('#vImg').naturalWidth>0);
  await mom.keyboard.press('Escape');
  const before=await mom.locator('#world').getAttribute('style');
  await mom.mouse.move(100,500);await mom.mouse.down();await mom.mouse.move(500,600,{steps:10});await mom.mouse.up();
  const after=await mom.locator('#world').getAttribute('style');assert.notEqual(before,after);
  console.log('Shared scrapbook, image viewer and drag verified.');
  await mom.goto('about:blank');

  const another=await browser.newContext();const anotherPage=await another.newPage();watch(anotherPage);
  await anotherPage.goto(base+'/write');await anotherPage.waitForFunction(()=>connected);
  assert.equal(await anotherPage.locator('.bubble').count(),0);
  const mobileMom=await writerContext.newPage();watch(mobileMom);await mobileMom.goto(base);
  await mobileMom.waitForFunction(()=>glOK && dbState==='ready');
  await mobileMom.screenshot({path:'test-results/cake-mobile.png'});
  await mobileMom.locator('#home').dispatchEvent('pointerdown',{clientX:195,clientY:440,pointerId:1,pointerType:'touch'});
  await mobileMom.waitForFunction(()=>!lit);
  await mobileMom.locator('#home').dispatchEvent('pointerup',{pointerId:1,pointerType:'touch'});
  await mobileMom.waitForFunction(()=>document.querySelector('#board').classList.contains('open'));
  await mobileMom.screenshot({path:'test-results/scrapbook-mobile.png'});
  await mobileMom.goto('about:blank');
  console.log('Mobile cake and scrapbook verified.');

  const fallback=await browser.newContext();const noGL=await fallback.newPage();watch(noGL);
  await noGL.route('**/vendor/three.min.js',route=>route.abort());
  await noGL.goto(base); await noGL.waitForFunction(()=>typeof glOK!=='undefined' && !glOK);
  await noGL.locator('#blowBtn').focus();await noGL.keyboard.down('Space');await noGL.waitForFunction(()=>!lit);await noGL.keyboard.up('Space');
  await noGL.waitForFunction(()=>document.querySelector('#board').classList.contains('open'));
  assert.deepEqual(errors,[]);
  console.log('Browser checks passed: cake/WebGL, keyboard/touch blowing, automatic scrapbook, shared notes, independent sessions, reload persistence, photo/doodle uploads, image display, drag, mobile layout, and no-WebGL fallback.');
}finally{server.closeAllConnections();await browser?.close();await new Promise(resolve=>server.close(resolve));}
