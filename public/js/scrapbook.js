/* scrapbook.js
 * The ivory scrapbook board (drag to explore) and the single-note viewer.
 * Loaded as a classic script: top-level const/let/functions are shared with the other files in js/. */
"use strict";

/* ---------- scrapbook board ---------- */
const world=document.getElementById('world'), boardEmpty=document.getElementById('boardEmpty'), boardTitle=document.getElementById('boardTitle'),
  openBtn=document.getElementById('openLetters');
let allNotes=null, dbState='loading';
const fmtTime = ms => { try{ return new Date(ms).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); }catch(e){ return ''; } };
const blobUrl = id => '/api/images/' + encodeURIComponent(id);
function seeded(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } if(!h) h=1;
  return ()=>{ h^=h<<13; h>>>=0; h^=h>>>17; h^=h<<5; h>>>=0; return (h%100000)/100000; }; }
const tiles=new Map();
let S=160, bounds={x0:0,x1:0,y0:0,y1:0}, pan={x:0,y:0}, vel={x:0,y:0}, drag=null, suppressClick=false, hinted=false;

function tileSize(){ return Math.round(Math.max(116, Math.min(176, Math.min(window.innerWidth,window.innerHeight)*.3))); }
function makeTile(n){
  const el=document.createElement('button'); el.type='button'; el._note=n;
  el.setAttribute('aria-label', `Note from ${n.from||'someone'}`);
  if(n.img){
    el.className='tile '+(n.img.kind==='photo'?'photo':'sticker');
    const im=document.createElement('img'); im.alt=''; im.decoding='async'; im.src=blobUrl(n.img.id); im.draggable=false;
    im.onerror=()=>{ el.className='tile note'; el.textContent=''; fillNoteTile(el,n); addTag(el,n,true); };
    el.appendChild(im); addTag(el,n);
  } else { el.className='tile note'; fillNoteTile(el,n); }
  el.addEventListener('click', e=>{ if(suppressClick) return; openNote(n); });
  el.addEventListener('focus', ()=>{ if(!drag) centerOn(el); });
  return el;
}
function fillNoteTile(el,n){ const b=document.createElement('b'); b.textContent=n.from||'Someone'; const sp=document.createElement('span'); sp.textContent=n.text||''; el.append(b,sp); }
function addTag(el,n,skip){ if(skip) return; const t=document.createElement('span'); t.className='tag'; t.textContent=n.from||'Someone'; el.appendChild(t); }

function renderLetters(){
  const notes=allNotes||[];
  openBtn.textContent = (dbState==='ready' && notes.length) ? `Read your messages (${notes.length})` : 'Read your messages';
  if(!notes.length){
    tiles.forEach(el=>el.remove()); tiles.clear(); bounds=titleBounds();
    boardEmpty.hidden = false;
    boardEmpty.textContent = dbState === 'loading' ? 'Gathering your birthday wishes…' : dbState === 'off' ? 'We couldn’t load the wishes. We’ll try again in a moment.' : 'A little space for a lot of love. Your birthday wishes will appear here.';
    clampPan(true); applyPan(); return;
  }
  boardEmpty.hidden = dbState !== 'off';
  if(dbState === 'off') boardEmpty.textContent = 'Reconnecting… Your saved wishes are still here.';
  layout(notes);
}
function titleBounds(){ const w=boardTitle.offsetWidth||300, h=boardTitle.offsetHeight||120; return {x0:-w/2,x1:w/2,y0:-h/2,y1:h/2,w,h}; }
/* Organic placement: each note searches outward from the title in rings stretched to the screen's shape,
   starting at its own seeded angle, and takes the first spot that doesn't crowd a neighbour. */
