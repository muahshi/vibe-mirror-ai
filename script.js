/**
 * Vibe Mirror AI — script.js v4.0
 * AR lines matching reference design: gold skeleton + cyan eye lines + rose lips
 * Dynamic aura, gamification, Web Speech, localStorage
 */

// ── DOM ───────────────────────────────────────────────────────────────────
const videoEl        = document.getElementById('videoEl');
const arCanvas       = document.getElementById('arCanvas');
const auraCanvas     = document.getElementById('auraCanvas');
const ctx            = arCanvas.getContext('2d');
const auraCtx        = auraCanvas.getContext('2d');
const hypeBtn        = document.getElementById('hypeBtn');
const occasionInput  = document.getElementById('occasionInput');
const camPlaceholder = document.getElementById('camPlaceholder');
const arGuidePill    = document.getElementById('arGuidePill');
const vibeNum        = document.getElementById('vibeNum');
const vibeBar        = document.getElementById('vibeBar');
const complimentEl   = document.getElementById('complimentEl');
const complimentTitle= document.getElementById('complimentTitle');
const productsScroll = document.getElementById('productsScroll');
const flashEl        = document.getElementById('flashEl');
const streakVal      = document.getElementById('streakVal');
const coinsVal       = document.getElementById('coinsVal');
const symmetryChip   = document.getElementById('symmetryChip');

// ── PROFILE (localStorage) ─────────────────────────────────────────────────
const KEY = 'vm_profile_v3';

function loadProfile() {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveProfile(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

let UP = loadProfile() || {
  name:'', gender:'female', voice:'sweet', goal:'Radiant Glow',
  scanCount:0, glowCoins:0, streak:1, lastDate:null, done:false
};

// ── ONBOARDING ─────────────────────────────────────────────────────────────
window.finishOnboard = function() {
  UP.name   = (document.getElementById('nameInput').value.trim()) || UP.name;
  UP.done   = true;
  saveProfile(UP);
  launchApp();
};

window.skipOnboard = function() {
  UP.done = true; saveProfile(UP); launchApp();
};

function launchApp() {
  document.getElementById('onboardScreen').classList.remove('active');
  document.getElementById('mirrorScreen').classList.add('active');
  document.getElementById('bottomNav').style.display = 'flex';
  initCamera();
  syncGamebar();
  updateProfileUI();
}

window.addEventListener('DOMContentLoaded', () => {
  if (UP.done) {
    document.getElementById('onboardScreen').classList.remove('active');
    document.getElementById('mirrorScreen').classList.add('active');
    document.getElementById('bottomNav').style.display = 'flex';
    initCamera();
    syncGamebar();
    updateProfileUI();
  } else {
    document.getElementById('bottomNav').style.display = 'none';
  }
});

// ── GAMEBAR ────────────────────────────────────────────────────────────────
function syncGamebar() {
  streakVal.textContent = UP.streak || 1;
  coinsVal.textContent  = UP.glowCoins || 0;
}

function updateProfileUI() {
  const sc = document.getElementById('profileScore');
  if (sc) sc.textContent = lastVibeScore || 88;
}

function awardCoins(n) {
  UP.glowCoins = (UP.glowCoins||0) + n;
  syncGamebar(); saveProfile(UP);
  showToast(`⭐ +${n} Glow Coins!`);
}

function bumpStreak() {
  const today = new Date().toDateString();
  if (UP.lastDate !== today) {
    const yest = new Date(Date.now()-86400000).toDateString();
    UP.streak = (UP.lastDate === yest) ? (UP.streak||1)+1 : 1;
    UP.lastDate = today;
    syncGamebar(); saveProfile(UP);
  }
}

// ── MEDIAPIPE ──────────────────────────────────────────────────────────────
const faceMesh = new FaceMesh({
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
});
faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.55,
  minTrackingConfidence: 0.55
});
faceMesh.onResults(onResults);

