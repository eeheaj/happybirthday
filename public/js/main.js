/* Shared notes are polled only while this page is visible. */
'use strict';
let refreshBusy=false, lastNotesJSON='', lastThreadJSON='';
async function refreshNotes(){
  if(refreshBusy || document.hidden) return;
  refreshBusy=true;
  try{
    if(!connected){ await api('session'); connected=true; updateSend(); }
    const writing=app.dataset.view==='write';
    const {notes}=await api(writing ? 'notes?mine=1' : 'notes');
    if(writing){
      // A send may complete while this request is in flight. Never drop an acknowledged note.
      const merged=new Map(myNotes.map(n=>[n.id,n])); notes.forEach(n=>merged.set(n.id,n));
      myNotes=[...merged.values()].sort((a,b)=>a.at-b.at);
      const serialized=JSON.stringify(myNotes);
      if(serialized!==lastThreadJSON){ lastThreadJSON=serialized; renderThread(); }
      if(statusEl.dataset.connectionError){ setStatus(''); delete statusEl.dataset.connectionError; }
    } else {
      const serialized=JSON.stringify(notes), recovered=dbState!=='ready';
      allNotes=notes; dbState='ready';
      if(serialized!==lastNotesJSON || recovered){ lastNotesJSON=serialized; renderLetters(); }
    }
  }catch(error){
    dbState='off'; renderLetters();
    if(app.dataset.view==='write' && !sending){ setStatus(error.message,true); statusEl.dataset.connectionError='true'; }
  }finally{ refreshBusy=false; }
}
route(); onResize(); requestAnimationFrame(frame); renderLetters(); refreshNotes();
setInterval(refreshNotes,5000);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) refreshNotes(); });
window.addEventListener('online',refreshNotes);
window.addEventListener('hashchange',refreshNotes);

// Keep keyboard focus inside whichever overlay is in front.
document.addEventListener('keydown',event=>{
  if(event.key!=='Tab') return;
  const modal=!doodle.hidden ? doodle : viewer.classList.contains('open') ? viewer : board.classList.contains('open') ? board : null;
  if(!modal) return;
  const elements=[...modal.querySelectorAll('button:not(:disabled),[href],input,textarea,[tabindex="0"]')];
  if(!elements.length) return;
  const first=elements[0], last=elements[elements.length-1];
  if(event.shiftKey && (document.activeElement===first || !modal.contains(document.activeElement))){ event.preventDefault(); last.focus(); }
  else if(!event.shiftKey && (document.activeElement===last || !modal.contains(document.activeElement))){ event.preventDefault(); first.focus(); }
});