function layout(notes){
  S=tileSize(); world.style.setProperty('--s',S+'px');
  const vw=window.innerWidth, vh=window.innerHeight, asp=Math.min(2.2,Math.max(.5,vw/vh)), sx=Math.sqrt(asp), sy=1/Math.sqrt(asp);
  const tb=titleBounds(), padX=tb.w/2+S*.7, padY=tb.h/2+S*.7, minD=S*1.15, placed=[];
  const seen=new Set(); bounds={x0:tb.x0,x1:tb.x1,y0:tb.y0,y1:tb.y1};
  notes.forEach((n,i)=>{
    seen.add(n.key);
    let el=tiles.get(n.key); if(!el){ el=makeTile(n); tiles.set(n.key,el); world.appendChild(el); }
    const rnd=seeded(n.key), base=rnd()*Math.PI*2;
    let pos=null;
    for(let r=S*.6; !pos && r<S*60; r+=S*.18){
      const steps=Math.max(10,Math.ceil(2*Math.PI*r/(S*.22)));
      for(let k=0;k<steps;k++){
        const ang=base+(k%2?1:-1)*Math.ceil(k/2)*(2*Math.PI/steps);
        const x=Math.cos(ang)*r*sx+(rnd()-.5)*S*.12, y=Math.sin(ang)*r*sy+(rnd()-.5)*S*.12;
        if(Math.abs(x)<padX && Math.abs(y)<padY) continue;
        let ok=true; for(const q of placed){ if(Math.hypot(q.x-x,q.y-y)<minD){ ok=false; break; } }
        if(ok){ pos={x,y}; break; }
      }
    }
    pos=pos||{x:0,y:padY+S}; placed.push(pos);
    const r=(rnd()-.5)*22;
    el.style.setProperty('--x',pos.x.toFixed(1)+'px'); el.style.setProperty('--y',pos.y.toFixed(1)+'px'); el.style.setProperty('--r',r.toFixed(1)+'deg');
    el.style.setProperty('--d',Math.min(i*45,1400)+'ms'); el.style.zIndex=String(10+Math.floor(rnd()*300));
    el._x=pos.x; el._y=pos.y;
    bounds.x0=Math.min(bounds.x0,pos.x); bounds.x1=Math.max(bounds.x1,pos.x); bounds.y0=Math.min(bounds.y0,pos.y); bounds.y1=Math.max(bounds.y1,pos.y);
  });
  tiles.forEach((el,k)=>{ if(!seen.has(k)){ el.remove(); tiles.delete(k); } });
  clampPan(true); applyPan();
}
function range(){
  const vw=window.innerWidth, vh=window.innerHeight, m=S*.9;
  return { xmin:Math.min(0, -(bounds.x1 - vw/2 + m)), xmax:Math.max(0, -(bounds.x0 + vw/2 - m)),
           ymin:Math.min(0, -(bounds.y1 - vh/2 + m)), ymax:Math.max(0, -(bounds.y0 + vh/2 - m)) };
}
function clampPan(hard){ const R=range(); if(hard){ pan.x=Math.min(R.xmax,Math.max(R.xmin,pan.x)); pan.y=Math.min(R.ymax,Math.max(R.ymin,pan.y)); } return R; }
function applyPan(){ world.style.transform=`translate(${pan.x.toFixed(1)}px,${pan.y.toFixed(1)}px)`; }
function centerOn(el){ world.style.transition='transform .45s cubic-bezier(.2,.8,.2,1)'; pan.x=-el._x; pan.y=-el._y; clampPan(true); vel.x=vel.y=0; applyPan(); setTimeout(()=>world.style.transition='',460); }
function hideHint(){ hinted=true; document.getElementById('boardHint').hidden=true; }

board.addEventListener('pointerdown', e=>{
  if(e.target.closest('.board-close') || e.button>0) return;
  world.style.transition=''; suppressClick=true;
  drag={id:e.pointerId, sx:e.clientX, sy:e.clientY, lx:e.clientX, ly:e.clientY, lt:performance.now(), moved:false, tile:e.target.closest('.tile')};
  vel.x=vel.y=0;
  try{ board.setPointerCapture(e.pointerId); }catch(err){}
});
board.addEventListener('pointermove', e=>{
  if(!drag || e.pointerId!==drag.id) return;
  const dx=e.clientX-drag.lx, dy=e.clientY-drag.ly, now=performance.now(), dt=Math.max(1,now-drag.lt);
  if(!drag.moved && Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>6){ drag.moved=true; board.classList.add('dragging'); hideHint(); }
  if(drag.moved){
    const R=range(), resist=(v,lo,hi)=> (v<lo||v>hi) ? .35 : 1;
    pan.x+=dx*resist(pan.x,R.xmin,R.xmax); pan.y+=dy*resist(pan.y,R.ymin,R.ymax);
    vel.x=vel.x*.6+dx/dt*16*.4; vel.y=vel.y*.6+dy/dt*16*.4; applyPan();
  }
  drag.lx=e.clientX; drag.ly=e.clientY; drag.lt=now;
});
function endDrag(e){
  if(!drag || (e && e.pointerId!==drag.id)) return;
  const d=drag; drag=null; board.classList.remove('dragging');
  if(!d.moved && d.tile && e && e.type==='pointerup'){ const n=d.tile._note; if(n) openNote(n); }
  if(performance.now()-d.lt>80){ vel.x=vel.y=0; }
  setTimeout(()=>{ suppressClick=false; }, 60);
}
board.addEventListener('pointerup', endDrag); board.addEventListener('pointercancel', endDrag);
board.addEventListener('wheel', e=>{ if(viewer.classList.contains('open')) return; e.preventDefault(); world.style.transition='';
  pan.x-=e.deltaX; pan.y-=e.deltaY; clampPan(true); applyPan(); hideHint(); }, {passive:false});