// ── CAMERA ─────────────────────────────────────────────────────────────────
async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode:'user', width:{ideal:1280}, height:{ideal:720} },
      audio: false
    });
    videoEl.srcObject = stream;
    videoEl.onloadedmetadata = () => {
      camPlaceholder.classList.add('hidden');
      arGuidePill.classList.add('visible');
      resizeCanvases();
      hypeBtn.disabled = false;
      runLoop();
    };
  } catch {
    camPlaceholder.querySelector('p').textContent = 'Camera access denied. Please allow and refresh.';
  }
}

function resizeCanvases() {
  const W = videoEl.videoWidth  || 640;
  const H = videoEl.videoHeight || 480;
  arCanvas.width = auraCanvas.width = W;
  arCanvas.height= auraCanvas.height= H;
}

async function runLoop() {
  if (videoEl.readyState >= 2) await faceMesh.send({ image: videoEl });
  requestAnimationFrame(runLoop);
}

// ── STATE ──────────────────────────────────────────────────────────────────
let latestLM      = null;
let smoothScore   = 0;
let smoothSym     = 95;
let auraAngle     = 0;
let auraX         = 0, auraY = 0;
let speechOn      = true;
let lastVibeScore = 88;

// ── RESULTS ────────────────────────────────────────────────────────────────
function onResults(res) {
  ctx.clearRect(0, 0, arCanvas.width, arCanvas.height);
  auraCtx.clearRect(0, 0, auraCanvas.width, auraCanvas.height);

  if (res.multiFaceLandmarks?.length) {
    latestLM = res.multiFaceLandmarks[0];
    hypeBtn.disabled = false;
    drawAura(latestLM);
    drawSkeleton(latestLM);
    liveScore(latestLM);
  } else {
    latestLM = null;
    smoothScore = Math.max(0, smoothScore - 0.4);
    if (smoothScore > 5) {
      vibeNum.textContent = Math.round(smoothScore);
      vibeBar.style.width = smoothScore + '%';
    }
  }
}

// ── DYNAMIC GOLDEN AURA ────────────────────────────────────────────────────
function drawAura(lm) {
  const W = auraCanvas.width, H = auraCanvas.height;
  const nose = lm[1];
  const tx = nose.x * W, ty = nose.y * H;
  auraX += (tx - auraX) * 0.07;
  auraY += (ty - auraY) * 0.07;
  auraAngle += 0.01;

  const faceW = Math.abs(lm[454].x - lm[234].x) * W;
  const r = faceW * 0.82;

  // Soft radial halo behind face
  const g = auraCtx.createRadialGradient(auraX, auraY - r*0.28, 0, auraX, auraY - r*0.28, r*1.5);
  g.addColorStop(0,   'rgba(229,177,161,0.16)');
  g.addColorStop(0.5, 'rgba(229,177,161,0.06)');
  g.addColorStop(1,   'rgba(229,177,161,0)');
  auraCtx.fillStyle = g;
  auraCtx.beginPath();
  auraCtx.ellipse(auraX, auraY - r*0.28, r*1.5, r*1.85, 0, 0, Math.PI*2);
  auraCtx.fill();

  // 3 rotating gold sparks
  for (let i = 0; i < 3; i++) {
    const a = auraAngle + (i * Math.PI * 2) / 3;
    const sx = auraX + Math.cos(a) * r * 0.52;
    const sy = (auraY - r*0.28) + Math.sin(a) * r * 0.38;
    const sg = auraCtx.createRadialGradient(sx, sy, 0, sx, sy, 20);
    sg.addColorStop(0, 'rgba(229,177,161,0.5)');
    sg.addColorStop(1, 'rgba(229,177,161,0)');
    auraCtx.fillStyle = sg;
    auraCtx.beginPath();
    auraCtx.arc(sx, sy, 20, 0, Math.PI*2);
    auraCtx.fill();
  }
}

