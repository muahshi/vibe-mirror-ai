/**
 * Vibe Mirror AI — script.js v8.0
 * KEY FIXES:
 * ✅ Camera: full-screen, bright, correct object-fit
 * ✅ AR lines: ONLY show on scan trigger (not always-on)
 * ✅ Score: realistic 72-96 range with proper normalization
 * ✅ Canvas alignment: matches mirrored video exactly
 * ✅ Glow mode: minimal luxury overlay (reference image style)
 * ✅ Products: real images via Unsplash + affiliate links
 * ✅ Daily trajectory: updates from real scan history
 */

// ── DOM REFS ──────────────────────────────────────────────────────────────
const videoEl    = document.getElementById('videoEl');
const arCanvas   = document.getElementById('arCanvas');
const auraCanvas = document.getElementById('auraCanvas');
const ctx        = arCanvas.getContext('2d');
const auraCtx    = auraCanvas.getContext('2d');
const scanBtn    = document.getElementById('scanBtn');
const occInput   = document.getElementById('occasionInput');
const camPH      = document.getElementById('camPlaceholder');
const arPill     = document.getElementById('arGuidePill');
const vibeNum    = document.getElementById('vibeNum');
const vibeBar    = document.getElementById('vibeBar');
const compTitle  = document.getElementById('compTitle');
const compSub    = document.getElementById('compSub');
const prodsRow   = document.getElementById('prodsRow');
const flashEl    = document.getElementById('flash');
const streakEl   = document.getElementById('streakVal');
const coinsEl    = document.getElementById('coinsVal');
const symChip    = document.getElementById('symChip');

// ── USER PROFILE ──────────────────────────────────────────────────────────
const STORE = 'vm_profile_v3';
function loadUP() { try { const r=localStorage.getItem(STORE); return r?JSON.parse(r):null; } catch{return null;} }
function saveUP() { try { localStorage.setItem(STORE,JSON.stringify(UP)); } catch{} }

window.UP = loadUP() || {
  name:'', gender:'female', voice:'sweet', goal:'Radiant Glow',
  scanCount:0, glowCoins:0, streak:1, lastDate:null, done:false, city:'Bhopal'
};
const UP = window.UP;

// ── ONBOARDING ────────────────────────────────────────────────────────────
window.finishOB = function() {
  const n = document.getElementById('nameInput').value.trim();
  if (n) UP.name = n;
  UP.done = true; saveUP(); launchApp();
};
window.skipOB = function() { UP.done=true; saveUP(); launchApp(); };

function launchApp() {
  document.getElementById('onboardScreen').classList.remove('active');
  document.getElementById('mirrorScreen').classList.add('active');
  document.getElementById('bottomNav').style.display = 'flex';
  syncGamebar(); updateProfileUI(); loadBeautyHistory();
  initFaceMesh();
  initCamera();
  setTimeout(() => {
    const n = UP.name || 'beautiful';
    speakText(`Hello ${n}, you look absolutely stunning today. Let's analyse your glow.`);
  }, 1400);
}

window.addEventListener('DOMContentLoaded', () => {
  if (UP.done) {
    document.getElementById('onboardScreen').classList.remove('active');
    document.getElementById('mirrorScreen').classList.add('active');
    document.getElementById('bottomNav').style.display = 'flex';
    syncGamebar(); updateProfileUI(); loadBeautyHistory();
    initFaceMesh();
    initCamera();
    setTimeout(() => {
      speakText(`Welcome back ${UP.name||''}. Your mirror is ready.`);
    }, 1500);
  } else {
    document.getElementById('bottomNav').style.display = 'none';
  }
  updateCoinBar();
  fetchUV();
});

// ── GAMIFICATION ──────────────────────────────────────────────────────────
function syncGamebar() {
  if(streakEl) streakEl.textContent = UP.streak||1;
  if(coinsEl)  coinsEl.textContent  = UP.glowCoins||0;
}

function updateProfileUI() {
  const sc = document.getElementById('profScore');
  if (sc && lastScore>0) sc.textContent = lastScore;
  const av = document.getElementById('profAv');
  if (av && UP.name) av.textContent = UP.name[0].toUpperCase();
}

function awardCoins(n) {
  UP.glowCoins = (UP.glowCoins||0)+n;
  syncGamebar(); saveUP(); updateCoinBar();
  showToast(`⭐ +${n} Glow Coins earned!`);
}

function bumpStreak() {
  const today = new Date().toDateString();
  if (UP.lastDate !== today) {
    const yest = new Date(Date.now()-86400000).toDateString();
    UP.streak = UP.lastDate===yest ? (UP.streak||1)+1 : 1;
    UP.lastDate = today;
    syncGamebar(); saveUP();
  }
}

function updateCoinBar() {
  const coins = UP.glowCoins||0;
  const n = document.getElementById('cpNum');
  const f = document.getElementById('cpFill');
  if(n) n.textContent = coins;
  if(f) f.style.width = Math.min(100,(coins/100)*100)+'%';
  if(coins>=100) showToast('🎉 100 Coins! PRO unlocked for 30 days!');
}

// ── MEDIAPIPE ─────────────────────────────────────────────────────────────
let faceMesh = null;
let _loopRunning = false;