function boardTick(dt){
  if(!board.classList.contains('open') || drag) return;
  const R=range(); let moving=false; const f=dt*60;
  if(Math.abs(vel.x)>.05||Math.abs(vel.y)>.05){ pan.x+=vel.x*f; pan.y+=vel.y*f; vel.x*=Math.pow(.92,f); vel.y*=Math.pow(.92,f); moving=true; }
  const sx=pan.x<R.xmin?R.xmin-pan.x:pan.x>R.xmax?R.xmax-pan.x:0, sy=pan.y<R.ymin?R.ymin-pan.y:pan.y>R.ymax?R.ymax-pan.y:0;
  if(sx||sy){ pan.x+=sx*Math.min(1,dt*10); pan.y+=sy*Math.min(1,dt*10); if(sx) vel.x*=.5; if(sy) vel.y*=.5; moving=true; }
  if(moving) applyPan();
}
function openBoard(){
  board.classList.add('open'); pan.x=pan.y=0; vel.x=vel.y=0; renderLetters(); applyPan();
  document.getElementById('boardHint').hidden=hinted || !allNotes?.length;
  if(!reduceMotion){ tiles.forEach(el=>{ el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }); }
  setTimeout(()=>document.getElementById('closeBoard').focus({preventScroll:true}), 50);
}
function closeBoard(){ board.classList.remove('open'); closeViewer(); openBtn.focus({preventScroll:true}); }
openBtn.addEventListener('click', openBoard);
document.getElementById('closeBoard').addEventListener('click', closeBoard);
window.addEventListener('resize', ()=>{ if(allNotes && allNotes.length && dbState==='ready') layout(allNotes); });

/* ---------- single note viewer ---------- */
const vImg=document.getElementById('vImg'), vFrom=document.getElementById('vFrom'), vMsg=document.getElementById('vMsg'), vMeta=document.getElementById('vMeta');
let viewerReturn=null;
function openNote(n){
  viewerReturn=tiles.get(n.key)||null;
  if(n.img){ vImg.hidden=false; vImg.src=blobUrl(n.img.id); vImg.className=n.img.kind==='photo'?'photo':''; vImg.alt=`Picture from ${n.from||'someone'}`; }
  else { vImg.hidden=true; vImg.removeAttribute('src'); }
  vFrom.textContent=''; const sm=document.createElement('small'); sm.textContent='From'; vFrom.append(sm, document.createTextNode(n.from||'Someone who loves you'));
  vMsg.textContent=n.text||''; vMsg.hidden=!n.text;
  vMeta.textContent=fmtTime(n.at);
  viewer.scrollTop=0; viewer.classList.add('open'); document.getElementById('closeViewer').focus({preventScroll:true});
}
function closeViewer(){ if(!viewer.classList.contains('open')) return; viewer.classList.remove('open'); if(viewerReturn) viewerReturn.focus({preventScroll:true}); }
document.getElementById('closeViewer').addEventListener('click', closeViewer);
viewer.addEventListener('click', e=>{ if(e.target===viewer) closeViewer(); });
window.addEventListener('keydown', e=>{ if(e.key!=='Escape') return; if(viewer.classList.contains('open')) closeViewer(); else if(board.classList.contains('open')) closeBoard(); });
