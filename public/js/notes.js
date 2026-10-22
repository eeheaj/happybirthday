/* notes.js
 * The contributor page (#write): composer, photo/sticker attachments, doodle pad and sending.
 * Loaded as a classic script: top-level const/let/functions are shared with the other files in js/. */
"use strict";

/* =====================================================
   NOTE PAGE
   ===================================================== */
const thread=document.getElementById('thread'), form=document.getElementById('composer'), fromInput=document.getElementById('fromInput'), msgInput=document.getElementById('msgInput'), sendBtn=document.getElementById('sendBtn'), statusEl=document.getElementById('status');
const attachEl=document.getElementById('attach'), attachImg=document.getElementById('attachImg'), attachLabel=document.getElementById('attachLabel'), fileInput=document.getElementById('fileInput'), box=document.getElementById('box');
let sending=false, preparing=false, att=null, attachmentVersion=0, pendingSubmission=null;
try{ fromInput.value = localStorage.getItem('mom52-from')||''; msgInput.value = localStorage.getItem('mom52-draft')||''; }catch(e){}
function setStatus(t,err){ statusEl.textContent=t||''; statusEl.classList.toggle('err',!!err); }
function updateSend(){ sendBtn.disabled = sending || preparing || !connected || !fromInput.value.trim() || !(msgInput.value.trim() || att); }
function autosize(){ msgInput.style.height='auto'; msgInput.style.height=Math.min(msgInput.scrollHeight, window.innerHeight*.4)+'px'; }
fromInput.addEventListener('input', ()=>{ try{localStorage.setItem('mom52-from',fromInput.value);}catch(e){} updateSend(); });
msgInput.addEventListener('input', ()=>{ autosize(); try{localStorage.setItem('mom52-draft',msgInput.value);}catch(e){} updateSend(); });
msgInput.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(pointer:fine)').matches){ e.preventDefault(); form.requestSubmit(); } });