// ── DIGITAL SKELETON ────────────────────────────────────────────────────────
// Index groups matching reference (image 8 screenshot)
const IDX_OVAL  = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
const IDX_L_EYE = [33,160,158,133,153,144];
const IDX_R_EYE = [362,385,387,263,373,380];
const IDX_L_BROW= [70,63,105,66,107,55,65,52,53,46];
const IDX_R_BROW= [300,293,334,296,336,285,295,282,283,276];
const IDX_NOSE  = [168,6,197,195,5,4,1,19,94,2];
const IDX_LIPS_O= [61,84,17,314,291,409,270,269,267,0,37,39,40,185];
const IDX_LIPS_I= [78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191];

function px(lm, i, W, H) { return [lm[i].x * W, lm[i].y * H]; }

function polyOpen(lm, idx, W, H, col, lw, dash=[]) {
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash);
  ctx.beginPath();
  idx.forEach((i,n) => { const [x,y]=px(lm,i,W,H); n===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  ctx.stroke(); ctx.setLineDash([]);
}

function polyClosed(lm, idx, W, H, col, lw, dash=[]) {
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash);
  ctx.beginPath();
  idx.forEach((i,n) => { const [x,y]=px(lm,i,W,H); n===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
}

function glowDot(x, y, r, col) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col.replace('1)', '0.8)'));
  g.addColorStop(1, col.replace('1)', '0)'));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI*2); ctx.fill();
}

