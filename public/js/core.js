/* core.js
 * Shared constants, page routing (#write) and the data-store handles.
 * Loaded as a classic script: top-level const/let/functions are shared with the other files in js/. */
"use strict";

const AGE = 52;
const app = document.getElementById('app');
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- routing ---------- */
function route(){
  app.dataset.view = location.pathname.replace(/\/$/,'') === '/write' || location.hash === '#write' ? 'write' : 'home';
  document.title = app.dataset.view === 'write' ? 'Leave Mom a note · 52' : 'Mom’s 52nd Birthday';
  if(app.dataset.view==='home') onResize();
}
window.addEventListener('hashchange', route);
app.dataset.view = location.pathname.replace(/\/$/,'') === '/write' || location.hash === '#write' ? 'write' : 'home';

/* ---------- shared data (db) ---------- */
let connected = false, myNotes = [];
async function api(path, options = {}) {
  const response = await fetch('/api/' + path, {
    credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(25000), ...options
  });
  let body;
  try { body = await response.json(); } catch { body = {}; }
  if (!response.ok) throw new Error(body.error || (response.status === 429 ? 'A lot of wishes are arriving. Please try again in a minute.' : 'Could not connect to the scrapbook. Please try again.'));
  return body;
}