/* --- pictures: upload, paste (iOS stickers), drop --- */
async function processImage(file){
  let src, url=null;
  try{ src=await createImageBitmap(file); }
  catch(e){ url=URL.createObjectURL(file); src=await new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=url; }); }
  const w0=src.width, h0=src.height; if(!w0||!h0) throw new Error('empty');
  const k=Math.min(1,1400/Math.max(w0,h0)), w=Math.max(1,Math.round(w0*k)), h=Math.max(1,Math.round(h0*k));
  const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(src,0,0,w,h);
  if(url) URL.revokeObjectURL(url);
  const t=document.createElement('canvas'); t.width=t.height=48; const tg=t.getContext('2d'); tg.drawImage(c,0,0,48,48);
  const px=tg.getImageData(0,0,48,48).data; let clear=0; for(let i=3;i<px.length;i+=4) if(px[i]<235) clear++;
  const kind = clear > 48*48*.04 ? 'sticker' : 'photo';
  const toBlob=(type,q)=>new Promise(r=>c.toBlob(r,type,q));
  let blob = kind==='sticker' ? await toBlob('image/png') : await toBlob('image/jpeg',.86);
  if(kind==='sticker'){ const wb=await toBlob('image/webp',.9); if(wb && wb.type==='image/webp' && blob && wb.size<blob.size) blob=wb; }
  if(!blob) throw new Error('encode');
  return {blob, kind};
}
function setAttachment(a, label){
  if(att && att.url) URL.revokeObjectURL(att.url);
  attachmentVersion++; att=a; if(!a){ attachEl.hidden=true; attachImg.removeAttribute('src'); updateSend(); return; }
  a.url=URL.createObjectURL(a.blob); attachImg.src=a.url; attachImg.className=a.kind==='sticker'?'sticker':'';
  attachLabel.textContent = label || (a.kind==='sticker' ? 'Sticker attached' : 'Photo attached');
  attachEl.hidden=false; updateSend();
}
async function takeFile(file){
  if(sending || preparing) return;
  if(file && file.size > 20*1024*1024){ setStatus('Choose a picture smaller than 20 MB.',true); return; }
  if(!file || !/^image\//.test(file.type||'') && !/\.(heic|heif|png|jpe?g|gif|webp)$/i.test(file.name||'')){ setStatus('That file isn’t a picture. Try a photo, a sticker or a screenshot.',true); return; }
  setStatus('Preparing picture…');
  preparing=true; updateSend();
  try{ const picture=await processImage(file); if(picture.blob.size>2*1024*1024) throw new Error('large'); setAttachment(picture); setStatus(''); }
  catch(e){ setStatus('That picture didn’t open here. Try saving it as a JPG or PNG first.',true); }
  finally{ preparing=false; updateSend(); }
}
document.getElementById('attachRemove').addEventListener('click', ()=>setAttachment(null));
fileInput.addEventListener('change', ()=>{ const f=fileInput.files&&fileInput.files[0]; fileInput.value=''; if(f) takeFile(f); });
document.addEventListener('paste', e=>{
  if(app.dataset.view!=='write' || !e.clipboardData) return;
  const items=[...(e.clipboardData.items||[])]; const it=items.find(i=>i.kind==='file' && /^image\//.test(i.type));
  const f=it ? it.getAsFile() : (e.clipboardData.files && e.clipboardData.files[0]);
  if(f && /^image\//.test(f.type)){ e.preventDefault(); takeFile(f); }
});
['dragenter','dragover'].forEach(t=>box.addEventListener(t, e=>{ e.preventDefault(); box.classList.add('drop'); }));
['dragleave','drop'].forEach(t=>box.addEventListener(t, e=>{ e.preventDefault(); box.classList.remove('drop'); }));
box.addEventListener('drop', e=>{ const f=e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if(f) takeFile(f); });

/* --- doodle pad --- */
const doodle=document.getElementById('doodle'), pad=document.getElementById('pad'), pctx=pad.getContext('2d');
const PCOL=['#E2456B','#FFC56E','#F7E9DF','#F49AB0','#8FD3C1','#7FB2FF'], PSZ=[10,22,44];
let strokes=[], curStroke=null, pcol=PCOL[0], psz=PSZ[1];
const swatches=document.getElementById('swatches'), sizes=document.getElementById('sizes');
PCOL.forEach(c=>{ const b=document.createElement('button'); b.type='button'; b.className='sw'; b.style.background=c; b.setAttribute('aria-label','Color '+c); b.setAttribute('aria-pressed',String(c===pcol));
  b.onclick=()=>{ pcol=c; [...swatches.children].forEach(x=>x.setAttribute('aria-pressed',String(x===b))); }; swatches.appendChild(b); });
PSZ.forEach((s,i)=>{ const b=document.createElement('button'); b.type='button'; b.className='sz'; b.setAttribute('aria-label',['Thin','Medium','Thick'][i]+' brush'); b.setAttribute('aria-pressed',String(s===psz));
  const dot=document.createElement('i'); dot.style.width=dot.style.height=(4+i*5)+'px'; b.appendChild(dot);
  b.onclick=()=>{ psz=s; [...sizes.children].forEach(x=>x.setAttribute('aria-pressed',String(x===b))); }; sizes.appendChild(b); });
function sizePad(){ const r=pad.getBoundingClientRect(); const px=Math.max(200,Math.round(r.width*dpr)); if(pad.width!==px){ pad.width=pad.height=px; } }
function drawStroke(g,st,k,ox,oy){
  const p=st.p; g.strokeStyle=st.c; g.fillStyle=st.c; g.lineWidth=st.w*k; g.lineCap='round'; g.lineJoin='round';
  const X=i=>(p[i][0]-ox)*k, Y=i=>(p[i][1]-oy)*k;
  if(p.length===1){ g.beginPath(); g.arc(X(0),Y(0),st.w*k/2,0,Math.PI*2); g.fill(); return; }
  g.beginPath(); g.moveTo(X(0),Y(0));
  for(let i=1;i<p.length-1;i++){ g.quadraticCurveTo(X(i),Y(i),(X(i)+X(i+1))/2,(Y(i)+Y(i+1))/2); }
  g.lineTo(X(p.length-1),Y(p.length-1)); g.stroke();
}
function redrawPad(){ pctx.clearRect(0,0,pad.width,pad.height); const k=pad.width/1000; strokes.forEach(s=>drawStroke(pctx,s,k,0,0)); }
function padPoint(e){ const r=pad.getBoundingClientRect(); return [ (e.clientX-r.left)/r.width*1000, (e.clientY-r.top)/r.height*1000 ]; }
pad.addEventListener('pointerdown', e=>{ e.preventDefault(); try{pad.setPointerCapture(e.pointerId);}catch(err){} curStroke={c:pcol,w:psz,p:[padPoint(e)]}; strokes.push(curStroke); redrawPad(); });
pad.addEventListener('pointermove', e=>{ if(!curStroke) return; const pt=padPoint(e), last=curStroke.p[curStroke.p.length-1]; if(Math.hypot(pt[0]-last[0],pt[1]-last[1])>2){ curStroke.p.push(pt); redrawPad(); } });
const endStroke=()=>{ curStroke=null; }; pad.addEventListener('pointerup',endStroke); pad.addEventListener('pointercancel',endStroke);
function openPad(){ if(sending || preparing) return; doodle.hidden=false; sizePad(); redrawPad(); document.getElementById('padUndo').focus(); }
function closePad(){ doodle.hidden=true; document.getElementById('doodleBtn').focus({preventScroll:true}); }
document.getElementById('doodleBtn').addEventListener('click', openPad);
document.getElementById('padCancel').addEventListener('click', closePad);
document.getElementById('padUndo').addEventListener('click', ()=>{ strokes.pop(); redrawPad(); });
document.getElementById('padClear').addEventListener('click', ()=>{ strokes=[]; redrawPad(); });
document.getElementById('padDone').addEventListener('click', ()=>{
  if(!strokes.length){ closePad(); return; }
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9,mw=0;
  strokes.forEach(s=>{ mw=Math.max(mw,s.w); s.p.forEach(([x,y])=>{ x0=Math.min(x0,x); y0=Math.min(y0,y); x1=Math.max(x1,x); y1=Math.max(y1,y); }); });
  const pad2=mw/2+8; x0-=pad2; y0-=pad2; x1+=pad2; y1+=pad2;
  const bw=x1-x0, bh=y1-y0, k=Math.min(1.2, 900/Math.max(bw,bh));
  const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(bw*k)); c.height=Math.max(1,Math.round(bh*k));
  const g=c.getContext('2d'); strokes.forEach(s=>drawStroke(g,s,k,x0,y0));
  c.toBlob(b=>{ if(b){ setAttachment({blob:b, kind:'sticker'}, 'Doodle attached'); } closePad(); }, 'image/png');
});
window.addEventListener('keydown', e=>{ if(e.key==='Escape' && !doodle.hidden) closePad(); });
window.addEventListener('resize', ()=>{ if(!doodle.hidden){ sizePad(); redrawPad(); } });

/* --- thread + send --- */
function renderThread(){
  thread.textContent='';
  const notes=myNotes;
  if(!connected && !notes.length){ const s=document.createElement('p'); s.className='sys'; s.textContent = 'Connecting…'; thread.appendChild(s); return; }
  if(!notes.length) return;
  notes.forEach(n=>{ const b=document.createElement('div'); b.className='bubble';
    if(n.img && n.img.id){ const im=document.createElement('img'); im.src=blobUrl(n.img.id); im.alt='Your picture'; if(n.img.kind!=='photo') im.className='sticker'; b.appendChild(im); }
    if(n.text){ const p=document.createElement('p'); p.textContent=n.text; b.appendChild(p); }
    const m=document.createElement('div'); m.className='bmeta'; const a=document.createElement('span'); a.textContent=n.from||''; const c=document.createElement('span'); c.textContent=fmtTime(n.at); m.append(a,c);
    b.appendChild(m); thread.appendChild(b); });
}
form.addEventListener('submit', async e=>{
  e.preventDefault(); if(sendBtn.disabled) return;
  const text=msgInput.value.trim(), from=fromInput.value.trim();
  const signature=JSON.stringify([text,from,attachmentVersion]);
  if(!pendingSubmission || pendingSubmission.signature!==signature) pendingSubmission={id:crypto.randomUUID(),signature};
  sending=true; updateSend();
  const controls=[...form.querySelectorAll('input,textarea,button')];
  controls.forEach(el=>el.disabled=true);
  try{
    let image=null;
    if(att){
      setStatus('Uploading picture…');
      image={kind:att.kind,data:await new Promise((resolve,reject)=>{
        const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(att.blob);
      })};
    }
    setStatus('Sending…');
    const {note}=await api('notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:pendingSubmission.id,from,text,image})});
    if(!myNotes.some(n=>n.id===note.id)) myNotes.push(note);
    pendingSubmission=null; renderThread();
    msgInput.value=''; autosize(); setAttachment(null); try{localStorage.removeItem('mom52-draft');}catch(e){}
    setStatus('Sent ♥');
  }catch(err){
    setStatus(err.message || 'That note didn’t send. Check your connection and try again.',true);
  }
  controls.forEach(el=>el.disabled=false);
  sending=false; updateSend(); window.scrollTo({top:document.body.scrollHeight,behavior:reduceMotion?'auto':'smooth'});
});
renderThread(); autosize();
