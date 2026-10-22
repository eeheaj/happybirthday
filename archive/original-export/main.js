/* cake.js
 * Mom's view: the three.js cake scene, blowing out the candles, confetti and the render loop.
 * Loaded as a classic script: top-level const/let/functions are shared with the other files in js/. */
"use strict";

/* =====================================================
   MOM'S VIEW — three.js cake
   ===================================================== */
const canvas = document.getElementById('gl');
let renderer, scene, camera, bgScene, bgCam, bgMat, flames = [], candleLights = [], hemi, key, smoke, waxU = null, emberMat = null;
let glOK = true;
try {
  renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
} catch(e){ glOK = false; }
if(!glOK || !window.THREE){
  glOK = false;
  const d = document.createElement('div'); d.className='nogl';
  d.textContent = "This device couldn't draw the 3D cake, but the candles still count. Tap below to blow them out.";
  document.getElementById('home').appendChild(d);
}

const NOISE = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.02;a*=.5;}return v;}`;

function canvasTex(w,h,draw){ const c=document.createElement('canvas'); c.width=w;c.height=h; draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c); t.encoding=THREE.sRGBEncoding; t.anisotropy=4; return t; }

if(glOK){
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;

  /* --- background shader --- */
  bgScene = new THREE.Scene();
  bgCam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  bgMat = new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uRes:{value:new THREE.Vector2(1,1)},uGlow:{value:1},uParty:{value:0},uGlowPos:{value:new THREE.Vector2(0,.1)}},
    vertexShader:`varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:`precision highp float; varying vec2 vUv; uniform float uTime,uGlow,uParty; uniform vec2 uRes,uGlowPos;
    ${NOISE}
    void main(){
      float asp=uRes.x/uRes.y; vec2 p=(vUv-.5)*vec2(asp,1.);
      vec2 d=p-uGlowPos; d.y*=1.15;
      float r=length(d);
      float flick=.92+.08*noise(vec2(uTime*5.,1.))+.04*sin(uTime*13.);
      vec3 col=vec3(1.,.55,.22)*exp(-r*r*9.)*.5*uGlow*flick;
      col+=vec3(1.,.42,.18)*exp(-r*r*2.2)*.09*uGlow*flick;
      col+=vec3(1.,.45,.6)*exp(-r*r*3.)*.12*uParty;
      col+=(hash(vUv*uRes+uTime)-.5)*.006;
      gl_FragColor=vec4(max(col,0.),1.);
    }`,
    depthTest:false, depthWrite:false
  });
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), bgMat));

  /* --- main scene --- */
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, 1, .1, 100);

  hemi = new THREE.HemisphereLight(0x8c8086, 0x120a08, .5); scene.add(hemi);
  key = new THREE.DirectionalLight(0xffe2cc, .55); key.position.set(-3,6,4);
  key.castShadow = true; key.shadow.mapSize.set(1024,1024); key.shadow.camera.left=-4; key.shadow.camera.right=4; key.shadow.camera.top=4; key.shadow.camera.bottom=-4; key.shadow.bias=-.0008;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb48a, .35); rim.position.set(3,3,-5); scene.add(rim);

  const cake = new THREE.Group(); scene.add(cake);
  const rand = (()=>{ let h=20261022; return ()=>{ h^=h<<13; h>>>=0; h^=h>>>17; h^=h<<5; h>>>=0; return (h%100000)/100000; }; })();

  // flat, illustration-style shading: three tones per material
  const tones = new THREE.DataTexture(new Uint8Array([110,190,255]),3,1,THREE.LuminanceFormat);
  tones.minFilter = tones.magFilter = THREE.NearestFilter; tones.generateMipmaps = false; tones.needsUpdate = true;
  const toon = (color, extra) => new THREE.MeshToonMaterial(Object.assign({color, gradientMap:tones}, extra||{}));
  const plateMat = toon(0xE9B983), sponge = toon(0x6A2A17), creamMat = toon(0xFADCC2), dotMat = toon(0xE0222B),
        glaze = toon(0xFFFFFF,{emissive:0x5a5a60}), berryRed = toon(0xE41B2C), seedMat = toon(0x3A1612), blue = toon(0x23379A), wickMat = toon(0x1a1210);

  // plate
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(2.25,2.15,.1,96), plateMat); plate.position.y=-.05; plate.receiveShadow=true; cake.add(plate);

  // layers: sponge / cream / sponge / cream / sponge, cream bulging out a little
  const CR=1.5; let y=0;
  function spongeLayer(h){ const m=new THREE.Mesh(new THREE.CylinderGeometry(CR,CR,h,96), sponge); m.position.y=y+h/2; m.castShadow=m.receiveShadow=true; cake.add(m); y+=h; }
  const dotGeo = new THREE.SphereGeometry(1,10,8);
  function creamLayer(h){
    const pts=[]; for(let i=0;i<=12;i++){ const t=i/12; pts.push(new THREE.Vector2(CR+.06*Math.sin(t*Math.PI)+.005, t*h)); }
    const side=new THREE.Mesh(new THREE.LatheGeometry(pts,96), creamMat); side.position.y=y; side.castShadow=side.receiveShadow=true; cake.add(side);
    const n=46, im=new THREE.InstancedMesh(dotGeo, dotMat, n), m=new THREE.Matrix4(), q=new THREE.Quaternion();
    for(let i=0;i<n;i++){ const a=i/n*Math.PI*2+rand()*.1, t=.2+rand()*.6, rr=CR+.06*Math.sin(t*Math.PI)+.004, s=.022+rand()*.03;
      m.compose(new THREE.Vector3(Math.cos(a)*rr, y+t*h, Math.sin(a)*rr), q, new THREE.Vector3(s,s,s*.5)); im.setMatrixAt(i,m); }
    cake.add(im); y+=h;
  }
  spongeLayer(.34); creamLayer(.2); spongeLayer(.34); creamLayer(.2); spongeLayer(.3);
  const TOP=y;

  // glaze: a domed cap with a rounded edge and a few thick, bulky drips
  (function(){
    const R0=CR+.045;
    const cap=new THREE.Mesh(new THREE.LatheGeometry([[R0+.01,0],[R0-.02,.03],[1.4,.055],[1.1,.08],[.6,.095],[0,.1]].map(p=>new THREE.Vector2(p[0],p[1])),96), glaze);
    cap.position.y=TOP; cap.castShadow=cap.receiveShadow=true; cake.add(cap);
    const drips=[{a:.35,len:.42,w:.34},{a:1.45,len:.22,w:.4},{a:2.35,len:.5,w:.3},{a:3.4,len:.28,w:.42},{a:4.35,len:.46,w:.33},{a:5.4,len:.2,w:.4}];
    const H=.9, g=new THREE.CylinderGeometry(R0,R0,H,200,30,true), pos=g.attributes.position, v=new THREE.Vector3();
    const angDist=(a,b)=>{ let d=Math.abs(a-b)%(Math.PI*2); return d>Math.PI?Math.PI*2-d:d; };
    const lenAt=a=>{ let L=.12; drips.forEach(d=>{ const t=angDist(a,d.a)/d.w; if(t<1) L=Math.max(L,.12+d.len*Math.pow(1-t*t,.6)); }); return L; };
    for(let i=0;i<pos.count;i++){ v.fromBufferAttribute(pos,i);
      const a=Math.atan2(v.z,v.x), f=(H/2-v.y)/H, L=lenAt(a);
      const bulge=1+.03*Math.pow(f,2);
      pos.setXYZ(i, v.x*bulge, TOP+.005-f*L, v.z*bulge); }
    g.computeVertexNormals();
    const curtain=new THREE.Mesh(g, glaze); curtain.castShadow=true; cake.add(curtain);
    drips.forEach(d=>{ const b=new THREE.Mesh(new THREE.SphereGeometry(1,20,14), glaze), r=.07+d.w*.12;
      b.scale.set(r*1.15,r,r*.75); b.position.set(Math.cos(d.a)*(R0+.03), TOP+.005-.12-d.len+r*.35, Math.sin(d.a)*(R0+.03));
      b.lookAt(0,b.position.y,0); b.castShadow=true; cake.add(b); });
  })();

  // fruit on top: one strawberry, tip up, between two blueberries
  const prof=[[0,0],[.05,.015],[.11,.07],[.16,.16],[.19,.26],[.19,.33],[.15,.39],[.07,.42],[0,.425]];
  const berryGeoTop=new THREE.LatheGeometry(prof.map(p=>new THREE.Vector2(p[0],p[1])),36);
  const seed=new THREE.SphereGeometry(.012,6,4); seed.scale(1,1.6,1);
  const radiusAt=yy=>{ for(let k=1;k<prof.length;k++){ if(prof[k][1]>=yy){ const a=prof[k-1],b=prof[k],u=(yy-a[1])/(b[1]-a[1]); return a[0]+(b[0]-a[0])*u; } } return 0; };
  function strawberry(x,z,yaw,s){
    const sb=new THREE.Group(), berry=new THREE.Mesh(berryGeoTop, berryRed); berry.castShadow=true;
    berry.rotation.x=Math.PI; berry.position.y=.425; sb.add(berry);
    for(let i=0;i<16;i++){ const t=.2+rand()*.65, rr=radiusAt((1-t)*.425), a=rand()*Math.PI*2, sd=new THREE.Mesh(seed,seedMat);
      sd.position.set(Math.cos(a)*(rr+.002), t*.425, Math.sin(a)*(rr+.002)); sb.add(sd); }
    sb.scale.setScalar(s); sb.position.set(x,TOP+.03,z); sb.rotation.y=yaw; cake.add(sb);
  }
  const blueGeo=new THREE.SphereGeometry(.17,24,16), crownGeo=new THREE.TorusGeometry(.04,.016,6,12), crownMat=toon(0x15204F);
  function blueberry(x,z){
    const b=new THREE.Mesh(blueGeo, blue); b.scale.set(1,.88,1); b.position.set(x,TOP+.17,z); b.castShadow=true; cake.add(b);
    const c=new THREE.Mesh(crownGeo, crownMat); c.rotation.x=Math.PI/2; c.position.set(x,TOP+.315,z); cake.add(c);
  }
  // alternating ring around the whole top edge
  const PAIRS=8, RING=CR-.24;
  for(let i=0;i<PAIRS*2;i++){ const a=i/(PAIRS*2)*Math.PI*2+Math.PI/2+Math.PI/(PAIRS*2), x=Math.cos(a)*RING, z=Math.sin(a)*RING;
    if(i%2===0) strawberry(x,z,rand()*6.28,1.0); else blueberry(x,z); }

  // number candles: chunky, plain wax
  const P=(x,y)=>new THREE.Vector3(x,y,0), R=.105, DEPTH=1.35;
  const waxMat = new THREE.MeshStandardMaterial({color:0xF0507D, roughness:.38, metalness:0, emissive:0x3a0814});
  function digitMesh(path, joints, ends){
    const grp=new THREE.Group();
    const tg=new THREE.TubeGeometry(path,480,R,40,false); tg.scale(1,1,DEPTH);
    const tube=new THREE.Mesh(tg,waxMat); tube.castShadow=true; tube.receiveShadow=true; grp.add(tube);
    const sg=new THREE.SphereGeometry(R,40,28); sg.scale(1,1,DEPTH);
    joints.concat(ends).forEach(p=>{ const s=new THREE.Mesh(sg,waxMat); s.position.copy(p); grp.add(s); });
    return grp;
  }
  const five=new THREE.CurvePath();
  five.add(new THREE.LineCurve3(P(.27,1),P(-.18,1)));
  five.add(new THREE.LineCurve3(P(-.18,1),P(-.24,.56)));
  five.add(new THREE.CatmullRomCurve3([P(-.24,.56),P(-.04,.64),P(.18,.59),P(.3,.39),P(.27,.15),P(.1,.01),P(-.12,0),P(-.29,.12)]));
  const two=new THREE.CurvePath();
  two.add(new THREE.CatmullRomCurve3([P(-.27,.74),P(-.2,.92),P(-.02,1.0),P(.17,.96),P(.27,.8),P(.24,.6),P(.08,.41),P(-.12,.21),P(-.28,0)]));
  two.add(new THREE.LineCurve3(P(-.28,0),P(.29,0)));
  const digits = {
    '5':{mesh:digitMesh(five,[P(-.18,1),P(-.24,.56)],[P(.27,1),P(-.29,.12)]), wick:P(.04,1)},
    '2':{mesh:digitMesh(two,[P(-.28,0)],[P(-.27,.74),P(.29,0)]), wick:P(-.02,1.0)}
  };
  const ageStr=String(AGE); const spacing=.38, startX=-(ageStr.length-1)*spacing;

  const flameMatBase = {
    uniforms:{uTime:{value:0},uSeed:{value:0},uLean:{value:0},uLife:{value:1}},
    vertexShader:`varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`precision highp float; varying vec2 vUv; uniform float uTime,uSeed,uLean,uLife;
    ${NOISE}
    void main(){
      vec2 uv=vUv; float t=uTime;
      float n1=noise(vec2(uv.y*3.-t*5.5, uSeed*10.)), n2=noise(vec2(uv.y*8.-t*10., uSeed*3.+5.));
      float y=(uv.y-.12)/.78;
      y/=(.86+.2*n1)*(.65+.35*uLife);
      float sway=(n1-.5)*.07+(n2-.5)*.025;
      float x=uv.x-.5-(sway+uLean*.3)*y*y*1.6;
      float yc=clamp(y,0.,1.);
      float w=.32*pow(yc,.45)*pow(1.-yc,1.05)+.0005;
      float e=abs(x)/w;
      float inside=step(0.,y)*step(y,1.);
      float body=smoothstep(1.,.45,e)*inside;
      float core=smoothstep(.75,.0,e)*smoothstep(.04,.2,y)*smoothstep(.78,.3,y)*inside;
      float blue=smoothstep(.2,.02,y)*smoothstep(1.1,.3,e)*step(-.01,y);
      vec3 col=mix(vec3(1.,.36,.05),vec3(1.,.66,.2),smoothstep(1.,.45,y))*body;
      col=mix(col,vec3(1.,.95,.78),core*body);
      col*=1.-.55*smoothstep(.16,.0,y)*smoothstep(.55,.0,e);
      col+=vec3(.22,.32,1.)*blue*.5;
      float halo=exp(-dot((uv-vec2(.5,.38))*vec2(1.,.6),(uv-vec2(.5,.38))*vec2(1.,.6))*30.)*.32;
      gl_FragColor=vec4((col*1.35+vec3(1.,.55,.2)*halo)*uLife,1.);
    }`,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending
  };
  const glowMat = new THREE.ShaderMaterial({
    uniforms:{uLife:{value:1},uTime:{value:0}},
    vertexShader:`varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv; uniform float uLife,uTime; void main(){ float d=length(vUv-.5); float g=exp(-d*d*22.)*.3*(.92+.08*sin(uTime*11.)); gl_FragColor=vec4(vec3(1.,.55,.22)*g*uLife,1.);}`,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending
  });

  emberMat = new THREE.MeshBasicMaterial({color:0xff6a1a, transparent:true});
  [...ageStr].forEach((ch,i)=>{
    const d = digits[ch] || digits['5'];
    const g = d.mesh.clone();
    g.position.set(startX+i*spacing*2, TOP+.09+R, 0); cake.add(g);
    const base = new THREE.Vector3(d.wick.x + g.position.x, d.wick.y + R + g.position.y, g.position.z);
    const bend = i%2 ? -.018 : .018;
    const wc = new THREE.QuadraticBezierCurve3(base.clone().add(new THREE.Vector3(0,-.01,0)), base.clone().add(new THREE.Vector3(0,.05,0)), base.clone().add(new THREE.Vector3(bend,.085,0)));
    const wick = new THREE.Mesh(new THREE.TubeGeometry(wc,10,.012,6,false), wickMat); scene.add(wick);
    const ember = new THREE.Mesh(new THREE.SphereGeometry(.011,8,6), emberMat); ember.position.copy(base).add(new THREE.Vector3(bend,.085,0)); scene.add(ember);
    const mat = new THREE.ShaderMaterial(Object.assign({}, flameMatBase, {uniforms:THREE.UniformsUtils.clone(flameMatBase.uniforms)}));
    mat.uniforms.uSeed.value = i*1.7+.3;
    const flame = new THREE.Mesh(new THREE.PlaneGeometry(.26,.52), mat);
    flame.position.copy(base).add(new THREE.Vector3(0,.255,0)); scene.add(flame);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.2), glowMat); glow.position.copy(flame.position); scene.add(glow);
    const light = new THREE.PointLight(0xffa04a, 1.8, 7, 2); light.position.copy(flame.position).add(new THREE.Vector3(0,-.02,.08));
    if(i===0){ light.castShadow=true; light.shadow.mapSize.set(512,512); light.shadow.bias=-.004; light.shadow.radius=4; }
    scene.add(light);
    flames.push({flame, glow, mat, light, top:base.clone().add(new THREE.Vector3(bend,.07,0))});
  });

  // smoke particles
  const SM=90*flames.length, sp=new Float32Array(SM*3), sa=new Float32Array(SM), ss=new Float32Array(SM);
  const smokeGeo=new THREE.BufferGeometry(); smokeGeo.setAttribute('position',new THREE.BufferAttribute(sp,3)); smokeGeo.setAttribute('aAlpha',new THREE.BufferAttribute(sa,1)); smokeGeo.setAttribute('aSize',new THREE.BufferAttribute(ss,1));
  const smokeMat=new THREE.ShaderMaterial({ uniforms:{uPR:{value:renderer.getPixelRatio()}},
    vertexShader:`attribute float aAlpha; attribute float aSize; varying float vA; uniform float uPR; void main(){ vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=aSize*uPR*(260./-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`varying float vA; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d)*vA; gl_FragColor=vec4(vec3(.78,.72,.74),a); }`,
    transparent:true, depthWrite:false });
  smoke={geo:smokeGeo, pts:new THREE.Points(smokeGeo,smokeMat), parts:[]};
  for(let i=0;i<SM;i++) smoke.parts.push({life:0});
  scene.add(smoke.pts);
}