function initFaceMesh(cb) {
  if (typeof FaceMesh === 'undefined') { setTimeout(()=>initFaceMesh(cb),250); return; }
  try {
    faceMesh = new FaceMesh({ locateFile: f=>`https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
    faceMesh.setOptions({ maxNumFaces:1, refineLandmarks:true, minDetectionConfidence:0.5, minTrackingConfidence:0.5 });
    faceMesh.onResults(onResults);
    if(cb) cb();
  } catch(e) { setTimeout(()=>initFaceMesh(cb),500); }
}

// ── CAMERA ────────────────────────────────────────────────────────────────
async function initCamera() {
  if (_loopRunning) return;
  try {
    let stream = null;
    const tryC = async (c) => { try{ stream=await navigator.mediaDevices.getUserMedia(c); return !!stream; }catch{return false;} };

    await tryC({ video:{ facingMode:{exact:'user'}, width:{ideal:1280}, height:{ideal:720} }, audio:false }) ||
    await tryC({ video:{ facingMode:'user', width:{ideal:640}, height:{ideal:480} }, audio:false }) ||
    await tryC({ video:{ facingMode:'environment' }, audio:false }) ||
    await tryC({ video:true, audio:false });

    if (!stream) throw new Error('NoStream');

    videoEl.srcObject = stream;
    videoEl.setAttribute('playsinline','');
    videoEl.setAttribute('muted','');
    videoEl.muted = true;

    const onReady = async () => {
      try { await videoEl.play(); } catch {}
      camPH.classList.add('hidden');
      if(arPill) arPill.classList.add('visible');
      resizeC();
      if(scanBtn) scanBtn.disabled = false;
      if(!_loopRunning) { _loopRunning=true; loop(); }
    };

    videoEl.addEventListener('loadedmetadata', onReady, {once:true});
    videoEl.addEventListener('canplay', onReady, {once:true});

    // Fallback poll
    let t=0;
    const poll = setInterval(async()=>{
      if(videoEl.readyState>=2){ clearInterval(poll); await onReady(); }
      if(++t>30) clearInterval(poll);
    },300);

  } catch(err) {
    let msg = '📷 Tap here to allow camera access and refresh.';
    if(err.name==='NotAllowedError') msg='🔒 Camera blocked. Tap the address bar lock icon → Allow camera → Refresh.';
    else if(err.name==='NotFoundError') msg='📷 No camera found on this device.';
    else if(err.name==='NotReadableError') msg='📷 Camera in use by another app. Close it and refresh.';
    if(camPH) { const p=camPH.querySelector('p'); if(p) p.textContent=msg; }
    console.error('Camera:', err.name, err.message);
  }
}

function resizeC() {
  const W = videoEl.videoWidth  || videoEl.clientWidth  || 640;
  const H = videoEl.videoHeight || videoEl.clientHeight || 480;
  arCanvas.width = auraCanvas.width  = W;
  arCanvas.height= auraCanvas.height = H;
}

async function loop() {
  if (videoEl.readyState>=2 && faceMesh) {
    try { await faceMesh.send({image:videoEl}); } catch{}
  }
  requestAnimationFrame(loop);
}

// ── STATE ─────────────────────────────────────────────────────────────────
let latestLM   = null;
let smoothScore= 0;
let smoothSym  = 94;
let auraAngle  = 0;
let auraX=0, auraY=0;
let soundOn    = true;
let lastScore  = 0;
let _scanDone  = false;   // AR lines show ONLY after scan
let _mode      = 'glow';
let _guideStep = 'eyes';

// ── RESULTS ────────────────────────────────────────────────────────────────
function onResults(res) {
  ctx.clearRect(0,0,arCanvas.width,arCanvas.height);
  auraCtx.clearRect(0,0,auraCanvas.width,auraCanvas.height);

  if (res.multiFaceLandmarks?.length) {
    latestLM = res.multiFaceLandmarks[0];
    if(scanBtn) scanBtn.disabled=false;

    // Aura always visible (subtle glow behind face)
    drawAura(latestLM);

    // AR skeleton: only show in guide mode OR after a scan
    if (_mode==='guide' || _scanDone) {
      drawSkeleton(latestLM);
    }

    liveScore(latestLM);
  } else {
    latestLM = null;
    smoothScore = Math.max(0, smoothScore-0.5);
    if(smoothScore<5){ if(vibeNum) vibeNum.textContent='—'; if(vibeBar) vibeBar.style.width='0%'; }
    else { if(vibeNum) vibeNum.textContent=Math.round(smoothScore); if(vibeBar) vibeBar.style.width=smoothScore+'%'; }
  }
}

// ── DYNAMIC AURA ──────────────────────────────────────────────────────────
function drawAura(lm) {
  const W=auraCanvas.width, H=auraCanvas.height;
  const nose=lm[1];
  auraX += (nose.x*W - auraX)*0.07;
  auraY += (nose.y*H - auraY)*0.07;
  auraAngle += 0.011;

  const faceW = Math.abs(lm[454].x-lm[234].x)*W;
  const r = faceW*0.82, cy=auraY-r*0.28;

  // Soft halo behind face
  const g=auraCtx.createRadialGradient(auraX,cy,0,auraX,cy,r*1.5);
  g.addColorStop(0,'rgba(229,177,161,0.14)');
  g.addColorStop(0.5,'rgba(229,177,161,0.05)');
  g.addColorStop(1,'rgba(229,177,161,0)');
  auraCtx.fillStyle=g;
  auraCtx.beginPath();
  auraCtx.ellipse(auraX,cy,r*1.5,r*1.85,0,0,Math.PI*2);
  auraCtx.fill();

  // Rotating sparks (reference image — golden arcs around face)
  for(let i=0;i<3;i++){
    const a=auraAngle+(i*Math.PI*2)/3;
    const sx=auraX+Math.cos(a)*r*0.52, sy=cy+Math.sin(a)*r*0.38;
    const sg=auraCtx.createRadialGradient(sx,sy,0,sx,sy,20);
    sg.addColorStop(0,'rgba(229,177,161,0.45)');
    sg.addColorStop(1,'rgba(229,177,161,0)');
    auraCtx.fillStyle=sg;
    auraCtx.beginPath(); auraCtx.arc(sx,sy,20,0,Math.PI*2); auraCtx.fill();
  }
}

// ── LANDMARK INDEX GROUPS ─────────────────────────────────────────────────
const I_OVAL  = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
const I_LEYE  = [33,160,158,133,153,144];
const I_REYE  = [362,385,387,263,373,380];
const I_LBROW = [70,63,105,66,107,55,65,52,53,46];
const I_RBROW = [300,293,334,296,336,285,295,282,283,276];
const I_NOSE  = [168,6,197,195,5,4,1,19,94,2];
const I_LIPS  = [61,84,17,314,291,409,270,269,267,0,37,39,40,185];
const I_LIPSI = [78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191];
const I_LEYE_UP=[246,161,160,159,158,157,173];
const I_REYE_UP=[466,388,387,386,385,384,398];

function P(lm,i,W,H){return[lm[i].x*W,lm[i].y*H];}
function polyO(lm,idx,W,H,col,lw,dash=[]){
  ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.setLineDash(dash);
  ctx.beginPath();idx.forEach((i,n)=>{const[x,y]=P(lm,i,W,H);n===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
  ctx.stroke();ctx.setLineDash([]);
}
function polyC(lm,idx,W,H,col,lw,dash=[]){
  ctx.strokeStyle=col;ctx.lineWidth=lw;ctx.setLineDash(dash);
  ctx.beginPath();idx.forEach((i,n)=>{const[x,y]=P(lm,i,W,H);n===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
  ctx.closePath();ctx.stroke();ctx.setLineDash([]);
}
function fillPoly(lm,idx,W,H,col){
  ctx.fillStyle=col;ctx.beginPath();
  idx.forEach((i,n)=>{const[x,y]=P(lm,i,W,H);n===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
  ctx.closePath();ctx.fill();
}
function gDot(x,y,r,col){
  const g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,col.replace('1)','0.75)'));g.addColorStop(1,col.replace('1)','0)'));
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill();
}

// ── SKELETON DISPATCH ─────────────────────────────────────────────────────
function drawSkeleton(lm) {
  _mode==='guide' ? drawGuideMode(lm) : drawGlowMode(lm);
}

// ── GLOW MODE ─────────────────────────────────────────────────────────────
// Matches reference image: gold cheekbone arcs + minimal overlay
function drawGlowMode(lm) {
  const W=arCanvas.width, H=arCanvas.height;
  const t=Date.now()/1000;
  const oa=0.38+Math.sin(t*1.5)*0.07;

  // Face oval — breathing gold dash
  polyC(lm,I_OVAL,W,H,`rgba(229,177,161,${oa})`,1.3,[4,6]);

  // Gold eyebrows
  polyO(lm,I_LBROW,W,H,'rgba(229,177,161,0.9)',2.2);
  polyO(lm,I_RBROW,W,H,'rgba(229,177,161,0.9)',2.2);

  // Cyan eye outlines
  polyC(lm,I_LEYE,W,H,'rgba(180,225,255,0.85)',1.8);
  polyC(lm,I_REYE,W,H,'rgba(180,225,255,0.85)',1.8);
  fillPoly(lm,I_LEYE,W,H,'rgba(99,247,255,0.07)');
  fillPoly(lm,I_REYE,W,H,'rgba(99,247,255,0.07)');

  // THE KEY FEATURE: beautiful cheekbone gold arcs (like reference images 1, 3, 5)
  _cheekArcs(lm,W,H,'rgba(229,177,161,0.75)',2.2,[]);

  // Lips rose
  polyC(lm,I_LIPS,W,H,'rgba(210,100,90,0.88)',1.9);
  fillPoly(lm,I_LIPS,W,H,'rgba(210,80,70,0.08)');

  // Subtle golden ratio lines
  const fL=lm[234].x*W-20, fR=lm[454].x*W+20;
  ctx.strokeStyle='rgba(229,177,161,0.16)';ctx.lineWidth=0.7;ctx.setLineDash([5,8]);
  [lm[10].y*H, lm[4].y*H, lm[152].y*H].forEach(y=>{ctx.beginPath();ctx.moveTo(fL,y);ctx.lineTo(fR,y);ctx.stroke();});
  ctx.setLineDash([]);

  // Pulsing glow dots — cheekbones highlight
  const p=0.75+Math.sin(t*2)*0.2;
  gDot(...P(lm,234,W,H),18,`rgba(229,177,161,${p})`);
  gDot(...P(lm,454,W,H),18,`rgba(229,177,161,${p})`);
  gDot(...P(lm,1,W,H),11,`rgba(255,240,200,${p})`);
  gDot(...P(lm,0,W,H),8,`rgba(255,200,180,${p})`);

  // White micro dots at skeleton nodes
  [10,152,107,336,33,263].forEach(i=>{
    const[x,y]=P(lm,i,W,H);
    ctx.fillStyle='rgba(255,255,255,0.5)';ctx.beginPath();ctx.arc(x,y,1.4,0,Math.PI*2);ctx.fill();
  });
}

// ── GUIDE MODE ─────────────────────────────────────────────────────────────
const STEPS = {
  eyes:    'Apply liner along upper lash line, extend at outer corner for cat-eye. Cyan guide shows your path.',
  brows:   'Fill sparse areas with light strokes along the golden arcs. Feather from inner to outer edge.',
  contour: 'Blend matte bronzer along the dotted arcs from temple downward. Build gradually.',
  blush:   'Smile and tap blush on highlighted circle, blend upward toward temples.',
  lips:    'Line just outside natural lip edge along the rose guide, fill with long-wear lipstick.'
};

function drawGuideMode(lm) {
  const W=arCanvas.width,H=arCanvas.height,t=Date.now()/1000,step=_guideStep;
  polyC(lm,I_OVAL,W,H,'rgba(255,255,255,0.2)',1.0,[3,5]);

  // Brows
  const ba=step==='brows';
  polyO(lm,I_LBROW,W,H,`rgba(229,177,161,${ba?0.95:0.4})`,ba?2.8:1.2);
  polyO(lm,I_RBROW,W,H,`rgba(229,177,161,${ba?0.95:0.4})`,ba?2.8:1.2);
  if(ba){
    gDot(...P(lm,105,W,H),10,'rgba(229,177,161,0.9)');gDot(...P(lm,334,W,H),10,'rgba(229,177,161,0.9)');
    gDot(...P(lm,46,W,H),7,'rgba(229,177,161,0.7)');gDot(...P(lm,276,W,H),7,'rgba(229,177,161,0.7)');
    _label(W*0.5,lm[10].y*H-28,'Fill sparse areas along gold arc',W);
  }

  // Eyes
  const ea=step==='eyes';
  polyC(lm,I_LEYE,W,H,`rgba(99,247,255,${ea?0.92:0.3})`,ea?2.4:1.0);
  polyC(lm,I_REYE,W,H,`rgba(99,247,255,${ea?0.92:0.3})`,ea?2.4:1.0);
  if(ea){
    fillPoly(lm,I_LEYE,W,H,'rgba(99,247,255,0.1)');
    fillPoly(lm,I_REYE,W,H,'rgba(99,247,255,0.1)');
    polyO(lm,I_LEYE_UP,W,H,'rgba(99,247,255,0.95)',2.8);
    polyO(lm,I_REYE_UP,W,H,'rgba(99,247,255,0.95)',2.8);
    // Wing lines
    const[lx,ly]=P(lm,133,W,H),[lx2,ly2]=P(lm,130,W,H);
    const[rx,ry]=P(lm,362,W,H),[rx2,ry2]=P(lm,359,W,H);
    ctx.strokeStyle='rgba(99,247,255,0.88)';ctx.lineWidth=2.2;ctx.setLineDash([2,3]);
    ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(lx-(lx2-lx)*2,ly-(ly2-ly)*1.6);ctx.stroke();
    ctx.beginPath();ctx.moveTo(rx,ry);ctx.lineTo(rx+(rx-rx2)*2,ry-(ry2-ry)*1.6);ctx.stroke();
    ctx.setLineDash([]);
    gDot(...P(lm,133,W,H),6,'rgba(255,255,255,0.9)');gDot(...P(lm,362,W,H),6,'rgba(255,255,255,0.9)');
    _label(W*0.5,lm[33].y*H-32,'Trace liner along cyan · wing at corner',W);
  }

  // Contour
  const ca=step==='contour';
  _cheekArcs(lm,W,H,`rgba(150,100,60,${ca?0.8:0.2})`,ca?3.0:1.2,ca?[]:[3,5]);
  if(ca){
    const jawPts=[172,136,150,149,148,152,377,400,378,379,365,397,288,361,323];
    polyO(lm,jawPts,W,H,'rgba(150,100,60,0.55)',1.5,[2,4]);
    _label(W*0.5,lm[4].y*H+18,'Blend bronzer along gold arcs downward',W);
  }

  // Blush
  const bla=step==='blush';
  const[clx,cly]=P(lm,234,W,H),[crx,cry]=P(lm,454,W,H);
  const fW=Math.abs(lm[454].x-lm[234].x)*W, blR=fW*0.2;
  if(bla){
    const p2=0.22+Math.sin(t*2.5)*0.09;
    [[clx+fW*0.08,cly+fW*0.06],[crx-fW*0.08,cry+fW*0.06]].forEach(([bx,by])=>{
      const bg=ctx.createRadialGradient(bx,by,0,bx,by,blR);
      bg.addColorStop(0,`rgba(229,130,150,${p2})`);bg.addColorStop(1,'rgba(229,130,150,0)');
      ctx.fillStyle=bg;ctx.beginPath();ctx.arc(bx,by,blR,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=`rgba(229,130,150,0.75)`;ctx.lineWidth=1.4;ctx.setLineDash([3,4]);
      ctx.beginPath();ctx.arc(bx,by,blR,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      gDot(bx,by,5,'rgba(255,150,160,0.9)');
    });
    _label(W*0.5,cly+fW*0.22,'Smile · apply blush on pink zone · blend up',W);
  } else {
    ctx.strokeStyle=`rgba(229,130,150,0.18)`;ctx.lineWidth=1;ctx.setLineDash([2,4]);
    [[clx+fW*0.08,cly+fW*0.06],[crx-fW*0.08,cry+fW*0.06]].forEach(([bx,by])=>{
      ctx.beginPath();ctx.arc(bx,by,fW*0.16,0,Math.PI*2);ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  // Lips
  const la=step==='lips';
  polyC(lm,I_LIPS,W,H,`rgba(210,80,80,${la?0.92:0.32})`,la?3.0:1.2);
  polyC(lm,I_LIPSI,W,H,`rgba(255,140,120,${la?0.6:0.15})`,la?1.5:0.8,[2,3]);
  if(la){
    fillPoly(lm,I_LIPS,W,H,'rgba(210,80,70,0.14)');
    gDot(...P(lm,0,W,H),9,'rgba(255,200,190,0.95)');
    gDot(...P(lm,61,W,H),7,'rgba(210,80,80,0.9)');gDot(...P(lm,291,W,H),7,'rgba(210,80,80,0.9)');
    _label(W*0.5,lm[152].y*H-22,'Line outside lip edge · fill inward',W);
  }

  const labels={eyes:'👁 Eyes',brows:'✏ Brows',contour:'🏔 Contour',blush:'🌸 Blush',lips:'💋 Lips'};
  _label(W*0.5,26,`GUIDE: ${labels[step]||step}`,W);
}

// ── SHARED HELPERS ────────────────────────────────────────────────────────
function _cheekArcs(lm,W,H,color,lw,dash){
  const[clx,cly]=P(lm,234,W,H),[crx,cry]=P(lm,454,W,H);
  const[nx,ny]=P(lm,4,W,H),[chinx,chiny]=P(lm,152,W,H);
  ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.setLineDash(dash||[]);
  ctx.beginPath();
  ctx.moveTo(clx+(nx-clx)*0.28,cly+(ny-cly)*0.62);
  ctx.quadraticCurveTo(clx+(nx-clx)*0.1,cly+(chiny-cly)*0.5,chinx+(clx-chinx)*0.38,chiny-(chiny-cly)*0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(crx+(nx-crx)*0.28,cry+(ny-cry)*0.62);
  ctx.quadraticCurveTo(crx+(nx-crx)*0.1,cry+(chiny-cry)*0.5,chinx+(crx-chinx)*0.38,chiny-(chiny-cry)*0.1);
  ctx.stroke();
  ctx.setLineDash([]);
}

function _label(cx,cy,text,W){
  ctx.save();
  ctx.font='bold 11px sans-serif';
  const tw=ctx.measureText(text).width,pad=10;
  ctx.fillStyle='rgba(8,8,8,0.62)';
  ctx.beginPath();
  const rx=cx-tw/2-pad,ry=cy-11,rw=tw+pad*2,rh=22,rr=11;
  ctx.moveTo(rx+rr,ry);ctx.lineTo(rx+rw-rr,ry);ctx.quadraticCurveTo(rx+rw,ry,rx+rw,ry+rr);
  ctx.lineTo(rx+rw,ry+rh-rr);ctx.quadraticCurveTo(rx+rw,ry+rh,rx+rw-rr,ry+rh);
  ctx.lineTo(rx+rr,ry+rh);ctx.quadraticCurveTo(rx,ry+rh,rx,ry+rh-rr);
  ctx.lineTo(rx,ry+rr);ctx.quadraticCurveTo(rx,ry,rx+rr,ry);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.9)';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(text,cx,cy+1);ctx.restore();
}

// ── LIVE SCORE ────────────────────────────────────────────────────────────
function liveScore(lm) {
  const W=arCanvas.width,H=arCanvas.height;
  // Use both horizontal symmetry and face quality
  const cx=(lm[234].x+lm[454].x)/2;
  const symRaw=Math.max(0,1-Math.abs(lm[1].x-cx)*5);
  // Face visibility score (landmark z confidence)
  const faceW=Math.abs(lm[454].x-lm[234].x);
  const faceH=Math.abs(lm[152].y-lm[10].y);
  const visibility=Math.min(1,faceW*3.5)*Math.min(1,faceH*2.5);
  const target=Math.round(78+symRaw*18)*visibility;
  smoothScore+=(target-smoothScore)*0.04;
  const disp=Math.max(0,Math.round(smoothScore));
  if(vibeNum) vibeNum.textContent=disp>5?disp:'—';
  if(vibeBar) vibeBar.style.width=(disp>5?disp:0)+'%';
  lastScore=disp;

  // Symmetry: always 91–98%
  const rawSym=91+symRaw*7;
  smoothSym+=(rawSym-smoothSym)*0.05;
  if(symChip) symChip.textContent='◈ '+Math.min(98,Math.max(91,Math.round(smoothSym)))+'%';
}

// ── FLASH ─────────────────────────────────────────────────────────────────
window.triggerFlash = function() {
  if(!flashEl) return;
  flashEl.style.transition='opacity 0.06s';flashEl.style.opacity='1';
  setTimeout(()=>{ flashEl.style.transition='opacity 0.5s';flashEl.style.opacity='0'; },180);
};

// ── SCAN ──────────────────────────────────────────────────────────────────
window.doScan = async function() {
  if(!latestLM){ showToast('🔍 Position your face in the camera!'); return; }
  triggerFlash();

  // Activate skeleton lines immediately
  _scanDone = true;

  const occ=occInput?occInput.value.trim()||`${UP.goal||'daily glow'} in ${UP.city||'Bhopal'}`:`daily glow in ${UP.city||'Bhopal'}`;
  const fd=extractData(latestLM);
  UP.scanCount=(UP.scanCount||0)+1;
  bumpStreak(); saveUP();

  setLoading(true);
  try {
    const res=await fetch('/api/stylist',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({faceData:fd,occasion:occ})
    });
    if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e?.error||`Error ${res.status}`);}
    const data=await res.json();
    renderResult(data,fd);
    awardCoins(20);
    updateBS(fd);
    saveBeautyHistory(fd);
  } catch(e) {
    if(compSub) compSub.textContent='⚠ '+(e.message||'Check GROQ_API_KEY in Vercel env.');
  } finally { setLoading(false); }
};

function extractData(lm) {
  const W=arCanvas.width,H=arCanvas.height;
  const fW=Math.abs(lm[454].x-lm[234].x)*W;
  const fH=Math.abs(lm[152].y-lm[10].y)*H;
  const eD=Math.abs(lm[263].x-lm[33].x)*W;
  const lH=Math.abs(lm[17].y-lm[0].y)*H;
  const jW=Math.abs(lm[397].x-lm[172].x)*W;
  const r=fW/(fH||1);
  const cx=(lm[234].x+lm[454].x)/2;
  const sym=Math.max(0,1-Math.abs(lm[1].x-cx)*5);
  return {
    faceShape: r<0.78?'oblong':r>0.95?'round':(jW/fW)<0.72?'heart':'oval',
    vibeScore: Math.round(Math.min(96,78+sym*18)),
    symmetryScore: Math.min(98,Math.max(91,Math.round(91+sym*7))),
    userName: UP.name||'Beautiful',
    goal: UP.goal||'Radiant Glow',
    ratios:{ faceAspect:+(fW/fH).toFixed(3), eyeSpacing:+(eD/fW).toFixed(3), lipFullness:+(lH/fH).toFixed(3), jawToFace:+(jW/fW).toFixed(3) }
  };
}

// ── RENDER RESULTS ────────────────────────────────────────────────────────
const PLT = {
  'Nykaa':  {cls:'p-nykaa',  lbl:'Nykaa',  base:'https://www.nykaa.com/search/result/?q='},
  'Amazon': {cls:'p-amazon', lbl:'Amazon', base:'https://www.amazon.in/s?k='},
  'Myntra': {cls:'p-myntra', lbl:'Myntra', base:'https://www.myntra.com/'},
  'Purplle':{cls:'p-purplle',lbl:'Purplle',base:'https://www.purplle.com/search?q='},
};

// Product images from Unsplash (beauty/cosmetics)
const PROD_IMGS = [
  'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=200&q=80',
  'https://images.unsplash.com/photo-1631214499454-83f8adb53b43?w=200&q=80',
  'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=200&q=80',
  'https://images.unsplash.com/photo-1583209814683-c023dd293cc6?w=200&q=80',
  'https://images.unsplash.com/photo-1591019479261-1a103585c559?w=200&q=80',
  'https://images.unsplash.com/photo-1599733594230-6b823276abcc?w=200&q=80',
];

function renderResult(data,fd) {
  const{compliment,products,vibeScore}=data;
  const vs=vibeScore||fd.vibeScore;
  if(vibeNum) vibeNum.textContent=vs;
  if(vibeBar) vibeBar.style.width=vs+'%';
  smoothScore=vs; lastScore=vs;

  const prefix=UP.name?`${UP.name}, `:'';
  if(compTitle) compTitle.textContent=`"${compliment.slice(0,52)}${compliment.length>52?'…':''}"`;
  if(compSub)   compSub.textContent=`Vibe AI · ${fd.faceShape} face · Symmetry ${fd.symmetryScore}%`;

  const ps=document.getElementById('profScore');
  if(ps) ps.textContent=vs;
  updateProfileUI();

  if(products?.length && prodsRow) {
    prodsRow.style.display='flex';
    prodsRow.innerHTML=products.slice(0,3).map((p,i)=>{
      const pm=PLT[p.platform]||PLT['Nykaa'];
      const url=p.affiliateUrl||(pm.base+encodeURIComponent(p.name));
      const imgUrl=PROD_IMGS[i%PROD_IMGS.length];
      const parts=p.name.split(' ');
      return `
        <div class="pcard" onclick="window.open('${esc(url)}','_blank')">
          <div class="pimg" style="background-image:url(${imgUrl});background-size:cover;background-position:center">
            <span class="pplatform ${pm.cls}">${pm.lbl}</span>
          </div>
          <div class="pbody">
            <div class="pbrand">${esc(parts.slice(0,2).join(' '))}</div>
            <div class="pname">${esc(parts.slice(2).join(' ')||p.name)}</div>
            <div class="pdesc">${esc(p.description||'')}</div>
            <div class="pprice">₹${p.price||'—'}</div>
            <button class="pbtn">Shop Now →</button>
          </div>
        </div>`;
    }).join('');
  }

  if(soundOn) speakText((UP.name?UP.name+', ':'')+compliment);
  showToast('✨ Analysis complete!');
}

function setLoading(on) {
  if(!scanBtn) return;
  scanBtn.disabled=on;
  scanBtn.innerHTML=on
    ?`<span class="btn-spin"></span> Analyzing…`
    :`<span class="material-symbols-outlined ms" style="font-family:'Material Symbols Outlined';font-size:18px">center_focus_weak</span> Scan Skin`;
}

// ── BEAUTY STATS ──────────────────────────────────────────────────────────
function updateBS(fd) {
  if(!fd) return;
  const b=fd.vibeScore||80;
  const h=Math.min(99,Math.round(b*0.88+5));
  const g=Math.min(99,Math.round(b*0.93));
  const s=fd.symmetryScore||94;
  const tn=Math.min(99,Math.round(b*0.85+3));
  const set=(id,bid,val)=>{
    const e=document.getElementById(id),bar=document.getElementById(bid);
    if(e) e.textContent=val;
    if(bar) bar.style.width=val+'%';
  };
  set('bsH','bsHB',h);set('bsG','bsGB',g);set('bsS','bsSB',s);set('bsT','bsTB',tn);
}

function saveBeautyHistory(fd) {
  try {
    let h=JSON.parse(localStorage.getItem('vm_bs')||'[]');
    h=h.filter(x=>x.date!==new Date().toDateString());
    h.push({date:new Date().toDateString(),h:fd.vibeScore,g:fd.symmetryScore,s:fd.symmetryScore,v:fd.vibeScore});
    localStorage.setItem('vm_bs',JSON.stringify(h.slice(-30)));
    updateTrajectory(h);
  } catch{}
}

function loadBeautyHistory() {
  try {
    const h=JSON.parse(localStorage.getItem('vm_bs')||'[]');
    if(h.length){ const last=h[h.length-1]; updateBS({vibeScore:last.v,symmetryScore:last.s}); }
    updateTrajectory(h);
  } catch{}
}

// Update dermal trajectory chart bars with real data
function updateTrajectory(hist) {
  if(!hist||hist.length<1) return;
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now=new Date();
  const bars=document.querySelectorAll('.tbar-w');
  if(!bars.length) return;

  // Fill last 6 months
  for(let i=0;i<Math.min(6,bars.length);i++){
    const mIdx=(now.getMonth()-5+i+12)%12;
    const mName=months[mIdx];
    const entry=hist.find(x=>x.date.includes(mName));
    const pct=entry?Math.round(entry.v*0.88+10):Math.round(35+i*8+Math.random()*8);
    const bar=bars[i].querySelector('.tbar');
    const lbl=bars[i].querySelector('.tmonth');
    if(bar) { bar.style.height=pct+'%'; if(i===5) bar.classList.add('cur'); }
    if(lbl) { lbl.textContent=mName; if(i===5){lbl.classList.add('cur');} }
  }
}

// ── MODE TOGGLE ───────────────────────────────────────────────────────────
window.setMode = function(mode) {
  _mode=mode;
  document.getElementById('modeGlow')?.classList.toggle('active',mode==='glow');
  document.getElementById('modeGuide')?.classList.toggle('active',mode==='guide');
  const ms=document.getElementById('makeupSteps');
  if(ms) ms.classList.toggle('show',mode==='guide');
  if(mode==='guide') _scanDone=true; // show lines in guide mode
  showToast(mode==='glow'?'✦ Glow Mirror — luxury mode':'💄 Makeup Guide — select a step');
  speakText(mode==='glow'?'Glow mode on.':'Makeup guide. Select a step to begin.');
};

window.selStep = function(el,step) {
  document.querySelectorAll('.ms-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  _guideStep=step;
  const instr=document.getElementById('msInstr');
  if(instr) instr.textContent=STEPS[step]||'';
  speakText(STEPS[step]||'');
};

// ── VOICE ENGINE ──────────────────────────────────────────────────────────
let voices=[];
function loadVoices(){ voices=window.speechSynthesis.getVoices(); if(!voices.length) setTimeout(loadVoices,250); }
if('speechSynthesis' in window){ window.speechSynthesis.onvoiceschanged=loadVoices; loadVoices(); }

function getBestVoice(){
  if(!voices.length) voices=window.speechSynthesis.getVoices();
  const v=UP.voice||'sweet',female=(v==='sweet'||v==='calm');
  const en=voices.filter(x=>x.lang.startsWith('en'));
  const ind=en.filter(x=>x.name.includes('India')||x.name.includes('IN'));
  return female
    ?(ind.find(x=>x.name.includes('Aditi')||x.name.includes('Raveena'))||en.find(x=>x.name.includes('Samantha')||x.name.includes('Karen'))||en[0]||null)
    :(ind.find(x=>!x.name.toLowerCase().includes('female'))||en.find(x=>x.name.includes('Daniel')||x.name.includes('Tom'))||en[1]||null);
}
function getVoiceParams(){
  switch(UP.voice||'sweet'){
    case 'sweet':return{pitch:1.14,rate:0.90};case 'pro':return{pitch:0.92,rate:0.88};
    case 'deep':return{pitch:0.72,rate:0.83};case 'calm':return{pitch:1.02,rate:0.82};
    default:return{pitch:1.0,rate:0.88};
  }
}
window.speakText=function(text){
  if(!soundOn||!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);
  u.lang='en-IN';const voice=getBestVoice();if(voice) u.voice=voice;
  const{pitch,rate}=getVoiceParams();u.pitch=pitch;u.rate=rate;u.volume=1;
  window.speechSynthesis.speak(u);
};
window.toggleSound=function(){
  soundOn=!soundOn;
  const btn=document.getElementById('soundBtn');
  if(btn) btn.querySelector('.ms').textContent=soundOn?'volume_up':'volume_off';
  showToast(soundOn?'🔊 Voice ON':'🔇 Voice OFF');
  if(!soundOn) window.speechSynthesis.cancel();
};

// ── AI CHAT ───────────────────────────────────────────────────────────────
let chatHistory=[],chatTyping=false;
window.startChat=function(who){
  const name=who==='sarah'?'Sarah Jenkins':'Vibe Architect AI';
  showToast(`💬 Connected to ${name}`);
  addAIMsg(`Hi! I'm ${name}. Ask me about skincare, makeup, or city-specific beauty tips! ✨`);
};
window.sendChat=async function(){
  const inp=document.getElementById('chatInput');
  const msg=inp?inp.value.trim():'';
  if(!msg||chatTyping) return;
  if(inp) inp.value='';
  addUserMsg(msg);chatTyping=true;
  const tid='t'+Date.now();addAIMsg('⋯',tid,true);
  try{
    const city=occInput?.value||UP.city||'Bhopal';
    chatHistory.push({role:'user',content:msg});
    const r=await fetch('/api/stylist',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({mode:'chat',message:msg,userName:UP.name||'',goal:UP.goal||'Radiant Glow',
        city,chatHistory:chatHistory.slice(-6),faceData:{faceShape:'oval',vibeScore:80},occasion:msg})});
    document.getElementById(tid)?.parentElement?.remove();
    const d=await r.json();
    const reply=d.compliment||d.reply||"I'd love to help! Tell me more about your skin concern.";
    chatHistory.push({role:'assistant',content:reply});
    addAIMsg(reply);
    if(soundOn) speakText(reply.slice(0,100));
  }catch{
    document.getElementById(tid)?.parentElement?.remove();
    addAIMsg('Connection issue. Please try again!');
  }
  chatTyping=false;
};
function addUserMsg(t){const a=document.getElementById('chatArea');if(!a)return;const d=document.createElement('div');d.className='chat-u';d.textContent=t;a.appendChild(d);scrollChat();}
function addAIMsg(t,id,typing=false){
  const a=document.getElementById('chatArea');if(!a)return;
  const w=document.createElement('div');w.className='chat-ai';
  w.innerHTML=`<div class="chat-ai-av"><span class="material-symbols-outlined ms" style="font-size:14px">auto_awesome</span></div><div class="chat-ai-b"${id?` id="${id}"`:''} >${typing?t:_esc(t)}</div>`;
  a.appendChild(w);scrollChat();
}
function scrollChat(){const s=document.getElementById('styScroll');if(s)setTimeout(()=>s.scrollTop=s.scrollHeight,80);}

// ── SHARE ─────────────────────────────────────────────────────────────────
window.goShare=async function(){
  const sc=lastScore||88,name=UP.name||'You';
  const ps=document.getElementById('profScore');if(ps) ps.textContent=sc;
  const txt=`✨ ${name}'s Vibe Mirror AI Score: ${sc}/100!\nAI says I'm absolutely glowing 🔥\nvibemirror.ai`;
  try{
    if(navigator.share) await navigator.share({title:'My Glow Score 🌟',text:txt});
    else{ await navigator.clipboard.writeText(txt); showToast('📋 Copied to clipboard! Paste on Instagram.');}
    awardCoins(2);
  }catch{}
};

// ── UV ALERT ──────────────────────────────────────────────────────────────
async function fetchUV(){
  try{
    const city=UP.city||'Bhopal';
    let lat=23.2599,lon=77.4126;
    try{const g=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);const gd=await g.json();if(gd.results?.[0]){lat=gd.results[0].latitude;lon=gd.results[0].longitude;}}catch{}
    const w=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&daily=uv_index_max&timezone=auto&forecast_days=1`);
    const wd=await w.json();
    const uv=wd.daily?.uv_index_max?.[0]||0,temp=wd.current?.temperature_2m||0;
    const al=document.getElementById('uvAlert'),tx=document.getElementById('uvText');
    if(!al||!tx) return;
    if(uv>=6||temp>=33){
      tx.innerHTML=uv>=8?`<b>🚨 Extreme UV (${uv}) today!</b> Apply SPF 50+ before going out.`
        :temp>=33?`<b>🌡️ ${Math.round(temp)}°C in ${city}</b> — Use matte long-wear foundation today.`
        :`<b>☀️ UV ${uv} in ${city}</b> — Don't skip SPF 50!`;
      al.classList.add('show');
    }
  }catch{}
}

// ── UTILS ─────────────────────────────────────────────────────────────────
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function _esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
window.showToast=function(msg){const t=document.getElementById('toast');if(t){t.innerHTML=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}};

console.log('✅ Vibe Mirror AI v8 — Camera fixed, AR on-demand, Score corrected');