function drawSkeleton(lm) {
  const W = arCanvas.width, H = arCanvas.height;

  // 1. Face oval — gold dashed (like reference image 7,8)
  polyClosed(lm, IDX_OVAL, W, H, 'rgba(229,177,161,0.45)', 1.4, [4,6]);

  // 2. Eyebrows — solid bright gold (clearly visible in image 8)
  polyOpen(lm, IDX_L_BROW, W, H, 'rgba(229,177,161,0.9)', 2.0);
  polyOpen(lm, IDX_R_BROW, W, H, 'rgba(229,177,161,0.9)', 2.0);

  // 3. Eyes — cyan/teal closed polygon (matches reference — white-cyan in image 8)
  polyClosed(lm, IDX_L_EYE, W, H, 'rgba(200,230,255,0.85)', 1.8);
  polyClosed(lm, IDX_R_EYE, W, H, 'rgba(200,230,255,0.85)', 1.8);

  // 4. Eyeliner coach overlay — cyan dotted outside eyes
  polyOpen(lm, IDX_L_EYE, W, H, 'rgba(99,247,255,0.5)', 1.0, [2,4]);
  polyOpen(lm, IDX_R_EYE, W, H, 'rgba(99,247,255,0.5)', 1.0, [2,4]);

  // 5. Eye glow fill
  const eyeFillL = ctx.createRadialGradient(...px(lm,468,W,H), 0, ...px(lm,468,W,H), 14);
  eyeFillL.addColorStop(0, 'rgba(99,247,255,0.12)');
  eyeFillL.addColorStop(1, 'rgba(99,247,255,0)');
  ctx.fillStyle = eyeFillL;
  ctx.beginPath();
  IDX_L_EYE.forEach((i,n)=>{ const[x,y]=px(lm,i,W,H); n===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  ctx.closePath(); ctx.fill();

  const eyeFillR = ctx.createRadialGradient(...px(lm,473,W,H), 0, ...px(lm,473,W,H), 14);
  eyeFillR.addColorStop(0, 'rgba(99,247,255,0.12)');
  eyeFillR.addColorStop(1, 'rgba(99,247,255,0)');
  ctx.fillStyle = eyeFillR;
  ctx.beginPath();
  IDX_R_EYE.forEach((i,n)=>{ const[x,y]=px(lm,i,W,H); n===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  ctx.closePath(); ctx.fill();

  // 6. Nose bridge — subtle white
  polyOpen(lm, IDX_NOSE, W, H, 'rgba(255,255,255,0.22)', 1.0);

  // 7. Cheekbone contour curves (key feature from reference images 7 & 8)
  const [clx, cly] = px(lm, 234, W, H);
  const [crx, cry] = px(lm, 454, W, H);
  const [chinx, chiny] = px(lm, 152, W, H);
  const [nosex, nosey] = px(lm, 4, W, H);

  ctx.strokeStyle = 'rgba(229,177,161,0.65)';
  ctx.lineWidth = 1.8; ctx.setLineDash([]);
  // Left cheekbone arc
  ctx.beginPath();
  ctx.moveTo(clx + (nosex-clx)*0.3, cly + (nosey-cly)*0.6);
  ctx.quadraticCurveTo(clx + (nosex-clx)*0.15, cly + (chiny-cly)*0.5, chinx + (clx-chinx)*0.35, chiny - (chiny-cly)*0.12);
  ctx.stroke();
  // Right cheekbone arc
  ctx.beginPath();
  ctx.moveTo(crx + (nosex-crx)*0.3, cry + (nosey-cry)*0.6);
  ctx.quadraticCurveTo(crx + (nosex-crx)*0.15, cry + (chiny-cry)*0.5, chinx + (crx-chinx)*0.35, chiny - (chiny-cry)*0.12);
  ctx.stroke();

  // 8. Lips outer — rose/coral (image 8 shows red-pink lips outline)
  polyClosed(lm, IDX_LIPS_O, W, H, 'rgba(210,100,90,0.85)', 1.8);

  // 9. Lips inner dotted — coach overlay
  polyClosed(lm, IDX_LIPS_I, W, H, 'rgba(255,140,120,0.5)', 1.1, [2,3]);

  // 10. Lip fill subtle
  const lipG = ctx.createRadialGradient(...px(lm,14,W,H), 0, ...px(lm,14,W,H), 18);
  lipG.addColorStop(0, 'rgba(210,80,70,0.1)'); lipG.addColorStop(1, 'rgba(210,80,70,0)');
  ctx.fillStyle = lipG;
  ctx.beginPath();
  IDX_LIPS_O.forEach((i,n)=>{ const[x,y]=px(lm,i,W,H); n===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  ctx.closePath(); ctx.fill();

  // 11. Golden ratio horizontal lines (across full face)
  const fL = lm[234].x * W - 15;
  const fR = lm[454].x * W + 15;
  const ratioPoints = [lm[10].y*H, lm[66].y*H, lm[4].y*H, lm[17].y*H, lm[152].y*H];
  ctx.strokeStyle = 'rgba(229,177,161,0.22)';
  ctx.lineWidth = 0.8; ctx.setLineDash([5, 8]);
  ratioPoints.forEach(y => {
    ctx.beginPath(); ctx.moveTo(fL, y); ctx.lineTo(fR, y); ctx.stroke();
  });
  ctx.setLineDash([]);

  // 12. Glow dots — cheekbones, nose tip, lip corners
  const glowPts = [
    [234, 'rgba(229,177,161,1)', 16],
    [454, 'rgba(229,177,161,1)', 16],
    [1,   'rgba(229,177,161,1)', 10],
    [61,  'rgba(210,100,90,1)',  10],
    [291, 'rgba(210,100,90,1)',  10],
  ];
  glowPts.forEach(([i, col, r]) => {
    const [x,y] = px(lm, i, W, H);
    glowDot(x, y, r, col);
  });

  // 13. Micro dots on key skeleton intersections
  const microDots = [10,152,107,336,33,263,1,61,291];
  microDots.forEach(i => {
    const [x,y] = px(lm,i,W,H);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(x,y,1.6,0,Math.PI*2); ctx.fill();
  });
}

// ── LIVE SCORE ─────────────────────────────────────────────────────────────
function liveScore(lm) {
  const W = arCanvas.width, H = arCanvas.height;
  const cx = (lm[234].x + lm[454].x) / 2;
  const sym = Math.max(0, 1 - Math.abs(lm[1].x - cx) * 5);
  const target = 70 + sym * 26;
  smoothScore += (target - smoothScore) * 0.04;

  const disp = Math.round(smoothScore);
  vibeNum.textContent = disp;
  vibeBar.style.width = disp + '%';
  lastVibeScore = disp;

  const symPct = Math.min(99, Math.round(sym * 11 + 88));
  smoothSym += (symPct - smoothSym) * 0.05;
  symmetryChip.textContent = '◈ ' + Math.round(smoothSym) + '%';
}

// ── FLASH ──────────────────────────────────────────────────────────────────
window.triggerFlash = function() {
  flashEl.style.transition = 'opacity 0.07s';
  flashEl.style.opacity = '1';
  setTimeout(() => { flashEl.style.transition='opacity 0.5s'; flashEl.style.opacity='0'; }, 140);
};

// ── SCAN ───────────────────────────────────────────────────────────────────
window.triggerScan = async function() {
  if (!latestLM) { showToast('🔍 Point your face at the camera first!'); return; }

  triggerFlash();
  const occasion = occasionInput.value.trim() || `${UP.goal || 'daily glow'} in Bhopal`;
  const faceData = extractData(latestLM);
  UP.scanCount = (UP.scanCount||0) + 1;
  bumpStreak(); saveProfile(UP);

  setLoading(true);
  try {
    const res = await fetch('/api/stylist', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ faceData, occasion })
    });
    if (!res.ok) { const e=await res.json().catch(()=>{}); throw new Error(e?.error||`Error ${res.status}`); }
    const data = await res.json();
    renderResult(data, faceData);
    awardCoins(20);
  } catch(e) {
    complimentEl.textContent = '⚠ ' + (e.message || 'Check your GROQ_API_KEY in Vercel env.');
  } finally {
    setLoading(false);
  }
};

// ── EXTRACT ANONYMOUS DATA ─────────────────────────────────────────────────
function extractData(lm) {
  const W = arCanvas.width, H = arCanvas.height;
  const fW = Math.abs(lm[454].x - lm[234].x) * W;
  const fH = Math.abs(lm[152].y - lm[10].y)  * H;
  const eD = Math.abs(lm[263].x - lm[33].x)  * W;
  const lH = Math.abs(lm[17].y  - lm[0].y)   * H;
  const jW = Math.abs(lm[397].x - lm[172].x)  * W;
  const r  = fW / (fH||1);
  const faceShape = r < 0.78 ? 'oblong' : r > 0.95 ? 'round' : (jW/fW)<0.72?'heart':'oval';
  const cx  = (lm[234].x + lm[454].x)/2;
  const sym = Math.max(0, 1-Math.abs(lm[1].x-cx)*5);
  return {
    faceShape,
    vibeScore: Math.round(Math.min(96, 70+sym*26)),
    symmetryScore: Math.min(99, Math.round(sym*11+88)),
    userName: UP.name || 'Beautiful',
    goal: UP.goal || 'Radiant Glow',
    ratios: {
      faceAspect:  +(fW/fH).toFixed(3),
      eyeSpacing:  +(eD/fW).toFixed(3),
      lipFullness: +(lH/fH).toFixed(3),
      jawToFace:   +(jW/fW).toFixed(3),
    }
  };
}

// ── RENDER RESULT ──────────────────────────────────────────────────────────
const PLT = {
  'Nykaa':  {cls:'dot-nykaa',  lbl:'Nykaa',   base:'https://www.nykaa.com/search/result/?q='},
  'Amazon': {cls:'dot-amazon', lbl:'Amazon',  base:'https://www.amazon.in/s?k='},
  'Myntra': {cls:'dot-myntra', lbl:'Myntra',  base:'https://www.myntra.com/'},
  'Purplle':{cls:'dot-purplle',lbl:'Purplle', base:'https://www.purplle.com/search?q='},
};

function renderResult(data, fd) {
  const { compliment, products, vibeScore } = data;
  const vs = vibeScore || fd.vibeScore;
  vibeNum.textContent = vs;
  vibeBar.style.width = vs + '%';
  smoothScore = vs; lastVibeScore = vs;

  const greet = UP.name ? `${UP.name}, ` : '';
  const fullCompliment = greet + compliment;

  complimentTitle.textContent = `"${compliment.slice(0,50)}${compliment.length>50?'…':''}"`;
  complimentEl.textContent = `AI Analysis Reflection: ${fd.faceShape} face · Symmetry ${fd.symmetryScore}%`;

  document.getElementById('profileScore').textContent = vs;

  if (products?.length) {
    productsScroll.style.display = 'flex';
    productsScroll.innerHTML = products.slice(0,3).map(p => {
      const pm = PLT[p.platform] || PLT['Nykaa'];
      const url = p.affiliateUrl || (pm.base + encodeURIComponent(p.name));
      return `
        <div class="product-card" onclick="window.open('${esc(url)}','_blank')">
          <div class="prd-img">
            <span>${p.emoji||'✨'}</span>
            <span class="prd-platform ${pm.cls}">${pm.lbl}</span>
          </div>
          <div class="prd-body">
            <div class="prd-brand">${esc(p.name.split(' ').slice(0,2).join(' '))}</div>
            <div class="prd-name">${esc(p.name.split(' ').slice(2).join(' ')||p.name)}</div>
            <div class="prd-desc">${esc(p.description||'')}</div>
            <div class="prd-price">₹${p.price||'—'}</div>
            <button class="prd-btn">Shop Now →</button>
          </div>
        </div>`;
    }).join('');
  }

  if (speechOn) speakText(fullCompliment);
  showToast('✨ Vibe Mirror AI analysis complete!');
}

function setLoading(on) {
  hypeBtn.disabled = on;
  hypeBtn.innerHTML = on
    ? `<span class="btn-spinner"></span> Analyzing…`
    : `<span class="material-symbols-outlined" style="font-family:'Material Symbols Outlined';font-size:18px;">center_focus_weak</span> Scan Skin`;
}

// ── VOICE ──────────────────────────────────────────────────────────────────
let voices = [];
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => { voices = window.speechSynthesis.getVoices(); };
  setTimeout(()=>{ voices = window.speechSynthesis.getVoices(); }, 500);
}

function getBestVoice() {
  if (!voices.length) voices = window.speechSynthesis.getVoices();
  const v = UP.voice || 'sweet';
  const female = v === 'sweet' || v === 'calm';
  const enVoices = voices.filter(v => v.lang.startsWith('en'));
  const indian   = enVoices.filter(v => v.name.includes('India')||v.name.includes('IN'));

  if (female) {
    return indian.find(v=>v.name.includes('Aditi')||v.name.includes('Raveena'))
      || enVoices.find(v=>v.name.includes('Samantha')||v.name.includes('Karen')||v.name.includes('Moira'))
      || enVoices[0] || null;
  } else {
    return indian.find(v=>!v.name.toLowerCase().includes('female'))
      || enVoices.find(v=>v.name.includes('Daniel')||v.name.includes('Tom')||v.name.includes('Aaron'))
      || enVoices[1] || null;
  }
}

function speakText(text) {
  if (!speechOn || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-IN';
  const voice = getBestVoice(); if (voice) u.voice = voice;
  const v = UP.voice || 'sweet';
  u.pitch  = v==='sweet' ? 1.15 : v==='calm' ? 1.0 : v==='deep' ? 0.75 : 0.9;
  u.rate   = v==='sweet' ? 0.91 : v==='calm' ? 0.85 : v==='deep' ? 0.82 : 0.88;
  u.volume = 1;
  window.speechSynthesis.speak(u);
}

window.toggleSound = function() {
  speechOn = !speechOn;
  const btn = document.getElementById('soundBtn');
  btn.querySelector('.mat-icon').textContent = speechOn ? 'volume_up' : 'volume_off';
  showToast(speechOn ? '🔊 Voice hype ON' : '🔇 Voice hype OFF');
  if (!speechOn) window.speechSynthesis.cancel();
};

// ── UTILS ──────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.showToast = function(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2800);
};