/* ---------- camera fit ---------- */
const target = window.THREE ? new THREE.Vector3(0,1.05,0) : {x:0,y:1,z:0};
let camDist = 10, pointer = {x:0,y:0}, ptrSmooth={x:0,y:0};
function onResize(){
  const w=window.innerWidth, h=window.innerHeight;
  confettiCanvas.width=w*dpr; confettiCanvas.height=h*dpr;
  if(!glOK) return;
  renderer.setSize(w,h,false); camera.aspect=w/h;
  const vt=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)), ht=vt*camera.aspect;
  camDist=Math.max(2.9/vt, 2.75/ht);
  target.y = camera.aspect<.8 ? .7 : .8;
  camera.updateProjectionMatrix(); bgMat.uniforms.uRes.value.set(w,h);
}
const confettiCanvas=document.getElementById('confetti'), cctx=confettiCanvas.getContext('2d'), dpr=Math.min(window.devicePixelRatio||1,2);
window.addEventListener('resize', onResize);

/* ---------- blowing interaction ---------- */
let breath=0, holding=false, lit=true, outT=0, lastY=null, lastT=0, swipeBoost=0;
const prog=document.getElementById('prog'), blowBtn=document.getElementById('blowBtn'), home=document.getElementById('home');
const board=document.getElementById('board'), viewer=document.getElementById('viewer');
const holdRing=document.getElementById('holdRing');
function startHold(e){ if(!lit || board.classList.contains('open')) return; holding=true;
  if(e && e.clientX!=null){ holdRing.style.left=e.clientX+'px'; holdRing.style.top=e.clientY+'px'; } else { holdRing.style.left='50%'; holdRing.style.top='72%'; } blowBtn.classList.add('holding'); lastY=e&&e.clientY!=null?e.clientY:null; lastT=performance.now(); }
