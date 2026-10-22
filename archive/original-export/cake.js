/* core.js
 * Shared constants, page routing (#write) and the data-store handles.
 * Loaded as a classic script: top-level const/let/functions are shared with the other files in js/. */
"use strict";

const AGE = 52;
const app = document.getElementById('app');
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- routing ---------- */
function route(){ app.dataset.view = location.hash === '#write' ? 'write' : 'home'; if(app.dataset.view==='home') onResize(); }
window.addEventListener('hashchange', route);

/* ---------- shared data (db) ---------- */
let db = null, uid = null, myDoc = null, myData = null;
let assets = null;
const pClaude = (window.claude && window.claude.use) ? Promise.all([claude.use('db'), claude.use('user'), claude.use('assets')]) : Promise.resolve([null,null,null]);
