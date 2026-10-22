/* main.js
 * Connects to the data store and boots the page. Load this last.
 * Loaded as a classic script: top-level const/let/functions are shared with the other files in js/. */
"use strict";

/* ---------- connect to the store ---------- */
pClaude.then(async ([d,u,as])=>{
  db=d||null; assets=as||null;
  if(!db){ dbState='off'; renderLetters(); renderThread(); updateSend(); return; }
  try{ uid = u ? await u.id() : null; }catch(e){ uid=null; }
  // everyone's notes, for Mom's page
  db.collection('messages').onSnapshot(snap=>{
    const list=[];
    snap.docs.forEach(doc=>{ const v=doc.data()||{}; (Array.isArray(v.notes)?v.notes:[]).forEach(n=>{ if(!n) return; const text=typeof n.text==='string'?n.text.slice(0,1500):''; const img=(n.img&&typeof n.img.id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(n.img.id))?{id:n.img.id,kind:n.img.kind==='photo'?'photo':'sticker'}:null; if(!text&&!img) return;
      const id=String(n.id||'').slice(0,8); list.push({key:doc.id+'-'+id, from:String(v.from||'').slice(0,60), text, img, id, at:Number(n.at)||0}); }); });
    list.sort((a,b)=>a.at-b.at); allNotes=list; dbState='ready'; renderLetters();
  }, ()=>{ dbState='off'; renderLetters(); });
  // this person's own notes, for the note page
  if(uid){ myDoc=db.doc('messages/'+uid); myDoc.onSnapshot(s=>{ myData=s.exists?s.data():null; renderThread(); }, ()=>{}); }
  renderThread(); updateSend();
});

/* ---------- boot ---------- */
route(); onResize(); requestAnimationFrame(frame);