function endHold(){ holding=false; blowBtn.classList.remove('holding'); lastY=null; }
home.addEventListener('pointerdown', e=>{ if(e.target.closest('.btn,.board,.viewer')) return; startHold(e); });
window.addEventListener('pointerup', endHold); window.addEventListener('pointercancel', endHold);
home.addEventListener('pointermove', e=>{
  pointer.x=(e.clientX/window.innerWidth)*2-1; pointer.y=(e.clientY/window.innerHeight)*2-1;
  if(holding && lastY!=null){ const now=performance.now(), dy=lastY-e.clientY, dt=Math.max(1,now-lastT); if(dy>0) swipeBoost+=Math.min(.35, dy/dt*.06); lastY=e.clientY; lastT=now; }
});
blowBtn.addEventListener('keydown', e=>{ if((e.key===' '||e.key==='Enter') && !e.repeat){ e.preventDefault(); startHold(); } });
blowBtn.addEventListener('keyup', e=>{ if(e.key===' '||e.key==='Enter') endHold(); });
window.addEventListener('keydown', e=>{ if(app.dataset.view==='home' && e.key===' ' && !e.repeat && !e.target.closest('button,input,textarea')){ e.preventDefault(); startHold(); } });
window.addEventListener('keyup', e=>{ if(app.dataset.view==='home' && e.key===' ') endHold(); });
blowBtn.addEventListener('click', e=>e.preventDefault());

const titleEl=document.getElementById('title'), subEl=document.getElementById('sub'), before=document.getElementById('before'), afterUI=document.getElementById('afterUI');
function blowOut(){
  lit=false; holdRing.classList.remove('on'); endHold(); outT=performance.now();
  if(glOK){ flames.forEach((f,fi)=>{ let n=0; for(const p of smoke.parts){ if(p.life<=0 && n<60){ n++; Object.assign(p,{life:1+Math.random()*1.6, max:0, delay:Math.random()*.9, x:f.top.x+(Math.random()-.5)*.02, y:f.top.y+.05, z:f.top.z, vx:(Math.random()-.5)*.08, vy:.35+Math.random()*.3, s:.05+Math.random()*.05}); p.max=p.life; } } }); }
  launchConfetti();
  titleEl.innerHTML='Happy 52nd birthday, <em>Mom</em>';
  subEl.textContent='Your wish is on its way. Everyone left you a little something.';
  before.classList.add('gone'); afterUI.classList.remove('gone');
  setTimeout(()=>{ if(!lit) document.getElementById('openLetters').focus({preventScroll:true}); }, 900);
}
function relight(){
  lit=true; breath=0; outT=0; titleEl.innerHTML='Make a wish, <em>Mom</em>';
  subEl.textContent='Fifty-two candles’ worth of love, squeezed into two.';
  before.classList.remove('gone'); afterUI.classList.add('gone');
}
document.getElementById('relight').addEventListener('click', relight);

/* ---------- confetti ---------- */
const COLORS=['#E2456B','#F7E9DF','#FFC56E','#F49AB0','#8FD3C1','#FF8A5B'];
let bits=[];
function launchConfetti(){
  const w=window.innerWidth, h=window.innerHeight, n=reduceMotion?60:Math.min(320, Math.round(w*h/3500)+120);
  const add=(x,y,ang,spread,speed)=>{ const a=ang+(Math.random()-.5)*spread, v=speed*(.55+Math.random()*.6);
    bits.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,r:Math.random()*6.28,vr:(Math.random()-.5)*.3,w:6+Math.random()*7,h:3+Math.random()*5,c:COLORS[Math.random()*COLORS.length|0],k:Math.random()<.18?1:(Math.random()<.2?2:0),ph:Math.random()*6.28,life:0}); };
  const sp=Math.max(14, Math.min(w,h)*.028);
  for(let i=0;i<n*.38;i++) add(-10,h*.95,-Math.PI/3,.6,sp);
  for(let i=0;i<n*.38;i++) add(w+10,h*.95,-Math.PI*2/3,.6,sp);
  for(let i=0;i<n*.24;i++) add(w/2,h*.42,-Math.PI/2,Math.PI*1.3,sp*.7);
  if(glOK) bgMat.uniforms.uParty.value=1;
}
function drawConfetti(dt){
  const w=window.innerWidth, h=window.innerHeight; cctx.setTransform(dpr,0,0,dpr,0,0); cctx.clearRect(0,0,w,h);
  if(!bits.length) return;
  const f=dt*60;
  bits=bits.filter(b=>b.y<h+40 && b.life<900);
  for(const b of bits){
    b.life+=f; b.vy+=.32*f*.5; b.vx*=Math.pow(.985,f); b.vy*=Math.pow(.985,f);
    b.x+=(b.vx+Math.sin(b.life*.05+b.ph)*.6)*f; b.y+=b.vy*f; b.r+=b.vr*f;
    cctx.save(); cctx.translate(b.x,b.y); cctx.rotate(b.r); cctx.fillStyle=b.c;
    const sx=Math.cos(b.life*.12+b.ph);
    if(b.k===1){ cctx.beginPath(); cctx.arc(0,0,b.h*.7,0,6.28); cctx.fill(); }
    else if(b.k===2){ cctx.fillRect(-b.w,-1.2,b.w*2.2*Math.abs(sx)+1,2.4); }
    else cctx.fillRect(-b.w/2*sx,-b.h/2,b.w*sx,b.h);
    cctx.restore();
  }
}

/* ---------- render loop ---------- */
let prev=performance.now(), tStart=prev, glowLevel=1;
function frame(now){
  const dt=Math.min(.05,(now-prev)/1000); prev=now; const t=(now-tStart)/1000;
  if(lit){
    breath = holding ? Math.min(1, breath + dt*.95 + swipeBoost) : Math.max(0, breath - dt*1.4);
    swipeBoost=0;
    prog.style.strokeDashoffset = String(239*(1-breath));
    holdRing.classList.toggle('on', breath>.01 || holding);
    if(breath>=1) blowOut();
  }
  const life = lit ? 1 - breath*.35 : Math.max(0, 1-(now-outT)/220);
  glowLevel += ((lit?1:.18) - glowLevel)*Math.min(1,dt*2.5);
  if(glOK){
    bgMat.uniforms.uTime.value=t; bgMat.uniforms.uGlow.value=glowLevel;
    bgMat.uniforms.uParty.value=Math.max(0,bgMat.uniforms.uParty.value-dt*.35);
    hemi.intensity=.45+(1-glowLevel)*.35; key.intensity=.55+(1-glowLevel)*.45;
    if(flames.length){ const c=new THREE.Vector3(); flames.forEach(f=>c.add(f.flame.position)); c.multiplyScalar(1/flames.length).project(camera);
      bgMat.uniforms.uGlowPos.value.set(c.x*.5*camera.aspect, c.y*.5); }
    ptrSmooth.x+=(pointer.x-ptrSmooth.x)*Math.min(1,dt*3); ptrSmooth.y+=(pointer.y-ptrSmooth.y)*Math.min(1,dt*3);
    const az=(reduceMotion?0:Math.sin(t*.13)*.28)+ptrSmooth.x*.22, el=.3-ptrSmooth.y*.08;
    camera.position.set(target.x+Math.sin(az)*camDist*Math.cos(el), target.y+camDist*Math.sin(el), target.z+Math.cos(az)*camDist*Math.cos(el));
    camera.lookAt(target);
    const shake = lit ? breath : 0;
    flames.forEach((f,i)=>{
      f.flame.quaternion.copy(camera.quaternion); f.glow.quaternion.copy(camera.quaternion);
      f.mat.uniforms.uTime.value=t; f.mat.uniforms.uLife.value=life;
      f.mat.uniforms.uLean.value=shake*(1.1+.5*Math.sin(t*23+i)) + .08*Math.sin(t*1.7+i);
      glowMatSet(t,life);
      f.light.intensity=(1.7+.25*Math.sin(t*13+i*2)+.15*Math.sin(t*29+i))*life;
      f.flame.visible=f.glow.visible=life>.001;
    });
    if(waxU) waxU.uWax.value = lit ? (.85+.1*Math.sin(t*13)+.05*Math.sin(t*29))*life : Math.max(0, waxU.uWax.value - dt*.8);
    if(emberMat) emberMat.opacity = lit ? 1 : Math.max(0, 1-(now-outT)/2600);
    // smoke
    const pos=smoke.geo.attributes.position.array, al=smoke.geo.attributes.aAlpha.array, sz=smoke.geo.attributes.aSize.array;
    smoke.parts.forEach((p,i)=>{
      if(p.life>0){ if(p.delay>0){ p.delay-=dt; al[i]=0; return; }
        p.life-=dt; p.y+=p.vy*dt; p.x+=(p.vx+Math.sin(t*2+i)*.06)*dt; p.vy*=.995; p.s+=dt*.18;
        const k=p.life/p.max; pos[i*3]=p.x; pos[i*3+1]=p.y; pos[i*3+2]=p.z; al[i]=Math.max(0,k)*.28*Math.min(1,(1-k)*6); sz[i]=p.s; }
      else al[i]=0;
    });
    smoke.geo.attributes.position.needsUpdate=smoke.geo.attributes.aAlpha.needsUpdate=smoke.geo.attributes.aSize.needsUpdate=true;
    renderer.clear(); renderer.render(bgScene,bgCam); renderer.clearDepth(); renderer.render(scene,camera);
  }
  drawConfetti(dt); boardTick(dt);
  requestAnimationFrame(frame);
}
function glowMatSet(t,life){ if(!glOK) return; const u=flames[0].glow.material.uniforms; u.uTime.value=t; u.uLife.value=life; }
